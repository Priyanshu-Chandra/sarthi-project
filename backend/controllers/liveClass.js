const Course = require("../models/course");
const User = require("../models/user");
const LiveSession = require("../models/LiveSession");
const mailSender = require("../utils/mailSender");
const { v4: uuidv4 } = require("uuid");
// ✅ Custom pure-Node.js implementation — zego-token-generator is browser-only
// (it references `window`) and crashes with ReferenceError in Node.js.
const { generateToken04 } = require("../utils/zegoToken");

// ────────────────────────────────────────────────────────────────────────────
// START LIVE CLASS
// Guards:
//   1. courseId must be provided
//   2. Course must exist
//   3. Rate-limit: 30s between starts on SAME course
//   4. Instructor-wide lock: cannot start another class if ANY of their
//      courses is currently live (prevents broadcasting to two rooms at once)
// ────────────────────────────────────────────────────────────────────────────
exports.startLiveClass = async (req, res) => {
  try {
    const { courseId } = req.body;
    const instructorId = req.user.id;

    console.log("📡 StartLiveClass API hit");
    console.log("➡️ CourseId:", courseId, "| InstructorId:", instructorId);

    // ── Validation ──────────────────────────────────────────────────────────
    if (!courseId) {
      console.log("❌ No courseId provided");
      return res.status(400).json({
        success: false,
        message: "CourseId is required",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      console.log("❌ Course not found");
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    console.log(`📚 Course found: ${course.courseName}`);

    if (course.instructor.toString() !== instructorId) {
      console.log("🚫 Instructor does not own this course");
      return res.status(403).json({
        success: false,
        message: "You can only start live classes for your own courses.",
      });
    }

    // ── Rate Limit: 30s cooldown per course ─────────────────────────────────
    const HEARTBEAT_TIMEOUT = 75 * 1000;
    const now = new Date();

    if (course.isLive) {
      // Robustness Check: If the last heartbeat was more than 75 seconds ago, 
      // the class is technically dead. Clear it on the fly instead of blocking.
      if (course.lastHeartbeatAt && (now - new Date(course.lastHeartbeatAt) > HEARTBEAT_TIMEOUT)) {
        console.log(`🧹 Auto-clearing stale course during /start: ${course.courseName}`);
        course.isLive = false;
        course.liveRoomId = null;
        course.lastHeartbeatAt = null;
        course.liveStartedAt = null;
        await course.save();
      } else {
        console.log(`This course is already live: ${course.courseName}`);
        return res.status(409).json({
          success: false,
          message: "This course is already live. End the current session before starting a new one.",
          activeRoomId: course.liveRoomId,
        });
      }
    }

    const activeLiveClass = await Course.findOne({
      instructor: instructorId,
      isLive: true,
      _id: { $ne: courseId },
    });

    if (activeLiveClass) {
      // Check if the OTHER course has a stale heartbeat
      if (activeLiveClass.lastHeartbeatAt && (now - new Date(activeLiveClass.lastHeartbeatAt) > HEARTBEAT_TIMEOUT)) {
        console.log(`🧹 Auto-clearing instructor's OTHER stale course: ${activeLiveClass.courseName}`);
        activeLiveClass.isLive = false;
        activeLiveClass.liveRoomId = null;
        await activeLiveClass.save();
      } else {
        console.log(`Instructor already has a live class running: ${activeLiveClass.courseName}`);
        return res.status(409).json({
          success: false,
          message: `You already have an active live class in "${activeLiveClass.courseName}". Please end it before starting a new one.`,
          activeRoomId: activeLiveClass.liveRoomId,
        });
      }
    }

    const THIRTY_SECONDS = 30 * 1000;

    if (
      course.lastLiveClassStartedAt &&
      now - new Date(course.lastLiveClassStartedAt) < THIRTY_SECONDS
    ) {
      const remainingSec = Math.ceil(
        (THIRTY_SECONDS - (now - new Date(course.lastLiveClassStartedAt))) / 1000
      );
      console.log(`⏳ Rate limited — ${remainingSec}s remaining`);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSec} second(s) before starting another class`,
      });
    }

    // ── Generate Room ID ─────────────────────────────────────────────────────
    const roomId = `sarthi_${uuidv4()}`;
    console.log("🏠 Generated Room ID:", roomId);

    // *** Phase 3 Analytics Hook: Create Session (Bug 4 Fix) ***
    // We create the session FIRST so we have a valid ID for all future telemetry.
    let liveSession;
    try {
      liveSession = await LiveSession.create({
        courseId,
        instructorId,
        liveRoomId: roomId,
        expectedStudents: course.studentsEnrolled?.length || 0,
        status: "active",
        startedAt: now,
      });
      console.log(`📊 Analytics session created: ${liveSession._id}`);
    } catch (sessionErr) {
      console.error("❌ Failed to create LiveSession:", sessionErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to initialize analytics. Please try again.",
      });
    }

    // ── Update Course State ──────────────────────────────────────────────────
    // Now that we have a sessionId, we can safely mark the course as live.
    const liveUpdate = await Course.findOneAndUpdate(
      { _id: courseId, instructor: instructorId, isLive: false },
      {
        isLive: true,
        liveRoomId: roomId,
        liveStartedAt: now,
        lastLiveClassStartedAt: now,
        lastHeartbeatAt: now,
      },
      { new: true }
    );

    if (!liveUpdate) {
      // Cleanup the orphaned session if course update failed (e.g. concurrent start)
      await LiveSession.findByIdAndDelete(liveSession._id);
      return res.status(409).json({
        success: false,
        message: "This course is already live. End the current session before starting a new one.",
      });
    }

    console.log("✅ Course marked as LIVE");

    // ── Send Email Notifications ──────────────────────────
    // ... (rest of the email logic remains same)
    const students = await User.find({
      _id: { $in: course.studentsEnrolled },
    }).select("email firstName");

    if (students.length > 0) {
      // Fire and forget email notifications
      const emailPromises = students.map((student) => 
        mailSender(
          student.email,
          "🚀 Live Class Started - Join Now!",
          `<h2>Hello ${student.firstName},</h2><p>Your class <b>${course.courseName}</b> is now LIVE.</p><p>Click below to join:</p><a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/live-class/${roomId}" style="background:#ffd60a;padding:10px 20px;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Join Class Now →</a>`
        )
      );
      Promise.all(emailPromises).catch(err => {
        if (process.env.NODE_ENV === "production") {
          console.error("Email notification error:", err);
        } else {
          console.warn("Email skipped (dev mode / credentials missing)");
        }
      });
    }

    return res.status(200).json({
      success: true,
      roomId,
      sessionId: liveSession._id,
      message: "Live class started",
    });

  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You already have an active live class. Please end it before starting a new one.",
      });
    }

    console.error("❌ Error in startLiveClass:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start live class",
      error: error.message,
    });
  }
};


// ────────────────────────────────────────────────────────────────────────────
// END LIVE CLASS
// ────────────────────────────────────────────────────────────────────────────
exports.endLiveClass = async (req, res) => {
  try {
    const { courseId } = req.body;
    const instructorId = req.user.id;

    console.log("🛑 EndLiveClass API hit");
    console.log("➡️ CourseId:", courseId);

    if (!courseId) {
      console.log("❌ No courseId provided");
      return res.status(400).json({
        success: false,
        message: "CourseId is required",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      console.log("❌ Course not found");
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.instructor.toString() !== instructorId) {
      console.log("🚫 Instructor does not own this course");
      return res.status(403).json({
        success: false,
        message: "You can only end live classes for your own courses.",
      });
    }

    // Store variables before nullifying for the cleanup job
    const activeRoomId = course.liveRoomId;
    const activeCourseId = course._id;

    // Trigger socket cleanup and Board DB Dump (Handles LiveSession status, Course status, and Broadcast)
    const endSession = req.app.get("endSession");
    if (endSession && activeRoomId) {
      await endSession(activeRoomId, activeCourseId, "manual");
    }

    console.log(`✅ Live class ended for: ${course.courseName}`);

    return res.status(200).json({
      success: true,
      message: "Class ended",
    });

  } catch (error) {
    console.error("❌ Error in endLiveClass:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to end class",
      error: error.message,
    });
  }
};


// ────────────────────────────────────────────────────────────────────────────
// VALIDATE LIVE CLASS ACCESS
// Called by the frontend BEFORE initializing ZegoCloud SDK.
// Only the course instructor and enrolled students may join.
// ────────────────────────────────────────────────────────────────────────────
exports.validateLiveClass = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    console.log("🔐 ValidateLiveClass hit | roomId:", roomId, "| userId:", userId);

    // Find the course that currently owns this room
    // Note: _id is always included by Mongoose even in .select()
    const course = await Course.findOne({ liveRoomId: roomId }).select(
      "isLive instructor studentsEnrolled courseName"
    );

    // Room doesn't map to any course OR class is no longer live
    if (!course || !course.isLive) {
      console.log("❌ Room not found or class not live");
      return res.status(404).json({
        success: false,
        message: "This live class is not active or does not exist.",
      });
    }

    const isInstructor = course.instructor.toString() === userId.toString();
    const isStudent = course.studentsEnrolled.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isInstructor && !isStudent) {
      console.log("🚫 Unauthorized access attempt for room:", roomId);
      return res.status(403).json({
        success: false,
        message: "You are not authorized to join this live class.",
      });
    }

    // ── Block Kicked Users ──────────────────────────────────────────────────
    const { roomKickedUsers } = require("../server");
    if (roomKickedUsers && roomKickedUsers.has(roomId) && roomKickedUsers.get(roomId).has(userId.toString())) {
      console.log(`🚫 Kicked user ${userId} blocked at HTTP validate for room ${roomId}`);
      return res.status(403).json({
        success: false,
        message: "You have been removed from this session by the instructor.",
      });
    }

    // Standardize role for frontend consumption (consistent with server.js)
    const role = isInstructor ? "instructor" : "student";
    console.log(`✅ Access granted | Role: ${role} | Course: ${course.courseName}`);

    return res.status(200).json({
      success: true,
      role,
      courseName: course.courseName,
      // ✅ Critical: courseId returned so frontend doesn't depend on location.state
      // This enables rejoin after refresh, direct link access, etc.
      courseId: course._id,
    });

  } catch (error) {
    console.error("❌ Error in validateLiveClass:", error);
    return res.status(500).json({
      success: false,
      message: "Validation failed",
      error: error.message,
    });
  }
};


// ────────────────────────────────────────────────────────────────────────────
// GENERATE ZEGO TOKEN (Bug 4 Fixed: authorization check added)
// Verifies the requester is the instructor or an enrolled student BEFORE
// issuing the token. Prevents unauthorized users from bypassing /validate.
// Returns a SERVER SDK token (04 format) — the frontend combines it with
// room/user info via generateKitTokenForProduction to get the final Kit Token.
// ────────────────────────────────────────────────────────────────────────────
exports.generateZegoToken = async (req, res) => {
  try {
    const { roomId, userId, userName } = req.body;
    const requestingUserId = req.user.id;

    console.log("🎫 GenerateZegoToken hit | roomId:", roomId, "| userId:", userId);

    if (!roomId || !userId || !userName) {
      return res.status(400).json({
        success: false,
        message: "roomId, userId, and userName are required",
      });
    }

    // Robust authorization: Ensure the token request comes from the owner/enrolled user.
    // We allow the userId to have a suffix (like a timestamp) for session stability.
    if (!userId.toString().startsWith(requestingUserId.toString())) {
      console.warn(`🛑 Token ID mismatch: Requested ${userId} for Auth User ${requestingUserId}`);
      return res.status(403).json({
        success: false,
        message: "Token identity must match the authenticated user's base ID.",
      });
    }

    // ✅ Bug 4 Fix: Authorize before issuing a token.
    const course = await Course.findOne({ liveRoomId: roomId, isLive: true }).select(
      "instructor studentsEnrolled"
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "This live class is not active or does not exist.",
      });
    }

    const isInstructor = course.instructor.toString() === requestingUserId.toString();
    const isStudent = course.studentsEnrolled.some(
      (id) => id.toString() === requestingUserId.toString()
    );

    if (!isInstructor && !isStudent) {
      console.log("🚫 Unauthorized token request for room:", roomId);
      return res.status(403).json({
        success: false,
        message: "You are not authorized to join this live class.",
      });
    }

    const appID = Number(process.env.ZEGO_APP_ID);
    const serverSecret = process.env.ZEGO_SERVER_SECRET;

    if (!appID || !serverSecret) {
      console.error("❌ ZEGO credentials not configured");
      return res.status(500).json({
        success: false,
        message: "ZEGO credentials not configured on server",
      });
    }

    const privilegePayload = JSON.stringify({
      room_id: roomId,
      privilege: {
        1: 1, // loginRoom
        2: 1  // publishStream
      },
      stream_id_list: null
    });

    const serverToken = generateToken04(appID, userId.toString(), serverSecret, 7200, privilegePayload);

    const role = isInstructor ? "instructor" : "student";
    console.log(`✅ Server token generated successfully for ${role} | Room: ${roomId}`);

    return res.status(200).json({
      success: true,
      token: serverToken,
      appID,
    });
  } catch (error) {
    console.error("❌ Error in generateZegoToken:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate token",
      error: error.message,
    });
  }
};


// ────────────────────────────────────────────────────────────────────────────
// HEARTBEAT (Bug 6 Fixed: filters by isLive:true)
// Instructor sends this every 60s to keep the session alive.
// Only updates if the course is still marked as live — prevents a delayed
// heartbeat from reviving a session that was already killed by cleanup.
// ────────────────────────────────────────────────────────────────────────────
exports.heartbeat = async (req, res) => {
  try {
    const { courseId } = req.body;
    const instructorId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ success: false, message: "courseId required" });
    }

    const course = await Course.findById(courseId).select("instructor isLive");

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (course.instructor.toString() !== instructorId) {
      return res.status(403).json({
        success: false,
        message: "You can only keep alive live classes for your own courses.",
      });
    }

    if (!course.isLive) {
      // Course is no longer live — tell instructor their session ended
      return res.status(410).json({
        success: false,
        message: "Session has ended. The class is no longer live.",
      });
    }

    course.lastHeartbeatAt = new Date();
    await course.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Heartbeat error:", err);
    return res.status(500).json({ success: false, message: "Heartbeat failed" });
  }
};
