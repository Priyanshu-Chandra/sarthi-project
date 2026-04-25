const express = require('express');
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// #region agent log
const DEBUG_SESSION_ID = "2ecb98";
const DEBUG_LOG_PATH = path.resolve(__dirname, "../debug-2ecb98.log");
const agentNdjsonLog = (payload) => {
  try {
    if (!payload || typeof payload !== "object") return;
    const line = JSON.stringify({ sessionId: DEBUG_SESSION_ID, ...payload });
    fs.appendFile(DEBUG_LOG_PATH, `${line}\n`, () => {});
  } catch (_) {}
};
// #endregion agent log

// --- Whiteboard Constants ---
const MAX_STROKES = 5000;

// packages
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

// connection to DB and cloudinary
const { connectDB } = require('./config/database');
const { cloudinaryConnect } = require('./config/cloudinary');
const { validateEnvironment } = require('./utils/startupCheck');

// Validate environment early 
validateEnvironment();

// routes
const userRoutes = require('./routes/user');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payments');
const courseRoutes = require('./routes/course');
const studyPlanner = require("./routes/studyPlanner");
const Course = require("./models/course");
const LiveEvent = require("./models/LiveEvent");
const BoardSession = require("./models/BoardSession");
const LiveSession = require("./models/LiveSession");
const LiveAttendance = require("./models/LiveAttendance");
const PollResult = require("./models/PollResult");



// middleware 
app.use(express.json({
  strict: true,
  verify: (req, res, buf) => {
    try {
      if (buf && buf.length > 0) JSON.parse(buf);
    } catch (e) {
      req.invalidJson = true;
    }
  }
}));

app.use((req, res, next) => {
  if (req.invalidJson) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload"
    });
  }
  next();
});
app.use(cookieParser());
app.use(
    cors({
        // origin: 'http://localhost:5173', // frontend link
        origin: "*",
        credentials: true,
        exposedHeaders: ["Content-Disposition"]
    })
);
app.use(
    fileUpload({
        useTempFiles: true,
        tempFileDir: '/tmp'
    })
)


const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
// Note: app.set("endSession", endSession) is called AFTER endSession is defined below


// ─── Session Controls (Single Source of Truth) ───────────────────────────────
// Uses Sets for O(1) permit lookups. Replaces the old roomPermissions +
// roomState maps with one canonical store per roomId.
// Structure: sessionControls[roomId] = {
//   mutedUsers: Set<userId>,       — students whose mic is OFF
//   videoAllowed: Set<userId>,     — students allowed to use camera
//   screenAllowed: Set<userId>,    — students allowed to share screen
//   boardEditors: Set<userId>,     — students allowed to draw
//   globalMute: boolean,           — true if instructor muted everyone
// }
const sessionControls = {};

// Initialises a room's control state (idempotent — safe to call multiple times)
const initSessionControls = (roomId) => {
  if (!sessionControls[roomId]) {
    sessionControls[roomId] = {
      mutedUsers:   new Set(),
      videoAllowed: new Set(),
      screenAllowed: new Set(),
      boardEditors:  new Set(),
      globalMute:    false,
    };
  }
  return sessionControls[roomId];
};

// Builds the permission snapshot sent to a single user on join
const getPermissionsSnapshot = (roomId, userId, role) => {
  if (role === "instructor") {
    return { canSpeak: true, canVideo: true, canShareScreen: true, canEditBoard: true };
  }
  const ctrl = sessionControls[roomId];
  if (!ctrl) {
    return { canSpeak: false, canVideo: false, canShareScreen: false, canEditBoard: false };
  }
  return {
    canSpeak:       !ctrl.mutedUsers.has(userId) && !ctrl.globalMute,
    canVideo:        ctrl.videoAllowed.has(userId),
    canShareScreen:  ctrl.screenAllowed.has(userId),
    canEditBoard:    ctrl.boardEditors.has(userId),
  };
};

// Rate limiter: socketId → last event timestamp. No Redis needed for this scale.
const lastEventTime = new Map();
// Participant registry (for panel UI & emitParticipants)
const roomParticipants = new Map();
// Board history: roomId → Stroke[] (stores drawings for late-joiners/sync)
const roomBoardStates = new Map();
// Poll state: roomId → { activePoll: { id, question, options, votes: {userId → option} } }
const roomPolls = new Map();
// Pinned messages: roomId → Message Object
const roomPinnedMessages = new Map();
// Last closed poll results: roomId → { tally, totalVotes }
const roomClosedPollResults = new Map();
// Poll auto-close timers: roomId → timeoutId
const pollTimers = new Map();
// Phase 3 analytics: sessionId → { activeStudents, raisedHands, messages, pollResponses, boardDraws }
const liveCache = new Map();
// Board version tracking for undo race condition prevention
// Structure: roomId → { version: number, lastUndoAt: timestamp }
const roomBoardVersions = new Map();

// Direct roomId → sessionId mapping (O(1) lookup, no cache scanning)
const roomSessionMap = new Map();

// Instructor disconnect grace period timers (roomId → timeoutId)
const instructorDisconnectTimers = new Map();
const sessionMetricsIntervals = new Map();
const endingSessions = new Set();
// DB Write Throttling: Keeps track of (sid_uid_type) to cap updates to 0.5Hz
const interactionThrottle = new Map();

// ─── Periodic Memory Cleansing ───────────────────────────────────────────────
// Prevents memory leaks in long-running processes by purging throttle maps.
setInterval(() => {
  interactionThrottle.clear();
  lastEventTime.clear();
}, 60000);

const normalizeRole = (accountType) =>
  accountType === "Instructor" || accountType === "instructor"
    ? "instructor"
    : "student";


const canEditBoard = (socket) => {
  if (socket.data.role === "instructor") return true;
  const ctrl = sessionControls[socket.data.roomId];
  return Boolean(ctrl?.boardEditors.has(socket.data.userId));
};

const persistPollResults = async (roomId, sessionId) => {
  const pollData = roomPolls.get(roomId);
  if (!pollData?.activePoll) return;

  const { question, options, votes } = pollData.activePoll;
  const tally = {};
  options.forEach((opt) => {
    tally[opt] = 0;
  });
  Object.values(votes).forEach((v) => {
    tally[v] = (tally[v] || 0) + 1;
  });

  try {
    await PollResult.create({
      sessionId,
      roomId,
      pollId: pollData.activePoll.id,
      question,
      options,
      tally,
      totalVotes: Object.keys(votes).length,
    });
    console.log(`📊 Poll persisted for room ${roomId}`);
  } catch (err) {
    console.error("Poll persistence failed:", err.message);
  }
};

const endSession = async (roomId, courseId = null, reason = "manual") => {
  if (!roomId) return;

  // 1. Idempotency Lock (In-Memory)
  const sid = roomSessionMap.get(roomId);
  if (sid && endingSessions.has(sid)) return;
  if (sid) endingSessions.add(sid);

  try {
    // 2. Fallback Emit for Orphan Rooms (Memory cleanup only)
    if (!sid) {
      console.warn(`🧹 Session ${roomId} orphan room cleanup (reason: ${reason})`);
      io.to(roomId).emit("SESSION_ENDED");
      
      // Cleanup room-scoped maps
      roomParticipants.delete(roomId);
      delete sessionControls[roomId];
      roomBoardStates.delete(roomId);
      roomPolls.delete(roomId);
      roomPinnedMessages.delete(roomId);
      roomClosedPollResults.delete(roomId);
      roomBoardVersions.delete(roomId);
      roomSessionMap.delete(roomId);
      
      if (pollTimers.has(roomId)) {
        clearTimeout(pollTimers.get(roomId));
        pollTimers.delete(roomId);
      }
      if (instructorDisconnectTimers.has(roomId)) {
        clearTimeout(instructorDisconnectTimers.get(roomId));
        instructorDisconnectTimers.delete(roomId);
      }

      // Fix: Ensure the orphaned record in DB is actually marked as ended 
      // otherwise reconciliation will keep finding it forever.
      await LiveSession.findOneAndUpdate(
        { liveRoomId: roomId, status: "active" },
        { status: "ended", endedAt: new Date(), endedReason: reason }
      );
      
      return;
    };

    const sessionRecord = await LiveSession.findById(sid);

    // [Observability] Track session finalization performance
    console.time(`🏁 endSession-${sid}`);

    // 3. Atomic Mark Ended (Bug 1 Safeguard)
    // Ensures only the first caller flushes metrics/updates status
    const session = await LiveSession.findOneAndUpdate(
      { _id: sid, status: { $ne: "ended" } },
      {
        status: "ended",
        endedAt: new Date(),
        endedReason: reason,
      },
      { new: true }
    );

    const isFirstTerminator = !!session;

    // 4. Always Flush Metrics (Only for first terminator)
    const cache = liveCache.get(sid);
    if (isFirstTerminator && cache) {
      const sessionStart = session?.startedAt || sessionRecord?.startedAt;
      const durationSec  = sessionStart ? Math.floor((Date.now() - new Date(sessionStart)) / 1000) : 1;
      
      // 4.1 Force-Finalize Attendance for all active participants (Bug 11 Fix)
      // Ensures stars like Alpha get credited for their time until the very end
      if (cache?.activeSockets) {
        const activeUserIds = Array.from(cache.activeSockets.keys());
        if (activeUserIds.length > 0) {
            const activeDocs = await LiveAttendance.find({ 
                sessionId: sid, 
                userId: { $in: activeUserIds } 
            });

            const finalizeOps = activeDocs.map(att => {
                const lastSeen = att.lastSeenAt ? new Date(att.lastSeenAt).getTime() : att.joinedAt ? new Date(att.joinedAt).getTime() : now.getTime();
                const delta = Math.floor((now.getTime() - lastSeen) / 1000);
                return {
                    updateOne: {
                        filter: { _id: att._id },
                        update: { 
                            $inc: { activeSeconds: Math.max(0, delta) },
                            $set: { lastSeenAt: now, status: "left", leftAt: now }
                        }
                    }
                };
            });

            if (finalizeOps.length > 0) {
                await LiveAttendance.bulkWrite(finalizeOps);
                console.log(`📡 Finalized attendance for ${finalizeOps.length} active participants.`);
            }
        }
      }

      // 4.1 Attendance Classification & Advanced Stats
      const attendances = await LiveAttendance.find({ sessionId: sid });
      let activeCount = 0;
      let passiveCount = 0;
      let dropoffCount = 0;
      let lateCount = 0;
      let unstableCount = 0;

      const bulkOps = attendances.map(att => {
        const ratio = att.activeSeconds / durationSec;
        let status = "dropoff";

        if (att.activeSeconds >= 30) {
          if (ratio >= 0.6) { status = "active"; activeCount++; }
          else if (ratio >= 0.2) { status = "passive"; passiveCount++; }
          else { dropoffCount++; }
        } else {
          dropoffCount++;
        }

        // [Production Hardening] Derive engagement score based on confirmed breakdown
        const b = att.engagementBreakdown || {};
        const calculatedScore = 
          (b.chat || 0) * 1 +
          (b.polls || 0) * 2 +
          (b.board || 0) * 2 +
          (b.hands || 0) * 2;

        // Late join detection (> 5 min)
        const joinTime = att.joinedAt ? new Date(att.joinedAt).getTime() : 0;
        const startTime = sessionStart ? new Date(sessionStart).getTime() : 0;
        if (joinTime - startTime > 5 * 60 * 1000) lateCount++;

        // Unstable detection
        if (att.rejoinCount > 3) unstableCount++;

        return {
          updateOne: {
            filter: { _id: att._id },
            update: { $set: { 
              attendanceStatus: status,
              engagementScore: calculatedScore 
            } }
          }
        };
      });

      if (bulkOps.length > 0) await LiveAttendance.bulkWrite(bulkOps);

      // 4.2 Timeline Transformation (Memory -> Array)
      // Safe non-mutating transformation
      const sortedTimeline = Array.from(cache.timeline?.values() || [])
        .sort((a, b) => a.minute - b.minute)
        .map(b => ({
          minute: b.minute,
          chat:   b.chat,
          polls:  b.polls,
          board:  b.board,
          hands:  b.hands,
          active: b.activeUsersSet?.size || 0
        }));

      // 4.3 Ranked Insight Generation
      const insights = [];
      const totalStudents = attendances.length || 1;
      
      if (dropoffCount / totalStudents > 0.3) insights.push({ level: "high", msg: "High drop-off detected mid-session" });
      if (unstableCount / totalStudents > 0.2) insights.push({ level: "high", msg: "Many students faced connection instability" });
      if (cache.pollResponses === 0 && cache.messages > 10) insights.push({ level: "medium", msg: "Low poll participation despite active chat" });
      if (cache.boardDraws > 50) insights.push({ level: "low", msg: "Strong visual engagement via whiteboard" });
      if (lateCount / totalStudents > 0.2) insights.push({ level: "low", msg: "Significant number of late joiners" });

      const finalInsights = insights.sort((a, b) => {
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.level] - priority[b.level];
      }).slice(0, 3);

      // 4.4 Top Participants Summary
      const topStudents = attendances
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 5)
        .map(a => ({
          userId: a.userId,
          score:  a.engagementScore,
          activeMinutes: Math.round(a.activeSeconds / 60)
        }));

      // 4.5 Persist Final Summary Cache
      await LiveSession.findByIdAndUpdate(sid, {
        presentStudents: totalStudents,
        messages: cache.messages || 0,
        pollResponses: cache.pollResponses || 0,
        boardDraws: cache.boardDraws || 0,
        raisedHands: cache.raisedHands || 0,
        engagementTimeline: sortedTimeline,
        summaryCache: {
          activeCount,
          passiveCount,
          dropoffCount,
          lateJoiners:  lateCount,
          unstableCount,
          insights:     finalInsights,
          topParticipants: topStudents,
          raisedHands:  cache.raisedHands || 0
        }
      });
      console.log(`📊 Session ${sid} advanced metrics flushed. endedReason=${reason}`);
    }

    // 4.1 Persistence: Active Poll (if any)
    if (isFirstTerminator) {
      await persistPollResults(roomId, sid);
    }

    // 5. Update Course Status (Centralized source of truth)
    if (isFirstTerminator && courseId) {
       await Course.findByIdAndUpdate(courseId, {
         isLive: false,
         liveRoomId: null,
         lastHeartbeatAt: null,
         liveStartedAt: null
       });
       console.log(`🏁 Course ${courseId} marked as NOT LIVE in DB.`);
    }

    // 6. Board Persistence (Only for first terminator)
    const strokes = roomBoardStates.get(roomId) || [];
    if (isFirstTerminator && strokes.length > 0 && courseId) {
      try {
        // Use LiveSession's startedAt for duration (fix Bug 6)
        const sessionStart = session?.startedAt || sessionRecord?.startedAt;
        const duration = sessionStart 
          ? Math.floor((Date.now() - new Date(sessionStart)) / 1000)
          : null;

        await BoardSession.create({
          sessionId: roomId,
          courseId: courseId,
          instructorId: session?.instructorId || sessionRecord?.instructorId,
          strokes: strokes,
          strokeCount: strokes.length,
          duration: duration,
          startedAt: sessionStart,
          endedAt: new Date(),
        });
        console.log(`📦 Board session saved to DB for ${roomId}`);
      } catch (boardErr) {
        console.error("Board persistence failed, continuing cleanup:", boardErr.message);
      }
    }

    // 7. Cleanup All State (Always happens, even for secondary terminators)
    roomParticipants.delete(roomId);
    delete sessionControls[roomId];
    roomBoardStates.delete(roomId);
    roomPolls.delete(roomId);
    roomPinnedMessages.delete(roomId);
    roomClosedPollResults.delete(roomId);
    roomBoardVersions.delete(roomId);
    
    if (pollTimers.has(roomId)) {
      clearTimeout(pollTimers.get(roomId));
      pollTimers.delete(roomId);
    }

    liveCache.delete(sid);
    roomSessionMap.delete(roomId);

    if (sessionMetricsIntervals.has(sid)) {
      clearInterval(sessionMetricsIntervals.get(sid));
      sessionMetricsIntervals.delete(sid);
    }

    if (instructorDisconnectTimers.has(roomId)) {
      clearTimeout(instructorDisconnectTimers.get(roomId));
      instructorDisconnectTimers.delete(roomId);
    }

    // 8. Authoritative Final Emit (Last Step — Ensures UI closure)
    io.to(roomId).emit("SESSION_ENDED");
    console.log(`📡 SESSION_ENDED broadcast for room ${roomId} (Terminator: ${isFirstTerminator})`);

    // 9. Log system event
    if (isFirstTerminator && courseId) {
      logEvent({
        sessionId: sid,
        courseId,
        userId: null,
        type: "system",
        meta: { action: "session_ended", targetUserId: null, value: reason },
      }).catch((err) => console.error("System event log failed:", err.message));
    }
    console.log(`🧹 Session ${roomId} cleaned up (reason: ${reason}).`);

  } catch (err) {
    console.error(`❌ endSession Error [${roomId}]:`, err.message);
  } finally {
    if (sid) endingSessions.delete(sid);
  }
};


// ─── Centralized event logger with validation guard ───────────────────────────
// Fire-and-forget: NEVER await logEvent in a hot path.
// Throttling for interaction logs to prevent DB flooding (e.g. chat storm).

const logEvent = (data) => {
  if (!data?.meta?.action) {
    console.warn("logEvent: missing meta.action, skipping log.", data);
    return Promise.resolve();
  }

  // Throttling for high-frequency interactions (max 1 per 5s per user per action)
  const interactionTypes = ["message", "board_draw", "raise_hand", "poll_vote"];
  if (interactionTypes.includes(data.type) && data.userId && data.sessionId) {
    const key = `${data.sessionId}_${data.userId}_${data.type}`;
    const now = Date.now();
    const last = interactionThrottle.get(key) || 0;
    if (now - last < 5000) return Promise.resolve(); 
    interactionThrottle.set(key, now);
    setTimeout(() => interactionThrottle.delete(key), 60000);
  }

  return LiveEvent.create({
    ...data,
    sessionId: data.sessionId ? new mongoose.Types.ObjectId(String(data.sessionId)) : null,
    userId: data.userId ? new mongoose.Types.ObjectId(String(data.userId)) : null,
  });
};

const emitParticipants = (roomId) => {
  // Build the participant list fresh from sessionControls so permissions are always current
  const ctrl = sessionControls[roomId];
  const participants = Array.from((roomParticipants.get(roomId) || new Map()).values()).map((p) => ({
    ...p,
    permissions: getPermissionsSnapshot(roomId, p.userId, p.role),
  }));
  io.to(roomId).emit("participants-updated", participants);
};

// [Infinite Scaling] Per-Session Telemetry Buffer Flush Daemon
// Runs every 10 seconds to flush all in-memory interaction tallies to DB
setInterval(async () => {
  if (liveCache.size === 0) return;

  const flushOps = [];
  const now = new Date();

  for (const [sid, cache] of liveCache.entries()) {
    if (!cache.engagementBuffer || cache.engagementBuffer.size === 0) continue;

    for (const [userId, breakdown] of cache.engagementBuffer.entries()) {
      // Build atomic increment object
      const inc = {};
      Object.keys(breakdown).forEach(key => {
        inc[`engagementBreakdown.${key}`] = breakdown[key];
      });

      flushOps.push({
        updateOne: {
          filter: { sessionId: new mongoose.Types.ObjectId(sid), userId: new mongoose.Types.ObjectId(userId) },
          update: { 
            $inc: inc,
            $set: { lastSeenAt: now }
          }
        }
      });
    }
    // Clear buffer after capturing ops
    cache.engagementBuffer.clear();
  }

  if (flushOps.length > 0) {
    try {
      const start = Date.now();
      await LiveAttendance.bulkWrite(flushOps, { ordered: false });
      if (process.env.NODE_ENV !== "production") {
        console.log(`📦 Scalability Engine: Flushed ${flushOps.length} interaction tallies to DB in ${Date.now() - start}ms`);
      }
    } catch (err) {
      console.error("Scalability Engine: Flush failed", err.message);
    }
  }
}, 10000);

// ─── Phase 4: Production Analytics Helper ────────────────────────────────────
const recordInteraction = (socket, type) => {
  let sid = socket.data.sessionId?.toString();
  const userId = socket.data.userId;

  // Final Hardening: Telemetry Safety Guard
  // If join-room is still resolving sessionId (async DB), retry once after 500ms
  if (!sid && userId) {
    setTimeout(() => recordInteraction(socket, type), 500);
    return;
  }

  if (!userId || !sid) return;

  // [Production Hardening] Write Throttling (Applies to Buffer too for client sanity)
  const throttleKey = `${sid}_${userId}_${type}`;
  if (interactionThrottle.has(throttleKey)) return;

  interactionThrottle.set(throttleKey, true);
  setTimeout(() => interactionThrottle.delete(throttleKey), 2000);

  // 1. Snapshot for Engagement Timeline
  const cache = liveCache.get(sid);
  if (!cache) return;

  // 1. Timeline Tracking (Bucket by minute)
  const sessionStart = cache.startedAt || Date.now();
  const minute = Math.floor((Date.now() - sessionStart) / 60000);
  
  if (!cache.timeline) cache.timeline = new Map();
  if (!cache.timeline.has(minute)) {
    cache.timeline.set(minute, {
      minute,
      chat: 0,
      polls: 0,
      board: 0,
      hands: 0,
      activeUsersSet: new Set()
    });
  }
  
  const bucket = cache.timeline.get(minute);
  bucket[type] = (bucket[type] || 0) + 1;
  bucket.activeUsersSet.add(userId);

  // 2. Memory-First Scaling Engine (REPLACES real-time DB writes)
  if (!cache.engagementBuffer) cache.engagementBuffer = new Map();
  if (!cache.engagementBuffer.has(userId)) {
    cache.engagementBuffer.set(userId, { chat:0, polls:0, board:0, hands:0 });
  }
  const userBuffer = cache.engagementBuffer.get(userId);
  userBuffer[type] = (userBuffer[type] || 0) + 1;

  // Global increment for cache summary too
  if (type === "chat") cache.messages = (cache.messages || 0) + 1;
  if (type === "polls") cache.pollResponses = (cache.pollResponses || 0) + 1;
  if (type === "board") cache.boardDraws = (cache.boardDraws || 0) + 1;
  if (type === "hands") cache.raisedHands = (cache.raisedHands || 0) + 1;
};


// Now that endSession is defined, expose it for controllers (e.g. endLiveClass)
app.set("endSession", endSession);

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // #region agent log
  socket.on("disconnecting", (reason) => {
    try {
      const d = socket.data || {};
      agentNdjsonLog({
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "backend/server.js:disconnecting",
        message: "socket disconnecting",
        data: {
          socketId: socket.id,
          reason,
          roomId: d.roomId,
          role: d.role,
          userId: d.userId,
          sessionId: d.sessionId ? String(d.sessionId) : null,
          hasGraceTimer: d.roomId ? instructorDisconnectTimers.has(d.roomId) : null,
        },
        timestamp: Date.now(),
      });
      (typeof fetch === "function"
        ? fetch("http://127.0.0.1:7297/ingest/2e9fa13e-90a3-428f-9323-6c1de32a1d69", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ecb98" },
            body: JSON.stringify({
              sessionId: "2ecb98",
              runId: "pre-fix",
              hypothesisId: "H1",
              location: "backend/server.js:disconnecting",
              message: "socket disconnecting",
              data: {
                socketId: socket.id,
                reason,
                roomId: d.roomId,
                role: d.role,
                userId: d.userId,
                sessionId: d.sessionId ? String(d.sessionId) : null,
                hasGraceTimer: d.roomId ? instructorDisconnectTimers.has(d.roomId) : null,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
        : null);
    } catch (_) {}
  });
  // #endregion agent log

  socket.on("join-room", async ({ roomId, token: authToken, name }) => {
    const joinStartedAt = Date.now();
    const joinLog = (step, extra = {}) => {
      console.log("[LiveClass Socket]", {
        step,
        socketId: socket.id,
        roomId,
        userId: socket.data?.userId,
        role: socket.data?.role,
        elapsedMs: Date.now() - joinStartedAt,
        ...extra,
      });
    };

    joinLog("join-room:received", {
      hasRoomId: Boolean(roomId),
      hasToken: Boolean(authToken),
      tokenLength: authToken?.length || 0,
      name,
    });
    if (!roomId || !authToken) {
      console.warn("join-room ignored: missing roomId or token", {
        socketId: socket.id,
        roomId,
      });
      socket.emit("room-join-error", {
        message: !roomId ? "Room id missing." : "Login token missing.",
      });
      return;
    }

    let userId, role, isInstructor, isStudent, course;
    try {
      if (!authToken) {
        console.error(`🛑 join-room rejected: Token missing for socket ${socket.id}`);
        return socket.emit("room-join-error", { message: "Token missing" });
      }
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
      userId = decoded.id?.toString();
      role = normalizeRole(decoded.accountType);
      joinLog("join-room:jwt-verified", {
        decodedUserId: userId,
        accountType: decoded.accountType,
        normalizedRole: role,
      });

      course = await Course.findOne({ liveRoomId: roomId, isLive: true }).select(
        "instructor studentsEnrolled"
      );

      if (!course) {
        joinLog("join-room:no-active-course");
        socket.emit("room-join-error", {
          message: "This live class is not active or does not exist.",
        });
        return;
      }

      isInstructor = course.instructor.toString() === userId;
      isStudent = course.studentsEnrolled.some(
        (id) => id.toString() === userId
      );
      joinLog("join-room:course-authorized-check", {
        courseId: course._id?.toString(),
        isInstructor,
        isStudent,
        enrolledCount: course.studentsEnrolled?.length || 0,
      });

      if (!isInstructor && !isStudent) {
        joinLog("join-room:not-authorized");
        socket.emit("room-join-error", {
          message: "You are not authorized to join this live class.",
        });
        return;
      }
    } catch (err) {
      console.error(`🛑 join-room rejected: ${err.message} (Socket: ${socket.id}, Token length: ${authToken?.length})`);
      socket.emit("room-join-error", {
        message: "You are not authorized to join this live class.",
      });
      return;
    }

    // Normalized role (force lowercase for consistent permission checks)
    const serverRole = isInstructor ? "instructor" : role.toLowerCase();
    socket.join(roomId);
    joinLog("join-room:socket-joined", { serverRole });

    // Phase 3: Resolve LiveSession to get sessionId (ObjectId)
    let sessionId = null;
    try {
      // Robustness: retry lookup if not immediately found (avoid race with /start commit)
      // Upgraded to 10 attempts (5s total) to cover potential DB index delay
      let liveSession = await LiveSession.findOne({ liveRoomId: roomId, status: "active" });
      if (!liveSession) {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          liveSession = await LiveSession.findOne({ liveRoomId: roomId, status: "active" });
          if (liveSession) break;
        }
      }

        if (liveSession) {
          sessionId = liveSession._id;
          const sid = sessionId.toString();
          joinLog("join-room:live-session-found", { sessionId: sid });

          // ── Register roomId→sessionId mapping ──────────────────────────────────
          roomSessionMap.set(roomId, sid);

          // ── Cancel instructor disconnect grace timer on reconnect ─────────────
          if (serverRole === "instructor" && instructorDisconnectTimers.has(roomId)) {
            clearTimeout(instructorDisconnectTimers.get(roomId));
            instructorDisconnectTimers.delete(roomId);
            console.log(`👨‍🏫 Instructor reconnected, grace timer cancelled for ${roomId}`);
            // #region agent log
            agentNdjsonLog({
              runId: "pre-fix",
              hypothesisId: "H2",
              location: "backend/server.js:grace-cancel",
              message: "instructor grace timer cancelled on join-room",
              data: { roomId, socketId: socket.id, userId, sessionId: sid },
              timestamp: Date.now(),
            });
            (typeof fetch === "function"
              ? fetch("http://127.0.0.1:7297/ingest/2e9fa13e-90a3-428f-9323-6c1de32a1d69", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ecb98" },
                  body: JSON.stringify({
                    sessionId: "2ecb98",
                    runId: "pre-fix",
                    hypothesisId: "H2",
                    location: "backend/server.js:grace-cancel",
                    message: "instructor grace timer cancelled on join-room",
                    data: { roomId, socketId: socket.id, userId, sessionId: sid },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {})
              : null);
            // #endregion agent log
          }

          // Set socket.data ATOMICALLY before any handshake
          // [Fix] Including name to prevent "User" fallback on whiteboard/chat
          socket.data = { 
            userId, 
            role: serverRole, 
            roomId, 
            courseId: course._id, 
            sessionId,
            name: name || "User"
          };

          // Init liveCache for this session if not present
          if (!liveCache.has(sid)) {
            liveCache.set(sid, {
              sessionId,
              roomId,
              startedAt: liveSession.startedAt ? new Date(liveSession.startedAt).getTime() : Date.now(),
              expectedStudents: liveSession.expectedStudents || 0,
              activeStudents: 0,
              activeSockets: new Map(), // Map<userId, Set<socketId>>
              raisedHands: 0,
              messages: 0,
              pollResponses: 0,
              boardDraws: 0,
              timeline: new Map(), // Map<minute, {minute, chat, polls, board, hands, activeUsersSet}>
              engagementBuffer: new Map(), // Map<userId, {chat, polls, board, hands}>
            });
          }

          const cache = liveCache.get(sid);

          // ── Stale Socket Cleanup (Safeguard) ──────────────────────────────
          // Ensure this socket.id is removed from any previous sets in this session
          if (cache?.activeSockets) {
            for (const [uid, set] of cache.activeSockets.entries()) {
              if (set.has(socket.id)) set.delete(socket.id);
            }
          }

          // Only track student attendance (not instructor)
          if (serverRole !== "instructor" && cache) {
            // Tab-Lock Tracking: Ensure unique user count
            if (!cache.activeSockets.has(userId)) {
              cache.activeSockets.set(userId, new Set());
            }

            const userSockets = cache.activeSockets.get(userId);
            // Clean dead sockets (important for accurate unique counting during refreshes)
            for (const sId of userSockets) {
              if (!io.sockets.sockets.has(sId)) {
                userSockets.delete(sId);
              }
            }

            userSockets.add(socket.id);
            cache.activeStudents = cache.activeSockets.size;

            // ── Race-Safe Attendance Registration (Atomic Upsert) ───────────────
            // $setOnInsert ensuring we set standard fields only on first join
            // $inc for rejoinCount to track platform reliability
            await LiveAttendance.updateOne(
              { sessionId, userId: new mongoose.Types.ObjectId(userId) },
              {
                $setOnInsert: {
                  joinedAt: new Date(),
                  courseId: course._id,
                },
                $set: {
                  lastSeenAt: new Date(),
                  status: "present"
                },
                $inc: { rejoinCount: 1 }
              },
              { upsert: true }
            );
          }
        } else {
          joinLog("join-room:no-live-session");
          console.warn(`⚠️ Analytics Warning: No active LiveSession found for Room ${roomId} after 5s. Telemetry will be lost.`);
        }
      } catch (analyticsErr) {
        joinLog("join-room:analytics-error", { message: analyticsErr.message });
        console.warn("Phase 3 join analytics error:", analyticsErr.message);
      }

    // socket.data fallback if sessionId resolution failed or stalled
    if (!socket.data || !socket.data.role) {
      socket.data = { ...socket.data, userId, role: serverRole, roomId, courseId: course._id, sessionId };
    }

      // Init sessionControls for this room (idempotent)
      initSessionControls(roomId);
      const ctrl = sessionControls[roomId];

      // Apply global mute to new student joiners
      if (serverRole !== "instructor" && ctrl.globalMute) {
        ctrl.mutedUsers.add(userId);
      }

      roomParticipants.set(
        roomId,
        (roomParticipants.get(roomId) || new Map()).set(userId, {
          userId,
          name: name || "User",
          role: serverRole,
          socketId: socket.id,
        })
      );

      // INITIAL_PERMISSIONS: send authoritative snapshot to the joining socket
      const snap = getPermissionsSnapshot(roomId, userId, serverRole);
      socket.emit("INITIAL_PERMISSIONS", snap);
      socket.emit("permissions-updated", snap);
      
      // ── Handshake Phase 2: Handshake Success (Sync Protocol) ──────────────────
      // This event tells the client that the join is successful AND 
      // authoritative. It includes the role assigned by the server.
      socket.emit("ROOM_JOIN_SUCCESS", {
        role: serverRole,
        permissions: snap,
        sessionId: socket.data.sessionId,
        courseId: socket.data.courseId
      });
      joinLog("join-room:success-emitted", {
        permissions: snap,
        participants: roomParticipants.get(roomId)?.size || 0,
        sessionId: socket.data.sessionId?.toString?.() || null,
        courseId: socket.data.courseId?.toString?.() || null,
      });

      emitParticipants(roomId);

      // Sync board state to newcomer
      socket.emit("BOARD_STATE", roomBoardStates.get(roomId) || []);


      // Sync poll state
      const pollData = roomPolls.get(roomId);
      if (pollData?.activePoll) {
        socket.emit("poll-created", {
          id: pollData.activePoll.id,
          question: pollData.activePoll.question,
          options: pollData.activePoll.options,
        });

        const votes = pollData.activePoll.votes;
        const tally = {};
        pollData.activePoll.options.forEach(opt => tally[opt] = 0);
        Object.values(votes).forEach(v => tally[v] = (tally[v] || 0) + 1);

        socket.emit("poll-voted", {
          pollId: pollData.activePoll.id,
          tally,
          totalVotes: Object.keys(votes).length,
        });
      } else if (roomClosedPollResults.has(roomId)) {
        // Sync last closed poll result
        socket.emit("poll-closed", roomClosedPollResults.get(roomId));
      }

      // Final Handshake: Tell client we are fully linked, synced and ready for telemetry
      const finalSid = sessionId || socket.data.sessionId;
      if (finalSid) {
        socket.emit("SESSION_READY", { sessionId: String(finalSid) });
        joinLog("join-room:session-ready", { sessionId: String(finalSid) });
      } else {
        joinLog("join-room:session-ready-skipped");
      }

      // Sync pinned message
      if (roomPinnedMessages.has(roomId)) {
        socket.emit("message-pinned", roomPinnedMessages.get(roomId));
      }

      socket.on("request-board-state", () => {
        socket.emit("BOARD_STATE", roomBoardStates.get(roomId) || []);
      });

      socket.on("request-poll-state", () => {
         const pollData = roomPolls.get(roomId);
         if (pollData?.activePoll) {
           socket.emit("poll-created", {
             id: pollData.activePoll.id,
             question: pollData.activePoll.question,
             options: pollData.activePoll.options,
           });
           
           const votes = pollData.activePoll.votes;
           const tally = {};
           pollData.activePoll.options.forEach(opt => tally[opt] = 0);
           Object.values(votes).forEach(v => tally[v] = (tally[v] || 0) + 1);

           socket.emit("poll-voted", {
             pollId: pollData.activePoll.id,
             tally,
             totalVotes: Object.keys(votes).length,
           });
         } else if (roomClosedPollResults.has(roomId)) {
           socket.emit("poll-closed", roomClosedPollResults.get(roomId));
         }
      });

      // Pinned message sync already happened above

      console.log(`👤 ${userId} joined room ${roomId} as ${serverRole}`);

      // Phase 3: Initialize metrics broadcaster if this is the instructor
      if (serverRole === "instructor") {
        initSessionMetricsBroadcaster();
      }
  });

  // Phase 3: Student heartbeat — updates lastSeenAt + activeSeconds in DB
  socket.on("heartbeat", async () => {
    const { sessionId, userId, role } = socket.data || {};
    if (!sessionId || !userId || role === "instructor") return;
    try {
      // Use accurate time-based delta instead of a fixed +30 estimate
      const now = Date.now();
      const attendance = await LiveAttendance.findOne({ sessionId, userId });
      if (attendance) {
        const lastSeen = attendance.lastSeenAt ? new Date(attendance.lastSeenAt).getTime() : now;
        const delta = Math.min(Math.floor((now - lastSeen) / 1000), 300); // cap at 5 min for large gaps
        attendance.activeSeconds = (attendance.activeSeconds || 0) + delta;
        attendance.lastSeenAt = new Date(now);
        await attendance.save();
      }
    } catch (err) {
      console.warn("Heartbeat analytics error:", err.message);
    }
  });

  // Phase 3: Session-wide metrics broadcaster (1s interval per session, NOT per socket)
  // Prevents duplicate emissions on instructor refresh/reconnect
  const initSessionMetricsBroadcaster = () => {
    const { sessionId, roomId, role } = socket.data || {};
    if (!sessionId || !roomId || role !== "instructor") return;
    
    const sid = String(sessionId);
    if (!sessionMetricsIntervals.has(sid)) {
      console.log(`📡 Starting metrics broadcaster for session ${sid}`);
      const interval = setInterval(() => {
        const cache = liveCache.get(sid);
        if (cache) {
          io.to(roomId).emit("live-metrics", cache);
        } else {
          // If no cache, this session probably ended; kill the interval
          clearInterval(sessionMetricsIntervals.get(sid));
          sessionMetricsIntervals.delete(sid);
        }
      }, 1000);
sessionMetricsIntervals.set(sid, interval);
}
};

// Since join-room is complex, I will put the call inside the join-room handler's end too.
// But for the per-socket cleanup, we no longer clearInterval(metricsInterval) because it's shared.

socket.on("raise-hand", ({ roomId, user }) => {
    if (!roomId || !user?.id) return;
    // Room-lock: reject events if session has already ended
    if (!roomParticipants.has(roomId)) return;

    io.to(roomId).emit("hand-raised", {
      user,
      timestamp: Date.now(),
    });

    logEvent({
      sessionId: socket.data.sessionId,
      courseId: socket.data.courseId,
      userId: socket.data.userId,
      type: "raise_hand",
      meta: { action: "raise_hand", targetUserId: null, value: true },
    }).catch((err) => console.error("Event log failed:", err.message));

    // Phase 4: record engagement
    recordInteraction(socket, "hands");
  });

  socket.on("lower-hand", ({ roomId, userId }) => {
    if (!roomId || !userId) return;
    if (!roomParticipants.has(roomId)) return;

    io.to(roomId).emit("hand-lowered", { userId });
  });

  socket.on("RESOLVE_HAND", ({ roomId, userId, name }) => {
     if (!roomId || !userId || socket.data.role !== "instructor") return;
     
     // 1. Grant Mic permission
     const ctrl = initSessionControls(roomId);
     ctrl.mutedUsers.delete(userId);
     
     // 2. Remove hand
     io.to(roomId).emit("hand-lowered", { userId });
     
     // 3. Notify
     io.to(roomId).emit("USER_UNMUTED", { userId });
     emitParticipants(roomId);
     
     console.log(`🎙️ Hand Resolved: Speaker granted to ${name} (${userId})`);
  });

  socket.on("DISMISS_HAND", ({ roomId, userId }) => {
     if (!roomId || !userId || socket.data.role !== "instructor") return;
     io.to(roomId).emit("hand-lowered", { userId });
  });

  socket.on("send-message", ({ roomId, message }, callback) => {
    if (!roomId || !message?.text) return;
    if (!roomParticipants.has(roomId)) return;
    
    const now = Date.now();
    const userId = socket.data.userId?.toString();
    const msgKey = `msg_${userId}`;
    if (now - (lastEventTime.get(msgKey) || 0) < 300) {
      if (callback) callback({ status: "error", message: "Rate limited" });
      return;
    }
    lastEventTime.set(msgKey, now);

    const allowedTypes = ["normal", "question", "important"];
    const msgType = allowedTypes.includes(message.type) ? message.type : "normal";

    const outgoing = {
      ...message,
      type: msgType,
      userId: socket.data.userId,
      timestamp: now,
      msgId: uuidv4(), // Unique ID for delivery tracking
    };

    io.to(roomId).emit("receive-message", outgoing);
    
    // Acknowledgement callback (Delivery confirmation)
    if (callback) callback({ status: "success", msgId: outgoing.msgId });

    logEvent({
      sessionId: socket.data.sessionId,
      courseId: socket.data.courseId,
      userId: socket.data.userId,
      type: "message",
      meta: { action: "chat_message", targetUserId: null, value: msgType },
    }).catch((err) => console.error("Event log failed:", err.message));
    
    // Phase 4: record engagement
    recordInteraction(socket, "chat");
  });

  // ─── PIN MESSAGE (Instructor only) ────────────────────────────────────────
  socket.on("pin-message", ({ roomId, message }) => {
    if (!roomId || !message) return;
    if (!roomParticipants.has(roomId)) return;
    if (socket.data.role !== "instructor") return;

    roomPinnedMessages.set(roomId, message);
    io.to(roomId).emit("message-pinned", message);
  });

  // ─── POLLS ────────────────────────────────────────────────────────────────
  socket.on("create-poll", ({ roomId, poll }) => {
    if (!roomId || !poll?.question || !Array.isArray(poll.options)) return;
    if (!roomParticipants.has(roomId)) return;
    if (socket.data.role !== "instructor") return; // only instructor can create

    if (roomPolls.get(roomId)?.activePoll) {
      socket.emit("room-join-error", { message: "Please close the active poll before creating a new one." });
      return;
    }

    const duration = poll.duration || 60; // 60s default
    const expiresAt = Date.now() + duration * 1000;

    const newPoll = {
      id: Date.now(),
      question: poll.question,
      options: poll.options.slice(0, 6), // max 6 options
      votes: {}, // userId → chosen option
      expiresAt,
    };

    roomPolls.set(roomId, { activePoll: newPoll });
    io.to(roomId).emit("poll-created", {
      id: newPoll.id,
      question: newPoll.question,
      options: newPoll.options,
      expiresAt,
    });

    // Auto-close poll after duration
    const timer = setTimeout(() => {
      // Re-fetch state to see if poll is still active
      const currentPollData = roomPolls.get(roomId);
      if (currentPollData?.activePoll?.id === newPoll.id) {
        // Trigger manual close logic
        const { options, votes } = currentPollData.activePoll;
        const finalTally = {};
        options.forEach(opt => { finalTally[opt] = 0; });
        Object.values(votes).forEach(v => { finalTally[v] = (finalTally[v] || 0) + 1; });
        
        roomClosedPollResults.set(roomId, { tally: finalTally, totalVotes: Object.keys(votes).length });
        roomPolls.delete(roomId);
        pollTimers.delete(roomId);
        io.to(roomId).emit("poll-closed", { tally: finalTally, totalVotes: Object.keys(votes).length });
      }
    }, duration * 1000);
    pollTimers.set(roomId, timer);

    logEvent({
      sessionId: socket.data.sessionId,
      courseId: socket.data.courseId,
      userId: socket.data.userId,
      type: "system",
      meta: { action: "poll_created", targetUserId: null, value: poll.question },
    }).catch((err) => console.error("Event log failed:", err.message));
  });

  socket.on("vote-poll", async ({ roomId, pollId, option }) => {
    if (!roomId || !pollId || !option) return;
    if (!roomParticipants.has(roomId)) return;

    const now = Date.now();
    const userId = socket.data.userId?.toString();
    const { courseId, sessionId } = socket.data;

    // Strict Security: Enrollment check
    const course = await Course.findById(courseId);
    if (!course || !course.studentsEnrolled.some(s => s.toString() === userId)) {
       return; // Unauthorized
    }

    const voteKey = `vote_${userId}`;
    if (now - (lastEventTime.get(voteKey) || 0) < 500) return;
    lastEventTime.set(voteKey, now);

    const pollData = roomPolls.get(roomId);
    const activePoll = pollData?.activePoll;
    if (!activePoll || activePoll.id !== pollId) return; 
    if (!activePoll.options.includes(option)) return; 

    // Integrity: Double voting check
    if (activePoll.votes[userId]) return;
    activePoll.votes[userId] = option;

    const tally = {};
    activePoll.options.forEach(opt => { tally[opt] = 0; });
    Object.values(activePoll.votes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });

    io.to(roomId).emit("poll-voted", { pollId, tally, totalVotes: Object.keys(activePoll.votes).length });

    logEvent({
      sessionId: socket.data.sessionId,
      courseId: socket.data.courseId,
      userId: socket.data.userId,
      type: "poll_vote",
      meta: { action: "poll_vote", targetUserId: null, value: option },
    }).catch((err) => console.error("Event log failed:", err.message));

    // Phase 4: record engagement
    recordInteraction(socket, "polls");
  });

  socket.on("close-poll", ({ roomId }) => {
    if (!roomId || socket.data.roomId !== roomId) return;
    if (!roomParticipants.has(roomId)) return;
    if (socket.data.role !== "instructor") return;

    // Broadcast final tally before closing
    const pollData = roomPolls.get(roomId);
    let finalPayload = { tally: {}, totalVotes: 0 };

    if (pollData?.activePoll) {
      const { options, votes, question } = pollData.activePoll;
      const finalTally = {};
      options.forEach(opt => { finalTally[opt] = 0; });
      Object.values(votes).forEach(v => { finalTally[v] = (finalTally[v] || 0) + 1; });
      finalPayload = { tally: finalTally, totalVotes: Object.keys(votes).length };
      
      // PERSIST TO DB
      persistPollResults(roomId, socket.data.sessionId).catch(e => console.error("Poll close persist failed:", e));
    }

    roomClosedPollResults.set(roomId, finalPayload);
    io.to(roomId).emit("poll-closed", finalPayload);

    roomPolls.delete(roomId);
    if (pollTimers.has(roomId)) {
      clearTimeout(pollTimers.get(roomId));
      pollTimers.delete(roomId);
    }
  });

  // ─── MUTE_USER / UNMUTE_USER ──────────────────────────────────────────────
  socket.on("MUTE_USER", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);

    ctrl.mutedUsers.add(userId);
    io.to(roomId).emit("USER_MUTED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "audio_toggle", targetUserId: userId, value: false } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  socket.on("UNMUTE_USER", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);

    ctrl.mutedUsers.delete(userId);
    io.to(roomId).emit("USER_UNMUTED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "audio_toggle", targetUserId: userId, value: true } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  // ─── VIDEO CONTROL ────────────────────────────────────────────────────────
  socket.on("ALLOW_VIDEO", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);

    ctrl.videoAllowed.add(userId);
    io.to(roomId).emit("VIDEO_ALLOWED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "video_toggle", targetUserId: userId, value: true } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  socket.on("REVOKE_VIDEO", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);

    ctrl.videoAllowed.delete(userId);
    io.to(roomId).emit("VIDEO_REVOKED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "video_toggle", targetUserId: userId, value: false } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  // ─── SCREEN SHARE CONTROL ─────────────────────────────────────────────────
  socket.on("ALLOW_SCREEN", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);

    ctrl.screenAllowed.add(userId);
    io.to(roomId).emit("SCREEN_ALLOWED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "screen_toggle", targetUserId: userId, value: true } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  socket.on("REVOKE_SCREEN", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);

    ctrl.screenAllowed.delete(userId);
    io.to(roomId).emit("SCREEN_REVOKED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "screen_toggle", targetUserId: userId, value: false } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  // ─── BOARD CONTROL ────────────────────────────────────────────────────────
  socket.on("ALLOW_BOARD", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);

    ctrl.boardEditors.add(userId);
    io.to(roomId).emit("BOARD_ALLOWED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "board_toggle", targetUserId: userId, value: true } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  socket.on("REVOKE_BOARD", ({ userId }) => {
    if (socket.data.role !== "instructor") return;
    const { roomId, courseId } = socket.data;
    if (!roomParticipants.has(roomId)) return;

    const ctrl = initSessionControls(roomId);
    ctrl.boardEditors.delete(userId);

    io.to(roomId).emit("BOARD_REVOKED", { userId });
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "board_toggle", targetUserId: userId, value: false } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  // ─── MUTE ALL / UNMUTE ALL ────────────────────────────────────────────────
  socket.on("mute-all", ({ roomId }) => {
    if (socket.data.role !== "instructor") return;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);
    const { courseId } = socket.data;

    ctrl.globalMute = true;
    (roomParticipants.get(roomId) || new Map()).forEach((p) => {
      if (p.role !== "instructor") ctrl.mutedUsers.add(p.userId);
    });

    io.to(roomId).emit("ALL_MUTED");
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "mute_all", targetUserId: null, value: true } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  socket.on("unmute-all", ({ roomId }) => {
    if (socket.data.role !== "instructor") return;
    if (!roomParticipants.has(roomId)) return;
    const ctrl = initSessionControls(roomId);
    const { courseId } = socket.data;

    ctrl.globalMute = false;
    ctrl.mutedUsers.clear();

    io.to(roomId).emit("ALL_UNMUTED");
    emitParticipants(roomId);
    logEvent({ sessionId: socket.data.sessionId, courseId, userId: socket.data.userId, type: "permission",
      meta: { action: "unmute_all", targetUserId: null, value: false } })
      .catch((err) => console.error("Event log failed:", err.message));
  });

  const isValidStroke = (s) => {
  if (!s || !s.from || !s.to || !s.tool) return false;
  if (
    typeof s.from.x !== "number" || typeof s.from.y !== "number" ||
    typeof s.to.x !== "number" || typeof s.to.y !== "number"
  ) return false;

  // Normalized range validation
  if (s.from.x < 0 || s.from.x > 1 || s.from.y < 0 || s.from.y > 1) return false;
  if (s.to.x < 0 || s.to.x > 1 || s.to.y < 0 || s.to.y > 1) return false;

  // Tool validation
  if (!["pen", "eraser"].includes(s.tool.type)) return false;
  if (typeof s.tool.size !== "number" || s.tool.size < 1 || s.tool.size > 50) return false;
  
  return true;
};

const broadcastBoardStroke = async (socket, { roomId, stroke }) => {
    if (!roomId || !stroke || socket.data.roomId !== roomId) return;
    if (!canEditBoard(socket)) return;
    if (!isValidStroke(stroke)) return;

    // Rate-limit: max 1 draw event per 30ms per socket (canvas throttle)
    const now = Date.now();
    const drawKey = `draw_${socket.id}`;
    if (now - (lastEventTime.get(drawKey) || 0) < 30) return;
    lastEventTime.set(drawKey, now);

    // Attach user ID and metadata for granular undo tracking
    stroke.userId = socket.data.userId;
    stroke.userName = socket.data.name || "User";
    stroke.timestamp = Date.now();

    // Broadcast to ALL (including sender, but sender uses strokeId to dedupe locally)
    io.to(roomId).emit("draw-update", stroke);

    // Save to history with strict limit and reference integrity (Correction 1)
    if (!roomBoardStates.has(roomId)) {
      roomBoardStates.set(roomId, []);
      roomBoardVersions.set(roomId, { version: 0, lastUndoAt: 0 });
    }
    const board = roomBoardStates.get(roomId);
    const versionObj = roomBoardVersions.get(roomId);

    // Atomic limit enforcement
    while (board.length >= MAX_STROKES) {
      board.shift();
    }
    board.push(stroke);
    versionObj.version += 1;

    // Log board draw activity (sampled)
    logEvent({
      sessionId: socket.data.sessionId,
      courseId: socket.data.courseId,
      userId: socket.data.userId,
      type: "board_draw",
      meta: { action: "board_draw", targetUserId: null, value: true },
    }).catch((err) => console.error("Event log failed:", err.message));

    // Phase 4: record engagement
    recordInteraction(socket, "board");
  };

  socket.on("board-draw-batch", ({ roomId, strokes }) => {
    if (!roomId || !Array.isArray(strokes) || socket.data.roomId !== roomId) {
      console.warn("[LiveClass Board] rejected batch: invalid room/payload", {
        socketId: socket.id,
        requestedRoomId: roomId,
        socketRoomId: socket.data.roomId,
        strokeCount: Array.isArray(strokes) ? strokes.length : null,
      });
      return;
    }
    if (!roomParticipants.has(roomId) || !canEditBoard(socket)) {
      console.warn("[LiveClass Board] rejected batch: no room or no edit permission", {
        socketId: socket.id,
        roomId,
        role: socket.data.role,
        userId: socket.data.userId,
        hasRoom: roomParticipants.has(roomId),
        canEdit: canEditBoard(socket),
      });
      return;
    }

    // Rigorous Validation (Correction 4/5)
    const validStrokes = strokes.filter(isValidStroke).slice(0, 100);
    if (validStrokes.length === 0) {
      console.warn("[LiveClass Board] rejected batch: no valid strokes", {
        socketId: socket.id,
        roomId,
        received: strokes.length,
        sample: strokes[0],
      });
      return;
    }

    if (!roomBoardStates.has(roomId)) {
      roomBoardStates.set(roomId, []);
      roomBoardVersions.set(roomId, { version: 0, lastUndoAt: 0 });
    }
    
    const board = roomBoardStates.get(roomId);
    const versionObj = roomBoardVersions.get(roomId);
    
    // Add to state with strict limit enforcement
    validStrokes.forEach(s => {
      s.userId = socket.data.userId;
      s.userName = socket.data.name || "User";
      
      while (board.length >= MAX_STROKES) {
        board.shift();
      }
      board.push(s);
    });
    versionObj.version += 1;

    // Broadcast batch to OTHERS (sender renders locally)
    socket.to(roomId).emit("draw-update-batch", validStrokes);

    // Sample logging for the batch
    logEvent({
      sessionId: socket.data.sessionId,
      courseId: socket.data.courseId,
      userId: socket.data.userId,
      type: "board_draw",
      meta: { action: "board_draw_batch", count: validStrokes.length },
    }).catch((err) => console.error("Event log failed:", err.message));

    // Phase 4: record engagement
    recordInteraction(socket, "board");
  });

  socket.on("draw", (data) => broadcastBoardStroke(socket, data));
  socket.on("board-draw", (data) => broadcastBoardStroke(socket, data));

  // --- Real-time User Presence (Cursors) ---
  socket.on("CURSOR_MOVE", ({ roomId, x, y }) => {
    if (!roomId) return;
    // Broadcast only to OTHERS (sender renders locally if needed, but here it's for teammates)
    socket.to(roomId).emit("CURSOR_MOVE", {
      userId: socket.data.userId,
      name: socket.data.name || socket.data.userId?.substring(0,5) || "User",
      x,
      y
    });
  });

  socket.on("board-clear", ({ roomId }) => {
  if (!roomId || socket.data.roomId !== roomId) return;
  if (!roomParticipants.has(roomId)) return;
  if (socket.data.role !== "instructor") return;

  roomBoardStates.set(roomId, []);
  // Reset board version on clear
  if (roomBoardVersions.has(roomId)) {
    const v = roomBoardVersions.get(roomId);
    v.version++;
    v.lastUndoAt = Date.now();
  }
  io.to(roomId).emit("board-cleared");
});

  socket.on("undo-stroke", ({ roomId }) => {
    if (!roomId || socket.data.roomId !== roomId) return;
    if (!roomParticipants.has(roomId)) return;

    // Option B: Undo removes the last stroke of the REQUESTER
    // Instructors can undo anything (global pop) or clear all
    const isInstructor = socket.data.role === "instructor";
    const board = roomBoardStates.get(roomId) || [];
    if (board.length === 0) return;

    // Rate-limit undos
    const undoKey = `undo_${socket.data.userId}`;
    const now = Date.now();
    if (now - (lastEventTime.get(undoKey) || 0) < 300) return;
    lastEventTime.set(undoKey, now);

    let removedIndex = -1;
    if (isInstructor) {
      // Instructor undos the very last stroke regardless of who drew it
      removedIndex = board.length - 1;
    } else {
      // Student undos THEIR last stroke
      for (let i = board.length - 1; i >= 0; i--) {
        if (board[i].userId === socket.data.userId) {
          removedIndex = i;
          break;
        }
      }
    }

    if (removedIndex === -1) return; // Nothing of theirs to undo

    board.splice(removedIndex, 1);
    
    // Phase 4: Version-Safe Deterministic Undo Sync
    const versionObj = roomBoardVersions.get(roomId) || { version: 0 };
    versionObj.version += 1;

    io.to(roomId).emit("BOARD_UNDO", {
      version: versionObj.version,
      newLength: board.length
    });
  });

  socket.on("disconnect", async () => {
    // Bug 1 Fix: Support fallback if socket.data was lost or incomplete
    const { roomId, userId, role, courseId, sessionId } = socket.data || {};

    // Standardize IDs for cache operations
    const sid = sessionId ? sessionId.toString() : null;

    if (roomId && userId) {
      if (role === "instructor") {
        // Bug 6 Fix: Authorization check (verify instructor ownership)
        const course = await Course.findOne({ liveRoomId: roomId }).select("instructor");
        if (course && course.instructor.toString() !== userId) {
          console.warn(`🛑 Unauthorized instructor disconnect logic for ${roomId}`);
          return;
        }

        // Grace window should be > instructor heartbeat interval (60s) to avoid
        // false session termination on transient network drops.
        const INSTRUCTOR_GRACE_MS = 20 * 1000;
        console.warn(`👨‍🏫 Instructor ${userId} disconnected. Starting ${Math.round(INSTRUCTOR_GRACE_MS / 1000)}s grace timer for ${roomId}.`);
        io.to(roomId).emit("INSTRUCTOR_LEFT");

        // Step 1: Start 10-second grace timer (Bug 9)
        const timeout = setTimeout(async () => {
          console.warn(`⏰ Grace timer expired for ${roomId}. Ending session.`);
          // #region agent log
          agentNdjsonLog({
            runId: "pre-fix",
            hypothesisId: "H3",
            location: "backend/server.js:grace-expired",
            message: "instructor grace timer expired; ending session",
            data: { roomId, userId, courseId: (course?._id || courseId)?.toString?.() || null, sid },
            timestamp: Date.now(),
          });
          (typeof fetch === "function"
            ? fetch("http://127.0.0.1:7297/ingest/2e9fa13e-90a3-428f-9323-6c1de32a1d69", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ecb98" },
                body: JSON.stringify({
                  sessionId: "2ecb98",
                  runId: "pre-fix",
                  hypothesisId: "H3",
                  location: "backend/server.js:grace-expired",
                  message: "instructor grace timer expired; ending session",
                  data: { roomId, userId, courseId: (course?._id || courseId)?.toString?.() || null, sid },
                  timestamp: Date.now(),
                }),
              }).catch(() => {})
            : null);
          // #endregion agent log
          // Sync DB state
          await Course.findOneAndUpdate(
            { liveRoomId: roomId },
            { isLive: false, liveRoomId: null, lastHeartbeatAt: null, liveStartedAt: null }
          );
          endSession(roomId, course?._id || courseId, "disconnect");
        }, INSTRUCTOR_GRACE_MS);

        instructorDisconnectTimers.set(roomId, timeout);
        // #region agent log
        agentNdjsonLog({
          runId: "pre-fix",
          hypothesisId: "H3",
          location: "backend/server.js:grace-start",
          message: "instructor grace timer started",
          data: { roomId, socketId: socket.id, userId, sid, courseId: (course?._id || courseId)?.toString?.() || null },
          timestamp: Date.now(),
        });
        (typeof fetch === "function"
          ? fetch("http://127.0.0.1:7297/ingest/2e9fa13e-90a3-428f-9323-6c1de32a1d69", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ecb98" },
              body: JSON.stringify({
                sessionId: "2ecb98",
                runId: "pre-fix",
                hypothesisId: "H3",
                location: "backend/server.js:grace-start",
                message: "instructor grace timer started",
                data: { roomId, socketId: socket.id, userId, sid, courseId: (course?._id || courseId)?.toString?.() || null },
                timestamp: Date.now(),
              }),
            }).catch(() => {})
          : null);
        // #endregion agent log
      } else {
        // Bug 5 Fix: Accurate activeStudents tracking (Tab-Lock aware)
        if (sid) {
          const cache = liveCache.get(sid);
          if (cache?.activeSockets) {
            const userSockets = cache.activeSockets.get(userId);
            if (userSockets) {
              userSockets.delete(socket.id);
              if (userSockets.size === 0) {
                cache.activeSockets.delete(userId);
              }
            }
            cache.activeStudents = cache.activeSockets.size;
          }

          // Finalize student attendance in DB
          await LiveAttendance.findOneAndUpdate(
            { sessionId: sid, userId },
            { leftAt: new Date(), status: "left" }
          ).catch((e) => {
            if (process.env.NODE_ENV === "production") console.warn("Finalize attendance failed:", e.message);
          });
        }

        const participants = roomParticipants.get(roomId);
        if (participants) {
          if (participants.get(userId)?.socketId === socket.id) {
            participants.delete(userId);
            // Reliability Fix: Ensure hand is lowered on others' screens if student leaves
            io.to(roomId).emit("hand-lowered", { userId });
          }

          if (participants.size === 0) {
            console.log(`Empty room ${roomId}. Auto-cleaning up.`);
            endSession(roomId, courseId, "empty");
          } else {
            emitParticipants(roomId);
          }
        }
      }
    }

    console.log("🔴 Socket disconnected:", socket.id);
  });
});

const chatRoute = require("./routes/chatRoute");

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use("/api/chat", chatRoute);
app.use("/api", studyPlanner);

const testRoutes = require("./routes/testRoute.js");



// connections
connectDB();
cloudinaryConnect();

// ────────────────────────────────────────────────────────────────────────────
// LIVE CLASS RECONCILIATION ENGINE
// ────────────────────────────────────────────────────────────────────────────
/**
 * Bidirectional state reconciliation to prevent "Zombie" live classes.
 * Ensures Course and LiveSession states are perfectly synchronized.
 */
const performSessionReconciliation = async () => {
  try {
    const now = Date.now();
    const EXPIRY_THRESHOLD = 75 * 1000; // 75s (Heartbeat stale)
    const ABANDON_TIMEOUT = 120 * 1000; // 2 min (Never pinged)

    // --- PHASE 1: COURSE-DRIVEN RECONCILIATION ---
    const liveCourses = await Course.find({ isLive: true });
    
    for (const course of liveCourses) {
      const startTime = course.liveStartedAt || course.lastLiveClassStartedAt;
      const classStartedAt = startTime ? new Date(startTime).getTime() : null;

      // 1. Abandoned Room Check (Marked live but never sent heartbeat)
      if (!course.lastHeartbeatAt) {
        if (classStartedAt && (now - classStartedAt > ABANDON_TIMEOUT)) {
          console.log(`🧹 Clearing abandoned zombie course: ${course.courseName}`);
          await Course.findByIdAndUpdate(course._id, { 
            isLive: false, liveRoomId: null, lastHeartbeatAt: null, liveStartedAt: null 
          });
          // Also kill any active sessions for this course
          const orphanedSession = await LiveSession.findOne({ 
            courseId: course._id, status: "active" 
          });
          if (orphanedSession) {
             endSession(orphanedSession.liveRoomId, course._id, "abandoned");
          }
        }
        continue;
      }

      // 2. Stale Heartbeat Check (Normal expiry)
      const heartbeatTime = new Date(course.lastHeartbeatAt).getTime();
      if (now - heartbeatTime > EXPIRY_THRESHOLD) {
        console.log(`⚠️ Auto-ending stale class: ${course.courseName} (No heartbeat)`);
        
        // Force DB update immediately to prevent zombie state
        await Course.findByIdAndUpdate(course._id, { 
          isLive: false, liveRoomId: null, lastHeartbeatAt: null, liveStartedAt: null 
        });

        endSession(course.liveRoomId, course._id, "timeout");
      }

      // 3. Entity Reconciliation: If Course is live but no active session exists
      const sessionCount = await LiveSession.countDocuments({ 
        courseId: course._id, status: "active" 
      });
      if (sessionCount === 0 && classStartedAt && (now - classStartedAt > 60000)) {
         console.log(`🧹 Course ${course.courseName} is live but has no active session. Resetting.`);
         await Course.findByIdAndUpdate(course._id, { isLive: false, liveRoomId: null });
      }
    }

    // --- PHASE 2: SESSION-DRIVEN RECONCILIATION ---
    const activeSessions = await LiveSession.find({ status: "active" });
    for (const session of activeSessions) {
      const course = await Course.findById(session.courseId).select("isLive");
      if (!course || !course.isLive) {
        console.log(`🧹 Terminating orphaned active session: ${session.liveRoomId}`);
        endSession(session.liveRoomId, session.courseId, "orphaned");
      }
    }

  } catch (err) {
    console.error("Reconciliation Engine Error:", err.message);
  }
};

// Start the daemon
setInterval(performSessionReconciliation, 60 * 1000); // 60s frequency

// mount route
app.use('/api/v1/auth', userRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/course', courseRoutes);
app.use('/api/v1/test', testRoutes);
const codeRoutes = require("./routes/codeRoutes");
app.use("/api/v1/code", codeRoutes);
const problemRoutes = require("./routes/problemRoutes");
app.use("/api/v1/problems", problemRoutes);
const codingAIRoute = require("./routes/codingAIRoute");
app.use("/api/v1/ai", codingAIRoute);
const notesRoutes = require("./routes/notesRoute");
app.use("/api/v1/ai", notesRoutes);
const liveClassRoutes = require("./routes/liveClass");
app.use("/api/v1/live-class", liveClassRoutes);
const liveAnalyticsRoutes = require("./routes/liveAnalytics");
app.use("/api/v1/live-analytics", liveAnalyticsRoutes);
const analysisRoutes = require("./routes/analysisRoutes");
app.use("/api/v1/analysis", analysisRoutes);
const recommendationRoutes = require("./routes/recommendationRoutes");
app.use("/api/v1/recommendation", recommendationRoutes);

const analyticsRoutes = require("./routes/analytics");
app.use("/api/v1/analysis", analyticsRoutes);

const instructorAnalyticsRoutes = require("./routes/instructorAnalytics");
app.use("/api/v1/instructor-analytics", instructorAnalyticsRoutes);

const cheatingAnalyticsRoutes = require("./routes/cheatingAnalytics");
app.use("/api/v1/cheating-analytics", cheatingAnalyticsRoutes);

const leaderboardRoutes = require("./routes/leaderboard");
app.use("/api/v1/leaderboard", leaderboardRoutes);

const systemRoutes = require("./routes/systemRoutes");
app.use("/api/v1/system", systemRoutes);



// Default Route
app.get('/', (req, res) => {
    // console.log('Your server is up and running..!');
    res.send(`<div>
    This is Default Route  
    <p>Everything is OK</p>
    </div>`);
})

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`[Startup] Port ${PORT} is already in use. Stop the existing backend process or set a different PORT in backend/.env.`);
        process.exit(1);
        return;
    }
    console.error("[Startup] HTTP server failed:", err);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
