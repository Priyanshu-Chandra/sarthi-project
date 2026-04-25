import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { apiConnector } from "../services/apiConnector";
import socket from "../utils/socket";
import toast from "react-hot-toast";
import InstructorLiveDashboard from "../components/core/Dashboard/InstructorLiveDashboard";

export default function LiveClass() {
  const { roomId }   = useParams();
  const location     = useLocation();
  const navigate     = useNavigate();
  const meetingRef   = useRef(null);
  const zpRef        = useRef(null);
  const isInitializingRef = useRef(false);
  const boardRef     = useRef(null);
  const drawingRef   = useRef(null);
  const recentlyNotified = useRef({}); // Throttle toasts
  const messagesEndRef = useRef(null);

  // ── Bug 7 Fix: guard against double-fire of endClass ─────────────────────
  const hasEndedRef = useRef(false);

  const { token } = useSelector((state) => state.auth);
  const { user }  = useSelector((state) => state.profile);

  // ── Validation gate state ────────────────────────────────────────────────
  const [validated, setValidated]   = useState(false);
  const [validating, setValidating] = useState(true);
  const [errorMsg, setErrorMsg]     = useState("");
  const [userRole, setUserRole]     = useState(null);
  const [courseName, setCourseName] = useState("");
  const [raisedHands, setRaisedHands]   = useState([]);
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [messageType, setMessageType]   = useState("normal"); // normal | question | important
  const [chatFilter, setChatFilter]     = useState("all");    // all | question | important
  const [pinnedMessage, setPinnedMessage] = useState(null);

  const [poll, setPoll]                 = useState(null);
  const [pollTally, setPollTally]       = useState({});
  const [totalVotes, setTotalVotes]     = useState(0);
  const [votedOption, setVotedOption]   = useState(null);
  const [pollClosed, setPollClosed]     = useState(false);

  // Poll creation (instructor)
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions]   = useState(["Yes", "No"]);
  const [showPollCreator, setShowPollCreator] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [permissions, setPermissions]   = useState(null);

  // ── Phase 3: Analytics Dashboard state ────────────────────────────────────
  const [showDashboard, setShowDashboard] = useState(false);
  const [liveMetrics, setLiveMetrics]     = useState(null);
  const [sessionId, setSessionId]         = useState(null);

  // ── Smart Board V2 State ─────────────────────────────────────────────────
  const [brushColor, setBrushColor] = useState("#FFD700");
  const [brushSize, setBrushSize]   = useState(3);
  const [brushTool, setBrushTool]   = useState("pen");
  const lastCursorEmitRef          = useRef(0);
  const offscreenCanvasRef         = useRef(null);
  const strokeBatchRef             = useRef([]);
  const batchTimeoutRef            = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isReady, setIsReady]             = useState(false);
  const [socketReady, setSocketReady]     = useState(false);
  const [zegoReady, setZegoReady]         = useState(false);
  const [connectionStep, setConnectionStep] = useState("Waiting for access check...");
  const [isMuted, setIsMuted]             = useState(false);
  const [activeDrawer, setActiveDrawer]   = useState(null);
  const drawTimeoutRef              = useRef(null);
  const [remoteCursors, setRemoteCursors] = useState({}); // { userId: { name, x, y, color } }
  const cursorRef                         = useRef({ x: 0, y: 0 });  // High-perf hover ref
  const [pendingMessages, setPendingMessages] = useState({}); // { msgId: message }
  const [isReconnecting, setIsReconnecting] = useState(false);
  const stopTypingRef                     = useRef(null);
  const typingThrottleRef                 = useRef(null);
  const [typingUsers, setTypingUsers]     = useState({});
  const [sending, setSending]             = useState(false);
  const [newHandId, setNewHandId]         = useState(null);
  const HAND_TTL = 2 * 60 * 1000;

  const [isMobile, setIsMobile]           = useState(window.innerWidth < 768);
  const [viewMode, setViewMode]           = useState("default"); // default | board | discussion
  const [sidebarTab, setSidebarTab] = useState("chat");    // chat | people | polls
  const [pollTimeLeft, setPollTimeLeft]   = useState(0);
  const didConnectSocketRef = useRef(false);

  const liveLog = (step, details = {}) => {
    const payload = {
      roomId,
      userId: user?._id?.toString?.(),
      role: userRole,
      socketId: socket?.id,
      socketConnected: socket?.connected,
      ...details,
    };
    console.log(`[LiveClass] ${step}`, payload);
  };

  // #region agent log
  const debugLog = (hypothesisId, message, data = {}) => {
    try {
      fetch("http://127.0.0.1:7297/ingest/2e9fa13e-90a3-428f-9323-6c1de32a1d69", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ecb98" },
        body: JSON.stringify({
          sessionId: "2ecb98",
          runId: "pre-fix",
          hypothesisId,
          location: "frontend/src/pages/LiveClass.jsx:debugLog",
          message,
          data: {
            roomId,
            userId: user?._id?.toString?.(),
            role: userRole,
            socketId: socket?.id,
            socketConnected: socket?.connected,
            ...data,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch (_) {}
  };
  // #endregion agent log

  // âœ¨ 1. Deterministic Stage Config (The UI Brain)
  const stageConfig = {
    default:    { showSidebar: true,  board: "split",      video: "primary",    bg: "bg-[#0f0f14]" },
    board:      { showSidebar: false, board: "fullscreen", video: "pip",       bg: "bg-[#0a0a0f]" },
    discussion: { showSidebar: false, board: "hidden",     video: "primary",    bg: "bg-[#0f0f14]" }
  };
  const currentStage = stageConfig[viewMode] || stageConfig.default;
  const smooth = "transition-all duration-700 ease-in-out"; // 🚀 Ensure smooth transitions exist

  // ⚙️ 2. Status Priority Resolver
  const getSystemStatus = () => {
    // Priority: Connection > Mic > Board
    if (!socket?.connected) return { label: "Offline", type: "error", icon: "📡" };
    if (isMuted) return { label: "Mic Muted", type: "warning", icon: "🔇" };
    if (!permissions?.canEditBoard && userRole !== "instructor") return { label: "Board View Only", type: "info", icon: "🔒" };
    return null;
  };
  const activeStatus = getSystemStatus();

  // --- 3. Chat Thresholds & Grouping (Hooks at top!) ---
  const CHAT_TIME_THRESHOLD = 2 * 60 * 1000;

  const groupedMessages = useMemo(() => {
    // 1. Filter
    const filtered = messages.filter((msg) => {
      if (chatFilter === "all") return true;
      return msg.type === chatFilter;
    });

    // 2. Merge with Pending
    const allMsgs = [...filtered, ...Object.values(pendingMessages)];
    const sorted = allMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // 3. Group
    return sorted.reduce((acc, msg) => {
      const lastGroup = acc[acc.length - 1];
      const msgTime = msg.timestamp || Date.now();
      
      const isSameUser = lastGroup && lastGroup.name === msg.userName && lastGroup.type === msg.type;
      const isWithinThreshold = lastGroup && (msgTime - lastGroup.lastTimestamp < CHAT_TIME_THRESHOLD);

      if (isSameUser && isWithinThreshold) {
        lastGroup.messages.push(msg);
        lastGroup.lastTimestamp = msgTime; 
      } else {
        acc.push({
          name: msg.userName,
          role: msg.role,
          type: msg.type,
          messages: [msg],
          lastTimestamp: msgTime
        });
      }
      return acc;
    }, []);
  }, [messages, chatFilter, pendingMessages]);

  // --- Final Hardening Logic ---
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
  }, []);

  const handleUndo = () => {
    if (!roomId) return;
    socket.emit("undo-stroke", { roomId });
  };

  const handleBoardDrawBatch = (strokes) => {
    if (!Array.isArray(strokes)) return;
    strokes.forEach((stroke) => {
      // golden rule: skip server echoes of our own strokes
      if (stroke.userId === user?._id?.toString()) return;
      boardHistoryRef.current.push(stroke);
      drawStroke(stroke);
    });
    setHistoryCount(boardHistoryRef.current.length);
  };
  // --- Final Hardening Logic ---

  const clearBoardCanvas = (emitToRoom = true) => {
    const canvas = boardRef.current;
    const ctx = canvas?.getContext("2d");
    const offscreen = offscreenCanvasRef.current;
    const offCtx = offscreen?.getContext("2d");

    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (offCtx && offscreen) {
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    }

    boardHistoryRef.current = [];
    setHistoryCount(0);

    if (emitToRoom) {
      liveLog("board-clear emit");
      socket.emit("board-clear", { roomId });
    }
  };

  // ── courseId: state for rendering, ref for stale-closure safety ───────────
  // Seed from location.state (instructor flow) so the ref is ready immediately;
  // authoritative value always overwritten from the validate API response.
  const [courseId, setCourseId] = useState(location.state?.courseId ?? null);
  const courseIdRef             = useRef(location.state?.courseId ?? null);

  // ── Smart Board V2 History ────────────────────────────────────────────────
  const boardHistoryRef = useRef([]);
  const lastEmitTimeRef = useRef(0);
  // Separate pure reactive state for disabled states (avoids full re-renders on draw)
  const [historyCount, setHistoryCount] = useState(0);

  const BASE_URL = import.meta.env.VITE_APP_BASE_URL || "http://localhost:5000";

  // ── End class in backend ──────────────────────────────────────────────────
  // Uses ref for courseId (stale-closure safe) and hasEndedRef (double-fire safe)
  const endClass = async () => {
    if (hasEndedRef.current) {
      console.log("endClass: already called, skipping.");
      return;
    }
    hasEndedRef.current = true;

    const id = courseIdRef.current;
    if (!id) {
      console.warn("endClass: no courseId available, skipping API call.");
      return;
    }
    try {
      // #region agent log
      debugLog("H4", "endClass called (instructor backend /end)", { courseId: id });
      // #endregion agent log
      await apiConnector(
        "POST",
        `${BASE_URL}/api/v1/live-class/end`,
        { courseId: id },
        { Authorization: `Bearer ${token}` }
      );
      console.log("🚫 Class ended via backend");
    } catch (err) {
      console.error("endClass error:", err);
    }
  };

  // ── STEP 1 & 2: Unified Validation and Zego Initialization ────────────────
  // Merged into a single effect to prevent race conditions and duplicate joins.
  useEffect(() => {
    let isMounted = true;

    const performUnifiedInitialization = async () => {
      if (!roomId || !token || !user?._id) {
        console.log("📍 [Unified Init] Missing core dependencies. Skipping.");
        return;
      }

      // Aggressive Pre-Flight Cleanup: Kill any ghost instance before starting
      if (zpRef.current) {
        console.log("📍 [Unified Init] Cleaning up existing Zego instance before new join...");
        zpRef.current.destroy();
        zpRef.current = null;
        window.__ZEGO_INSTANCE__ = null;
      }

      if (isInitializingRef.current || zegoReady) return;

      try {
        isInitializingRef.current = true;
        console.log("📍 [Unified Init] 1. Starting Validation for Room:", roomId);
        setConnectionStep("Validating classroom access...");
        
        // 1. Validate Access
        const valRes = await apiConnector(
          "GET",
          `${BASE_URL}/api/v1/live-class/validate/${roomId}`,
          null,
          { Authorization: `Bearer ${token}` }
        );

        if (!isMounted) {
          console.log("📍 [Unified Init] Component unmounted during validation. Aborting.");
          return;
        }

        if (!valRes?.data?.success) {
          console.error("📍 [Unified Init] Validation Failed:", valRes?.data?.message);
          setErrorMsg(valRes?.data?.message || "You are not authorized to join this class.");
          setValidated(false);
          isInitializingRef.current = false;
          return;
        }

        const { role, courseName: cName, courseId: cid } = valRes.data;
        console.log("📍 [Unified Init] Validation Success. Role:", role, "Course:", cName);
        setUserRole(role);
        setCourseName(cName);
        setCourseId(cid);
        setValidated(true);

        // 2. Get Zego Token
        console.log("📍 [Unified Init] 2. Generating Stable Session ID...");
        setConnectionStep("Authenticating with video server...");
        
        // Generate ONE stable ID for this entire attempt. 
        // Using a random suffix instead of timestamp to avoid any millisecond race conditions.
        const sessionSuffix = Math.random().toString(36).substring(2, 7);
        const zegoUniqueId = `${user._id}_${sessionSuffix}`;
        const userName = `${user.firstName || "User"} ${user.lastName || ""}`.trim();

        console.log("📍 [Unified Init] Requesting Token for ID:", zegoUniqueId);

        const tokenRes = await apiConnector(
          "POST",
          `${BASE_URL}/api/v1/live-class/token`,
          { roomId, userId: zegoUniqueId, userName },
          { Authorization: `Bearer ${token}` }
        );

        if (!isMounted) return;

        if (!tokenRes?.data?.success) {
           console.error("📍 [Unified Init] Token Request Failed:", tokenRes?.data?.message);
           setErrorMsg(tokenRes?.data?.message || "Failed to get video server token.");
           setValidated(false);
           isInitializingRef.current = false;
           return;
        }

        const { token: serverToken, appID } = tokenRes.data;
        console.log("📍 [Unified Init] Token Received. AppID:", appID);
        
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          appID, serverToken, roomId, zegoUniqueId, userName
        );

        // 3. Join Room
        console.log("📍 [Unified Init] 3. Calling Zego joinRoom with ID:", zegoUniqueId);
        setConnectionStep("Launching video interface...");
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        await zp.joinRoom({
          container: meetingRef.current,
          scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
          showPreJoinView: true, 
          showScreenSharingButton: true,
          showUserList: true,
          showAudioVideoSettingsButton: true,
          showTextChat: true, 
          showMySelfTimer: true,
          showLayoutButton: true,
          layout: "Grid",
          onJoinRoom: () => {
            console.log("📍 [Unified Init] ✅ onJoinRoom Fired! Classroom is Ready.");
            if (isMounted) setZegoReady(true);
          },
          onLeaveRoom: () => {
            console.log("📍 [Unified Init] 🚪 onLeaveRoom Fired.");
          }
        });

      } catch (err) {
        console.error("📍 [Unified Init] ❌ Fatal Error:", err);
        if (isMounted) {
          setErrorMsg("A connection error occurred. Please try again.");
          setValidated(false);
        }
      } finally {
        if (isMounted) isInitializingRef.current = false;
      }
    };

    performUnifiedInitialization();

    return () => {
      isMounted = false;
      if (zpRef.current) {
        zpRef.current.destroy();
        zpRef.current = null;
      }
    };
  }, [roomId, token, user?._id]); 

  // Socket room join for realtime chat, raise-hand, and polls.
  useEffect(() => {
    if (!validated || !user?._id || !userRole || !roomId) return;

    if (!socket.connected) {
      setConnectionStep("Connecting to realtime server...");
      liveLog("socket:connect-start", { baseUrl: BASE_URL });
      // #region agent log
      debugLog("H1", "socket.connect() called", { baseUrl: BASE_URL });
      // #endregion agent log
      socket.connect();
      didConnectSocketRef.current = true;
    }

    setConnectionStep("Joining live class room...");
    liveLog("socket:join-room emit");
    // #region agent log
    debugLog("H1", "socket.emit(join-room)", { roomId, hasToken: Boolean(token) });
    // #endregion agent log
    socket.emit("join-room", {
      roomId,
      token,
      name: `${user.firstName || "User"} ${user.lastName || ""}`.trim(),
    });

    return () => {
      liveLog("socket:disconnect cleanup");
      // #region agent log
      debugLog("H4", "useEffect cleanup: socket.disconnect()", {
        depSnapshot: {
          validated,
          roomId,
          userRole,
          userId: user?._id?.toString?.(),
        },
      });
      // #endregion agent log
      setSocketReady(false);
      // IMPORTANT: don't disconnect the shared singleton socket here.
      // This cleanup runs on dependency changes and was causing client-side disconnect loops.
    };
  }, [validated, roomId, token, user?._id, user?.firstName, user?.lastName, userRole]);

  // Disconnect only on actual page unmount (and only if we connected it here).
  useEffect(() => {
    return () => {
      if (didConnectSocketRef.current) {
        // #region agent log
        debugLog("H1", "component unmount: socket.disconnect()", {});
        // #endregion agent log
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const applyPermission = (key, userId, allow, isAuto = false) => {
      if (userId?.toString() !== user?._id?.toString()) return;

      const isRevoked = !allow;

      setPermissions((prev) => {
        // Zego Enforcement: If permission is revoked, sync with SDK
        if (isRevoked && zpRef.current) {
          if (key === "canSpeak") zpRef.current.muteMicrophone?.();
          if (key === "canVideo") zpRef.current.turnOffCamera?.();
          if (key === "canShareScreen") zpRef.current.stopSharingScreen?.();
        }

        // UX: Toast notification with throttling
        if (!isAuto) {
          const now = Date.now();
          if (!recentlyNotified.current[key] || now - recentlyNotified.current[key] > 5000) {
            const labels = {
              canSpeak: "microphone",
              canVideo: "camera",
              canShareScreen: "screen",
              canEditBoard: "smart board",
            };
            const label = labels[key] || "access";

            if (isRevoked) {
              toast.error(`Instructor revoked your ${label} access.`);
            } else {
              toast.success(`Instructor granted you ${label} access.`);
            }
            recentlyNotified.current[key] = now;
          }
        }

        return {
          ...prev,
          [key]: Boolean(allow),
        };
      });
    };

    const handleInitialPermissions = (snap) => {
      liveLog("socket:INITIAL_PERMISSIONS", { permissions: snap });
      setPermissions(snap);
    };

    const handlePermissionsUpdated = (nextPermissions) => {
      liveLog("socket:permissions-updated", { permissions: nextPermissions });
      setPermissions(nextPermissions);
    };

    const handleParticipantsUpdated = (nextParticipants) => {
      liveLog("socket:participants-updated", { count: nextParticipants?.length || 0 });
      setParticipants(nextParticipants);
    };

    const handleRoomJoinError = ({ message }) => {
      setSocketReady(false);
      setConnectionStep(message || "Realtime room join failed.");
      liveLog("socket:room-join-error", { message });
      setErrorMsg(message || "Could not join the live class room.");
    };

    // ── Instructor permission events (new granular protocol) ─────────────
    const handleUserMuted    = ({ userId }) => applyPermission("canSpeak",       userId, false);
    const handleUserUnmuted  = ({ userId }) => applyPermission("canSpeak",       userId, true);
    const handleVideoAllowed = ({ userId }) => applyPermission("canVideo",       userId, true);
    const handleVideoRevoked = ({ userId }) => applyPermission("canVideo",       userId, false);
    const handleScreenAllowed = ({ userId }) => applyPermission("canShareScreen", userId, true);
    const handleScreenRevoked = ({ userId }) => applyPermission("canShareScreen", userId, false);
    const handleBoardAllowed = ({ userId }) => applyPermission("canEditBoard",   userId, true);
    const handleBoardRevoked = ({ userId }) => applyPermission("canEditBoard",   userId, false);

    const handleAllMuted = () => {
      setIsMuted(true);
      toast.error("Instructor muted all participants.");
      applyPermission("canSpeak", user?._id, false, true);
    };

    const handleAllUnmuted = () => {
      setIsMuted(false);
      toast.success("Instructor lifted the mute.");
      applyPermission("canSpeak", user?._id, true, true);
    };

    const handleRoomJoinSuccess = ({ role: serverRole, permissions: snap, sessionId: sid }) => {
      console.log(`🚀 Handshake Success! Role: ${serverRole} | Session: ${sid}`);
      setSocketReady(true);
      setConnectionStep("Realtime classroom joined. Starting video...");
      liveLog("socket:ROOM_JOIN_SUCCESS", { serverRole, permissions: snap, sessionId: sid });
      // #region agent log
      debugLog("H1", "socket ROOM_JOIN_SUCCESS received", { serverRole, sessionId: sid });
      // #endregion agent log
      setUserRole(serverRole);
      if (snap) setPermissions(snap);
      if (sid) setSessionId(sid);
    };

    const handleSessionReady = ({ sessionId: sid } = {}) => {
      setSocketReady(true);
      setConnectionStep("Realtime classroom synced. Starting video...");
      liveLog("socket:SESSION_READY", { sessionId: sid });
      if (sid) setSessionId(sid);
    };

    socket.on("INITIAL_PERMISSIONS",  handleInitialPermissions);
    socket.on("ROOM_JOIN_SUCCESS",    handleRoomJoinSuccess);
    socket.on("SESSION_READY",        handleSessionReady);
    socket.on("permissions-updated",  handlePermissionsUpdated);
    socket.on("participants-updated", handleParticipantsUpdated);
    socket.on("room-join-error",      handleRoomJoinError);
    socket.on("USER_MUTED",     handleUserMuted);
    socket.on("USER_UNMUTED",   handleUserUnmuted);
    socket.on("VIDEO_ALLOWED",  handleVideoAllowed);
    socket.on("VIDEO_REVOKED",  handleVideoRevoked);
    socket.on("SCREEN_ALLOWED", handleScreenAllowed);
    socket.on("SCREEN_REVOKED", handleScreenRevoked);
    socket.on("BOARD_ALLOWED",  handleBoardAllowed);
    socket.on("BOARD_REVOKED",  handleBoardRevoked);
    socket.on("ALL_MUTED",      handleAllMuted);
    socket.on("ALL_UNMUTED",    handleAllUnmuted);
    const handleHandRaised = (data) => {
      const uid = data.user.id?.toString();
      if (!uid) return;

      setRaisedHands((prev) => {
        // Map-based Deduplication (Instructor overwrite/refresh)
        const map = new Map(prev.map(h => [h.user.id?.toString(), h]));
        map.set(uid, { ...data, timestamp: Date.now() });
        return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
      });

      // Highlight Signal (3s)
      setNewHandId(uid);
      setTimeout(() => setNewHandId(null), 3000);
      
      toast(`✋ ${data.user.name} raised their hand`, { icon: "✋" });
    };

    const handleHandLowered = ({ userId }) => {
      setRaisedHands((prev) =>
        prev.filter((entry) => entry.user.id?.toString() !== userId?.toString())
      );
    };

    const handleReceiveMessage = (msg) => {
      setMessages((prev) => {
        const updated = [...prev, msg];
        return updated.slice(-200);
      });
    };

    // --- BOARD EVENTS ---
    socket.on("BOARD_DRAW", ({ userId: remoteUid, name, x, y, brushColor: rc, brushSize: rs, brushTool: rt, isDrawing }) => {
      // Use the stable unique ID for remote tracking
      if (remoteUid === egoUniqueId) return; 
      
      const ctx = boardRef.current?.getContext("2d");
      if (!ctx) return;
    });

    const handlePollCreated = (pollData) => {
      setPoll(pollData);
      setPollTally({});
      setTotalVotes(0);
      setVotedOption(null);
      setPollClosed(false);
      toast("📊 New poll started!", { icon: "📊" });
    };

    const handlePollVoted = ({ tally, totalVotes: total }) => {
      setPollTally(tally || {});
      setTotalVotes(total || 0);
    };

    const handlePollClosed = ({ tally, totalVotes: total }) => {
      setPollTally(tally || {});
      setTotalVotes(total || 0);
      setPollClosed(true);
    };

    const handleMessagePinned = (msg) => {
      setPinnedMessage(msg);
    };

    const redrawCanvas = (history) => {
      const canvas = boardRef.current;
      const ctx = canvas?.getContext("2d");
      const offscreen = offscreenCanvasRef.current;
      const offCtx = offscreen?.getContext("2d");
      
      if (!ctx || !canvas || !offCtx) return;

      // ── Full System Redraw (History Reconstruction) ──
      // This is now only called during Undo, Clear, or Initial Load.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);

      history.forEach((stroke) => {
        renderToContext(ctx, canvas, stroke);
        renderToContext(offCtx, offscreen, stroke);
      });
    };

    const handleBoardState = (history) => {
      boardHistoryRef.current = history || [];
      setHistoryCount(boardHistoryRef.current.length);
      redrawCanvas(boardHistoryRef.current);
    };

    const handleBoardDraw = (stroke) => {
      // ── Idempotency: Skip server echoes of our own strokes (Golden Rule) ──
      if (stroke.userId === egoUniqueId) return;

      boardHistoryRef.current.push(stroke);
      setHistoryCount(boardHistoryRef.current.length);
      drawStroke(stroke);

      if (stroke.userId) {
        setActiveDrawer(stroke.userName || "Someone");
        if (drawTimeoutRef.current) clearTimeout(drawTimeoutRef.current);
        drawTimeoutRef.current = setTimeout(() => setActiveDrawer(null), 1500);
      }
    };

    const handleBoardClear = () => {
      clearBoardCanvas(false);
    };

    const handleCursorMove = ({ userId, name, x, y }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { name, x, y, timestamp: Date.now() },
      }));
    };

    const handleSessionEnded = (msg) => {
      /* toast.success(msg || "The live class has ended.");
      hasEndedRef.current = true;
      setTimeout(() => navigate(-1), 2000); */
    };

    const handleInstructorLeft = () => {
      /* toast.error("Instructor ended the session");
      hasEndedRef.current = true;
      setTimeout(() => navigate(-1), 2000); */
    };

    const handleSessionId = ({ sessionId: sid }) => { if (sid) setSessionId(sid); };

    socket.on("hand-raised",       handleHandRaised);
    socket.on("hand-lowered",       handleHandLowered);
    socket.on("receive-message",    handleReceiveMessage);
    socket.on("message-pinned",     handleMessagePinned);
    socket.on("poll-created",       handlePollCreated);
    socket.on("poll-voted",         handlePollVoted);
    socket.on("poll-closed",        handlePollClosed);
    const handleBoardUndo = ({ newLength }) => {
      // Deterministic Length Sync (Safe across users)
      boardHistoryRef.current.length = newLength;
      setHistoryCount(newLength);
      redrawCanvas(boardHistoryRef.current);
    };

    socket.on("draw-update",        handleBoardDraw);
    socket.on("draw-update-batch",  handleBoardDrawBatch);
    socket.on("board-cleared",      handleBoardClear);
    socket.on("BOARD_STATE",        handleBoardState);
    socket.on("BOARD_UNDO",         handleBoardUndo);
    socket.on("CURSOR_MOVE",        handleCursorMove);
    socket.on("SESSION_ENDED",      handleSessionEnded);
    socket.on("INSTRUCTOR_LEFT",    handleInstructorLeft);
    socket.on("ALL_MUTED",          handleAllMuted);
    socket.on("ALL_UNMUTED",        handleAllUnmuted);
    const handleLiveMetrics = (metrics) => {
      setLiveMetrics(metrics);
    };

    socket.on("live-metrics", handleLiveMetrics);

    const handleConnect = () => {
      setIsReconnecting(false);
      setConnectionStep("Realtime server connected. Waiting for room sync...");
      liveLog("socket:connect");
      toast.success("Connected to live server", { id: "socket-status" });
    };

    const handleDisconnect = (reason) => {
      setSocketReady(false);
      setIsReconnecting(true);
      setConnectionStep(`Realtime server disconnected: ${reason || "unknown reason"}`);
      liveLog("socket:disconnect", { reason });
      // #region agent log
      debugLog("H1", "socket disconnect event", { reason });
      // #endregion agent log
      toast.error("Lost connection. Attempting to reconnect...", { id: "socket-status", duration: Infinity });
    };

    const handleConnectError = (err) => {
      setSocketReady(false);
      setConnectionStep(`Realtime connection failed: ${err?.message || "unknown error"}`);
      liveLog("socket:connect_error", { message: err?.message, description: err?.description });
    };

    const handleReconnect = () => {
      setIsReconnecting(false);
      setConnectionStep("Realtime server reconnected. Recovering room state...");
      liveLog("socket:reconnect");
      toast.success("Reconnected!", { id: "socket-status" });
      
      // Atomic State Recovery
      socket.emit("join-room", { roomId, token, name: `${user?.firstName} ${user?.lastName || ""}` });
      socket.emit("request-board-state");
      socket.emit("request-poll-state");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("reconnect", handleReconnect);

    // --- Poll Countdown Logic ---
    let pollInterval = null;
    if (poll?.expiresAt && !pollClosed) {
      pollInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((poll.expiresAt - Date.now()) / 1000));
        setPollTimeLeft(remaining);
        if (remaining <= 0) {
          setPollClosed(true);
          clearInterval(pollInterval);
        }
      }, 1000);
    }

    // --- Cleanup stale hands every 10s ---
    const handsCleanup = setInterval(() => {
      const now = Date.now();
      setRaisedHands((prev) => {
        const filtered = prev.filter(h => now - h.timestamp < HAND_TTL);
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 10000);

    const handleSocketTyping = ({ userId: tid, name, isTyping }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        if (isTyping) next[tid] = name;
        else delete next[tid];
        return next;
      });
    };
    socket.on("typing", handleSocketTyping);

    // --- Cleanup stale cursors every 5s ---
    const cursorCleanup = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const uid in next) {
          if (now - next[uid].timestamp > 5000) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);

    return () => {
      socket.off("INITIAL_PERMISSIONS",  handleInitialPermissions);
      socket.off("ROOM_JOIN_SUCCESS",    handleRoomJoinSuccess);
      socket.off("SESSION_READY",        handleSessionReady);
      socket.off("permissions-updated",  handlePermissionsUpdated);
      socket.off("participants-updated", handleParticipantsUpdated);
      socket.off("room-join-error",      handleRoomJoinError);
      socket.off("USER_MUTED",     handleUserMuted);
      socket.off("USER_UNMUTED",   handleUserUnmuted);
      socket.off("VIDEO_ALLOWED",  handleVideoAllowed);
      socket.off("VIDEO_REVOKED",  handleVideoRevoked);
      socket.off("SCREEN_ALLOWED", handleScreenAllowed);
      socket.off("SCREEN_REVOKED", handleScreenRevoked);
      socket.off("BOARD_ALLOWED",  handleBoardAllowed);
      socket.off("BOARD_REVOKED",  handleBoardRevoked);
      socket.off("hand-raised",       handleHandRaised);
      socket.off("hand-lowered",       handleHandLowered);
      socket.off("receive-message",    handleReceiveMessage);
      socket.off("message-pinned",     handleMessagePinned);
      socket.off("poll-created",       handlePollCreated);
      socket.off("poll-voted",         handlePollVoted);
      socket.off("poll-closed",        handlePollClosed);
      socket.off("draw-update",        handleBoardDraw);
      socket.off("draw-update-batch",  handleBoardDrawBatch);
      socket.off("board-cleared",      handleBoardClear);
      socket.off("BOARD_STATE",        handleBoardState);
      socket.off("BOARD_UNDO",         handleBoardUndo);
      socket.off("CURSOR_MOVE",        handleCursorMove);
      socket.off("SESSION_ENDED",      handleSessionEnded);
      socket.off("INSTRUCTOR_LEFT",    handleInstructorLeft);
      socket.off("ALL_MUTED",          handleAllMuted);
      socket.off("ALL_UNMUTED",        handleAllUnmuted);
      socket.off("live-metrics",       handleLiveMetrics);
      socket.off("typing",             handleSocketTyping);
      socket.off("connect",            handleConnect);
      socket.off("disconnect",         handleDisconnect);
      socket.off("connect_error",      handleConnectError);
      socket.off("reconnect",          handleReconnect);
      clearInterval(cursorCleanup);
      clearInterval(handsCleanup);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      if (stopTypingRef.current) clearTimeout(stopTypingRef.current);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user?._id]);

  // --- Helper: String to Color (consistent for cursors) ---
  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash % 360)}, 70%, 65%)`;
  };

  // The Zego initialization is now handled in the unified effect above.


  // ——— Component Unmount: instructor-only backend cleanup —————————————————————————————
  // Uses refs so this always works correctly even after refresh.
  // hasEndedRef prevents double-fire when onLeaveRoom already called endClass.
  useEffect(() => {
    return () => {
      // Automatic endClass removed to prevent accidental termination on re-renders/refresh.
      // Backend grace timer (75s) handles actual instructor abandonment.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // --- Resize Handler: Sync canvas dimensions + Mobile detection ---
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768); // 🖥️ Standard Desktop threshold
    checkMobile();  
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      
      const canvas = boardRef.current;
      const offscreen = offscreenCanvasRef.current;
      if (!canvas || !offscreen) return;

      const container = canvas.parentElement;
      if (!container) return;

      // ── Step 1: Capture current visible state before clear ──
      const temp = document.createElement("canvas");
      temp.width = offscreen.width;
      temp.height = offscreen.height;
      const tempCtx = temp.getContext("2d");
      tempCtx.drawImage(offscreen, 0, 0);

      // ── Step 2: Recalculate dimensions ──
      const nextWidth = container.clientWidth;
      const nextHeight = (container.clientWidth * 400) / 720;

      // ── Step 3: Resize both (this clears them in the browser) ──
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      offscreen.width = nextWidth;
      offscreen.height = nextHeight;

      // ── Step 4: Restore and scale pixel data (No history loop!) ──
      const offCtx = offscreen.getContext("2d");
      offCtx.imageSmoothingEnabled = true; // High quality stretch
      offCtx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, nextWidth, nextHeight);

      // ── Step 5: Blit to main canvas ──
      const ctx = canvas.getContext("2d");
      ctx.drawImage(offscreen, 0, 0);
    };

    window.addEventListener("resize", handleResize);
    setTimeout(handleResize, 500); 

    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions?.canEditBoard]);

  // ——— Heartbeat: instructor sends every 60s —————————————————————————————————————————
  // ✅ Bug 3 Fix: Uses courseIdRef.current (ref) instead of courseId (state).
  // State captured in a setInterval closure is stale; the ref is always current.
  useEffect(() => {
    if (userRole !== "instructor") return;

    // Mutable container for the interval ID so the 410 handler can cancel it
    let heartbeatInterval = null;

    const sendHeartbeat = async () => {
      const id = courseIdRef.current; // ✅ Always fresh via ref, never stale closure
      if (!id) return;

      try {
        const res = await apiConnector(
          "POST",
          `${BASE_URL}/api/v1/live-class/heartbeat`,
          { courseId: id },
          { Authorization: `Bearer ${token}` }
        );

        // 410 means the cleanup job killed the session server-side
        if (res?.data?.success === false) {
          console.warn("⚠️ Heartbeat: session ended externally. Navigating out.");
          clearInterval(heartbeatInterval);
          navigate(-1);
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 410) {
          // Server killed the session — get the instructor out of the room
          console.warn("⚠️ Session expired (410). Redirecting instructor.");
          clearInterval(heartbeatInterval);
          navigate(-1);
        } else {
          console.error("Heartbeat failed:", err);
        }
      }
    };

    heartbeatInterval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(heartbeatInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, token]);

  // Smart Auto-scroll chat to bottom
  useEffect(() => {
    const chatContainer = messagesEndRef.current?.parentElement;
    if (!chatContainer) return;

    // Condition: only scroll if user is within 100px of bottom
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
    
    if (isAtBottom || messages.length === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pendingMessages, chatFilter]);

  const currentUserId = user?._id?.toString();
  const hasRaisedHand = raisedHands.some(
    (entry) => entry.user.id?.toString() === currentUserId
  );

  const sendMessage = (e) => {
      if (e) e.preventDefault();
      if (!input.trim() || sending) return;

      const msgId = Math.random().toString(36).substring(7);
      const tempMsg = {
        text: input,
        userName: `${user.firstName} ${user.lastName || ""}`,
        role: userRole,
        type: chatFilter === "all" ? "normal" : chatFilter.toLowerCase(),
        pending: true,
        msgId,
        timestamp: Date.now()
      };

      // Optimistic Update
      setPendingMessages(prev => ({ ...prev, [msgId]: tempMsg }));
      setInput("");
      setSending(true);

      // Throttled Stop Typing
      socket.emit("typing", { roomId, userId: user._id, name: user.firstName, isTyping: false });

      socket.emit("send-message", { roomId, message: tempMsg }, (ack) => {
        setSending(false);
        if (ack?.status === "ok") {
          setPendingMessages(prev => {
            const next = { ...prev };
            delete next[msgId];
            return next;
          });
        } else {
          setPendingMessages(prev => ({
            ...prev,
            [msgId]: { ...tempMsg, pending: false, error: true }
          }));
        }
      });
    };

    const resendMessage = (msgId) => {
      const msg = pendingMessages[msgId];
      if (!msg) return;
      
      // Clean error state
      setPendingMessages(prev => ({
        ...prev,
        [msgId]: { ...msg, error: false, pending: true }
      }));

      socket.emit("send-message", { roomId, message: msg }, (ack) => {
        if (ack?.status === "ok") {
          setPendingMessages(prev => {
            const next = { ...prev };
            delete next[msgId];
            return next;
          });
        } else {
          setPendingMessages(prev => ({
            ...prev,
            [msgId]: { ...msg, pending: false, error: true }
          }));
        }
      });
    };

  const raiseHand = () => {
    if (!roomId || !currentUserId) return;

    socket.emit("raise-hand", {
      roomId,
      user: {
        id: currentUserId,
        name: user?.firstName || "User",
      },
    });
  };

  const lowerHand = () => {
    if (!roomId || !currentUserId) return;

    socket.emit("lower-hand", {
      roomId,
      userId: currentUserId,
    });
  };

  const handleTyping = () => {
    if (!roomId) return;
    const currentUserId = user?._id?.toString();

    // 1. Throttle "isTyping: true" emission (every 2s)
    if (!typingThrottleRef.current) {
      socket.emit("typing", { 
        roomId, 
        userId: currentUserId, 
        name: user.firstName, 
        isTyping: true 
      });
      typingThrottleRef.current = setTimeout(() => {
        typingThrottleRef.current = null;
      }, 2000);
    }

    // 2. Refresh "Stop Typing" timeout
    if (stopTypingRef.current) clearTimeout(stopTypingRef.current);
    stopTypingRef.current = setTimeout(() => {
      socket.emit("typing", { 
        roomId, 
        userId: currentUserId, 
        name: user.firstName, 
        isTyping: false 
      });
      stopTypingRef.current = null;
    }, 1500);
  };

  const pinMessage = (msg) => {
    if (userRole !== "instructor" || !roomId) return;
    socket.emit("pin-message", { roomId, message: msg });
  };

  const createPoll = () => {
    if (userRole !== "instructor" || !roomId) return;
    const q = pollQuestion.trim();
    const opts = pollOptions.filter(o => o.trim());
    if (!q || opts.length < 2) {
      toast.error("Poll needs a question and at least 2 options");
      return;
    }

    socket.emit("create-poll", {
      roomId,
      poll: { question: q, options: opts },
    });

    setPollQuestion("");
    setPollOptions(["Yes", "No"]);
    setShowPollCreator(false);
  };

  const closePoll = () => {
    if (userRole !== "instructor" || !roomId) return;
    socket.emit("close-poll", { roomId });
  };

  const muteAll = () => {
    if (userRole !== "instructor" || !roomId) return;
    socket.emit("mute-all", { roomId });
  };

  const unmuteAll = () => {
    if (userRole !== "instructor" || !roomId) return;
    socket.emit("unmute-all", { roomId });
  };

  // Instructor: emit new granular control events
  const muteUser   = (userId) => socket.emit("MUTE_USER",   { roomId, userId });
  const unmuteUser = (userId) => socket.emit("UNMUTE_USER", { roomId, userId });
  const allowVideo  = (userId) => socket.emit("ALLOW_VIDEO",  { roomId, userId });
  const revokeVideo = (userId) => socket.emit("REVOKE_VIDEO", { roomId, userId });
  const allowScreen  = (userId) => socket.emit("ALLOW_SCREEN",  { roomId, userId });
  const revokeScreen = (userId) => socket.emit("REVOKE_SCREEN", { roomId, userId });
  const allowBoard   = (userId) => socket.emit("ALLOW_BOARD",   { roomId, userId });
  const revokeBoard  = (userId) => socket.emit("REVOKE_BOARD",  { roomId, userId });

  const vote = (option) => {
    if (!roomId || !poll || votedOption) return;

    setVotedOption(option);
    socket.emit("vote-poll", {
      roomId,
      pollId: poll.id,
      option,
    });
  };

  // ——— RENDER ——————————————————————————————————————————————————————————————————————
  // Instructor sends explicit ALLOW/REVOKE events (no more bidirectional toggle)
  const togglePermission = (participant, key) => {
    if (userRole !== "instructor" || !roomId || !participant?.userId) return;
    const uid = participant.userId;
    const current = participant.permissions?.[key];

    if (key === "canSpeak")       current ? muteUser(uid)   : unmuteUser(uid);
    if (key === "canVideo")       current ? revokeVideo(uid)  : allowVideo(uid);
    if (key === "canShareScreen") current ? revokeScreen(uid) : allowScreen(uid);
    if (key === "canEditBoard")   current ? revokeBoard(uid)  : allowBoard(uid);
  };

  const canUseBoard = userRole === "instructor" || permissions?.canEditBoard;

  const getBoardPoint = (event) => {
    const canvas = boardRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    // Return completely normalized [0.0 - 1.0] coordinates to immunize against resize
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const renderToContext = (ctx, canvas, stroke) => {
    if (!ctx || !canvas || !stroke) return;
    const isEraser = stroke.tool?.type === "eraser" || stroke.tool === "eraser";
    ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    
    const strokeColor = stroke.tool?.color || stroke.color || "#FFD700";
    const strokeWidth = stroke.tool?.size || stroke.width || 3;
    
    ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(stroke.from.x * canvas.width, stroke.from.y * canvas.height);
    ctx.lineTo(stroke.to.x * canvas.width, stroke.to.y * canvas.height);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  const drawStroke = (stroke) => {
    const canvas = boardRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (canvas) renderToContext(canvas.getContext("2d"), canvas, stroke);
    if (offscreen) renderToContext(offscreen.getContext("2d"), offscreen, stroke);
  };

  const startBoardDraw = (event) => {
    if (!canUseBoard) return;
    event.target.setPointerCapture(event.pointerId);
    drawingRef.current = getBoardPoint(event);
  };

  const continueBoardDraw = (event) => {
    if (!canUseBoard) return;

    const nextPoint = getBoardPoint(event);
    if (!nextPoint) return;

    // Update local preview cursor
    // High-performance direct DOM update (60fps)
    const overlay = document.getElementById("brush-overlay");
    if (overlay) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      overlay.style.transform = `translate(${x}px, ${y}px)`;
      overlay.style.opacity = "1";
    }

    const now = Date.now();
    if (now - lastCursorEmitRef.current > 30) {
      socket.emit("CURSOR_MOVE", { roomId, x: nextPoint.x, y: nextPoint.y });
      lastCursorEmitRef.current = now;
    }

    if (!drawingRef.current) return;

    const stroke = {
      id: crypto.randomUUID(),
      userId: user?._id,
      userName: user?.firstName || "User",
      from: drawingRef.current,
      to: nextPoint,
      tool: { type: brushTool, color: brushColor, size: brushSize },
      timestamp: now,
    };

    // Instant local feedback
    drawStroke(stroke);
    boardHistoryRef.current.push(stroke);
    setHistoryCount(boardHistoryRef.current.length);

    // Add to batch (Pro V2)
    strokeBatchRef.current.push(stroke);
    if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(() => {
        if (strokeBatchRef.current.length > 0) {
          socket.emit("board-draw-batch", { 
            roomId, 
            strokes: strokeBatchRef.current 
          });
          strokeBatchRef.current = [];
        }
        batchTimeoutRef.current = null;
      }, 50); // 50ms batch pulse
    }

    drawingRef.current = nextPoint;
  };

  const stopBoardDraw = () => {
    drawingRef.current = null;
    socket.emit("CURSOR_MOVE", { roomId, x: -1, y: -1 });
  };

  // ─── Existing Logic Wrap (to be moved into main render later) ─────────────────
  const renderPeopleSection = () => (
    <div className="space-y-6">
       <section>
          <div className="mb-4 flex items-center justify-between">
             <h2 className="text-xl font-black text-indigo-400">Classroom</h2>
             <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-200">
               {participants.length} Active
             </span>
          </div>
          
          <div className="space-y-3">
             <div className="flex items-center gap-3 rounded-lg bg-richblack-800 p-3 border border-white/5 shadow-inner">
                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white ring-2 ring-indigo-500/30">
                  {user?.firstName?.charAt(0) || "U"}
                </div>
                <div>
                   <p className="text-sm font-bold text-white leading-tight">{user?.firstName} (You)</p>
                   <p className={`text-[10px] font-black uppercase tracking-wider ${userRole === "instructor" ? "text-yellow-400" : "text-indigo-300"}`}>
                     {userRole}
                   </p>
                </div>
             </div>
          </div>
       </section>

       <section className="border-t border-white/5 pt-6">
         <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-richblack-400">Moderation</h2>
         {userRole === "instructor" ? (
             <div className="space-y-3">
               {participants
                 .filter((participant) => participant.userId !== user?._id?.toString())
                 .map((participant) => (
                   <div key={participant.userId} className="rounded-xl border border-white/5 bg-richblack-800/50 p-3 transition-all hover:bg-richblack-800">
                     <p className="mb-3 text-sm font-bold text-richblack-25 tracking-tight">{participant.name}</p>
                     <div className="grid grid-cols-2 gap-2">
                       <button
                         onClick={() => togglePermission(participant, "canSpeak")}
                         className={`rounded-lg py-2 text-[10px] font-black uppercase transition-all ${
                           participant.permissions?.canSpeak ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-600 hover:text-white" : "bg-richblack-700 text-richblack-400 hover:bg-emerald-600 hover:text-white"
                         }`}
                       >
                         {participant.permissions?.canSpeak ? "🎤 Mute" : "🎤 Unmute"}
                       </button>
                       <button
                         onClick={() => togglePermission(participant, "canVideo")}
                         className={`rounded-lg py-2 text-[10px] font-black uppercase transition-all ${
                           participant.permissions?.canVideo ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-600 hover:text-white" : "bg-richblack-700 text-richblack-400 hover:bg-emerald-600 hover:text-white"
                         }`}
                       >
                         {participant.permissions?.canVideo ? "📹 No Cam" : "📹 Allow Cam"}
                       </button>
                       <button
                         onClick={() => togglePermission(participant, "canEditBoard")}
                         className={`rounded-lg py-2 text-[10px] font-black uppercase transition-all ${
                           participant.permissions?.canEditBoard ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-600 hover:text-white" : "bg-richblack-700 text-richblack-400 hover:bg-emerald-600 hover:text-white"
                         }`}
                       >
                         {participant.permissions?.canEditBoard ? "✏️ Revoke" : "✏️ Allow Board"}
                       </button>
                       <button
                         onClick={() => togglePermission(participant, "canShareScreen")}
                         className={`rounded-lg py-2 text-[10px] font-black uppercase transition-all ${
                           participant.permissions?.canShareScreen ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-600 hover:text-white" : "bg-richblack-700 text-richblack-400 hover:bg-emerald-600 hover:text-white"
                         }`}
                       >
                         {participant.permissions?.canShareScreen ? "🖥️ Revoke" : "🖥️ Allow Screen"}
                       </button>
                     </div>
                   </div>
                 ))}
             </div>
         ) : (
           <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
             {[
               { label: "Mic", key: "canSpeak", dot: "bg-emerald-500" },
               { label: "Cam", key: "canVideo", dot: "bg-emerald-500" },
               { label: "Board", key: "canEditBoard", dot: "bg-emerald-500" },
               { label: "Screen", key: "canShareScreen", dot: "bg-emerald-500" }
             ].map(p => (
               <div key={p.key} className={`flex items-center justify-between rounded-lg p-2.5 ${permissions?.[p.key] ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-richblack-800 text-richblack-500 border border-white/5"}`}>
                 <span>{p.label}</span>
                 <span className={`h-1.5 w-1.5 rounded-full ${permissions?.[p.key] ? "bg-emerald-400 animate-pulse" : "bg-richblack-600"}`}></span>
               </div>
             ))}
           </div>
         )}
       </section>

       <section className="border-t border-white/5 pt-6 pb-20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-richblack-400">Raised Hands</h2>
            <span className="text-xs font-bold text-indigo-400">{raisedHands.length}</span>
          </div>
          <div className="space-y-2">
                     {raisedHands.map((hand) => (
                        <div key={hand.id} className={`flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/5 transition-all duration-500 ${newHandId === hand.id ? "ring-2 ring-indigo-500 animate-bounce scale-105" : ""}`}>
                           <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">
                                 {hand.name.charAt(0)}
                              </div>
                              <div>
                                 <p className="text-xs font-bold text-white">{hand.name}</p>
                                 <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Waiting</p>
                              </div>
                           </div>
                           
                           {userRole === "instructor" && (
                             <div className="flex gap-2">
                               <button 
                                 onClick={() => socket.emit("RESOLVE_HAND", { roomId, userId: hand.id, name: hand.name })}
                                 className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                               >
                                 Accept
                               </button>
                               <button 
                                 onClick={() => socket.emit("DISMISS_HAND", { roomId, userId: hand.id })}
                                 className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all"
                               >
                                 Dismiss
                               </button>
                             </div>
                           )}
                           
                           <div className="text-[10px] text-white/20 font-mono italic">
                              {new Date(hand.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                           </div>
                        </div>
                     ))}
            {raisedHands.length === 0 && <p className="text-center text-[10px] font-black uppercase tracking-widest text-white/20 py-4 italic">No active requests</p>}
          </div>
       </section>
    </div>
  );

  const renderChatSection = () => (
    <div className="flex h-full flex-col">
       <div className="mb-6 flex items-center justify-between">
         <h2 className="text-2xl font-black tracking-tighter text-white">Class Stream</h2>
         <div className="flex gap-1.5 rounded-xl bg-white/5 p-1">
            {["all", "question", "important"].map(f => (
               <button 
                 key={f} 
                 onClick={() => setChatFilter(f)} 
                 className={`rounded-lg px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                   chatFilter === f ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                 }`}
               >
                 {f}
               </button>
            ))}
         </div>
       </div>

       <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
          {pinnedMessage && (
            <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-5 shadow-2xl animate-in slide-in-from-top-4 backdrop-blur-md">
               <div className="flex items-center gap-2 mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">Pinned Announcement</span>
               </div>
               <p className="text-[13px] text-richblack-25 font-bold leading-relaxed">{pinnedMessage.text}</p>
            </div>
          )}

          {groupedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-20 opacity-30 animate-in fade-in duration-1000">
               <div className="h-1.5 w-24 rounded-full bg-gradient-to-right from-transparent via-white/10 to-transparent animate-shimmer" 
                    style={{ backgroundSize: '200% 100%' }} />
               <div className="h-1.5 w-40 rounded-full bg-gradient-to-right from-transparent via-white/10 to-transparent animate-shimmer" 
                    style={{ backgroundSize: '200% 100%', animationDelay: '0.2s' }} />
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Awaiting Signal...</p>
            </div>
          ) : (
            groupedMessages.map((group, i) => (
              <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-bottom-1 duration-500">
                 {/* AVATAR COLUMN */}
                 <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-2xl flex items-center justify-center text-sm font-black text-white shadow-xl ring-2 ring-white/5 border border-white/5" style={{ background: stringToColor(group.name) }}>
                       {group.name.charAt(0)}
                    </div>
                 </div>

                 {/* CONTENT COLUMN */}
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                       <p className="text-sm font-black text-white/90 truncate">{group.name}</p>
                       <span className="text-[10px] font-bold text-white/20 whitespace-nowrap">
                         {new Date(group.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                    </div>
                    <div className="space-y-2">
                       {group.messages.map((msg, j) => (
                         <div 
                           key={j} 
                           className={`group relative rounded-2xl px-5 py-3.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-1 ${
                             group.type === "question" ? "bg-indigo-600/10 text-indigo-100 border border-indigo-500/20" : 
                             group.type === "important" ? "bg-pink-600/10 text-pink-100 border border-pink-500/20" : 
                             "bg-white/5 text-richblack-50 border border-white/5"
                           } hover:border-white/10 hover:shadow-lg hover:shadow-black/20`}
                         >
                            <div className="flex justify-between items-start gap-4">
                               <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                                <span className="text-[10px] select-none font-black uppercase tracking-tighter">
                                   {msg.error ? (
                                     <button 
                                       onClick={() => resendMessage(msg.msgId)} 
                                       className="text-pink-500 hover:text-pink-400 underline decoration-2 underline-offset-4 transition-all hover:scale-110 active:scale-95 px-1"
                                     >
                                       Retry
                                     </button>
                                   ) : (
                                     <span className="opacity-40">{msg.pending ? "⏳" : "✓✓"}</span>
                                   )}
                                </span>
                            </div>
                            {userRole === "instructor" && (
                              <button 
                                onClick={() => pinMessage(msg)} 
                                className="absolute right-2 top-2 scale-0 group-hover:scale-100 transition-all rounded-xl bg-black/60 px-3 py-1.5 text-[9px] font-black uppercase text-white hover:bg-indigo-600 border border-white/10"
                              >
                                Pin
                              </button>
                            )}
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
       </div>

       <div className="mt-6 space-y-4 bg-transparent pt-4 pb-12">
          {/* Typing Indicator */}
          <div className="h-4 pl-2 overflow-hidden">
             {Object.values(typingUsers).length > 0 && (
               <p className="text-[10px] font-bold text-white/30 animate-pulse tracking-widest uppercase">
                 {Object.values(typingUsers).slice(0, 2).join(", ")} 
                 {Object.values(typingUsers).length > 2 ? ` +${Object.values(typingUsers).length - 2}` : ""} 
                 {" typing..."}
               </p>
             )}
          </div>
          
          <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
             {["normal", "question", "important"].map(t => (
                <button 
                  key={t} 
                  onClick={() => setMessageType(t)} 
                  className={`flex-1 rounded-xl py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                    messageType === t ? "bg-indigo-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                  }`}
                >
                   {t}
                </button>
             ))}
          </div>
          <div className="flex items-center gap-3">
             <input 
               value={input} 
               onChange={(e) => {
                 setInput(e.target.value);
                 handleTyping();
               }} 
               onKeyDown={(e) => e.key === "Enter" && sendMessage()} 
               placeholder="Write to the class..." 
               className="flex-1 rounded-2xl bg-white/5 border border-white/5 px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500/50 transition-all shadow-inner placeholder:text-white/20" 
             />
             <button 
               onClick={sendMessage} 
               disabled={sending}
               className={`h-12 w-24 flex items-center justify-center rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                 sending ? "bg-richblack-800 text-white/20" : "bg-indigo-600 text-white shadow-indigo-600/20 hover:scale-110"
               }`}
             >
                {sending ? "Sending" : "🚀 Send"}
             </button>
          </div>
       </div>
    </div>
  );

  const renderPollSection = () => (
     <div className="flex h-full flex-col">
        <div className="mb-6 flex items-center justify-between">
           <h2 className="text-xl font-black text-indigo-400">Class Polls</h2>
           {userRole === "instructor" && (
              <button onClick={() => setShowPollCreator(!showPollCreator)} className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-black uppercase text-white shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all transition-all">
                 {showPollCreator ? "Cancel" : "+ New"}
              </button>
           )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
           {userRole === "instructor" && showPollCreator && (
              <div className="mb-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-inner">
                 <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Question..." className="mb-3 w-full rounded-xl bg-richblack-800 border border-white/5 px-4 py-3 text-sm text-white focus:border-indigo-500/50 outline-none transition-all" />
                 <div className="space-y-2 mb-4">
                    {pollOptions.map((o, i) => (
                       <input key={i} value={o} onChange={(e) => { const n=[...pollOptions]; n[i]=e.target.value; setPollOptions(n); }} placeholder={`Option ${i+1}`} className="w-full rounded-lg bg-richblack-900 border border-white/5 px-3 py-2 text-xs text-white" />
                    ))}
                 </div>
                 <button onClick={createPoll} className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-black uppercase text-white shadow-lg transition-all hover:bg-indigo-500">Launch Poll</button>
              </div>
           )}

           {poll ? (
              <div className="rounded-[32px] border border-white/5 bg-richblack-800/40 p-6 shadow-2xl backdrop-blur-xl">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Active Class Poll</p>
                 </div>
                 <h3 className="mb-8 text-xl font-bold text-white leading-tight">{poll.question}</h3>
                 <div className="space-y-4">
                    {poll.options.map(opt => {
                       const count = pollTally[opt] || 0;
                       const pct = totalVotes > 0 ? Math.round((count/totalVotes)*100) : 0;
                       return (
                          <button 
                             key={opt} 
                             disabled={!!votedOption || pollClosed} 
                             onClick={() => vote(opt)} 
                             className={`group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                               votedOption === opt ? "border-indigo-500 bg-indigo-500/10 shadow-indigo-500/10" : "border-white/5 bg-richblack-900/50 hover:border-white/20"
                             }`}
                           >
                              <div className="relative z-10 flex justify-between items-center">
                                 <span className={`text-[13px] font-bold transition-all ${votedOption === opt ? "text-indigo-400" : "text-white/60 group-hover:text-white"}`}>{opt}</span>
                                 <div className="flex items-center gap-3">
                                    {votedOption === opt && (
                                       <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest animate-in fade-in slide-in-from-right-2">
                                         ✔ Vote submitted
                                       </span>
                                     )}
                                    <span className="text-xs font-black text-white/20">{pct}%</span>
                                 </div>
                              </div>
                              <div 
                                 className="absolute bottom-0 left-0 h-1 bg-indigo-500/40 transition-[width] duration-700 ease-out" 
                                 style={{ width: `${pct}%` }} 
                              />
                           </button>
                       );
                    })}
                 </div>
                 <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6 text-[10px] font-black uppercase tracking-widest text-white/30">
                    <span>{totalVotes} total responses</span>
                    {userRole === "instructor" && !pollClosed && (
                      <button onClick={closePoll} className="text-pink-500 hover:text-pink-400 transition-colors">Close Poll</button>
                    )}
                 </div>
              </div>
           ) : (
               <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center animate-in fade-in duration-1000">
                  <div className="text-4xl grayscale opacity-30">📊</div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">No Active Polls</p>
                  <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest italic">Awaiting instructor prompt...</p>
               </div>
           )}
        </div>
     </div>
  );

  


  if (validating) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f14] text-indigo-400">
        <div className="flex flex-col items-center gap-4">
           <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-2xl shadow-indigo-500/20"></div>
           <p className="font-black uppercase tracking-widest text-sm animate-pulse">Verifying Access...</p>
        </div>
      </div>
    );
  }

  if (!validated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f14] px-4 text-center">
        <div className="max-w-md space-y-6">
           <h1 className="text-4xl font-black text-pink-500 drop-shadow-2xl">Access Denied</h1>
           <p className="text-richblack-200 font-medium leading-relaxed">{errorMsg}</p>
           <button onClick={() => navigate(-1)} className="rounded-xl bg-indigo-600 px-8 py-3 font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95">
             Go Back
           </button>
        </div>
      </div>
    );
  }



  // âœ¨ 4. Deterministic Stage Component (The UI Controller)
  // No-op placeholder to be moved outside

  return (
    <div className={`relative flex h-screen w-full flex-col overflow-hidden font-inter text-white transition-all duration-700 ${currentStage.bg}`}>
      
      {!isReady && (
        <div className="pointer-events-none fixed inset-0 z-[900] flex items-center justify-center bg-[#0f0f14]/90 text-indigo-300 backdrop-blur-xl">
          <div className="flex max-w-md flex-col items-center gap-6 rounded-3xl border border-white/10 bg-black/40 p-10 text-center shadow-2xl">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-[0_0_30px_rgba(79,70,229,0.3)]"></div>
            <div className="space-y-2">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-white">Initializing Classroom</p>
              <p className="text-xs font-semibold text-richblack-200">{connectionStep}</p>
            </div>
            <div className="flex gap-4">
               <div className={`h-1.5 w-12 rounded-full transition-all duration-1000 ${socketReady ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-white/10"}`} />
               <div className={`h-1.5 w-12 rounded-full transition-all duration-1000 ${zegoReady ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-white/10"}`} />
            </div>
          </div>
        </div>
      )}

      {/* ─── APP AREA ─── */}
      <div className="flex flex-1 relative overflow-hidden">
        <MainStage 
          viewMode={viewMode}
          setViewMode={setViewMode}
          currentStage={currentStage}
          activeStatus={activeStatus}
          isMobile={isMobile}
          meetingRef={meetingRef}
          boardRef={boardRef}
          canUseBoard={canUseBoard}
          activeDrawer={activeDrawer}
          brushSize={brushSize}
          startBoardDraw={startBoardDraw}
          continueBoardDraw={continueBoardDraw}
          stopBoardDraw={stopBoardDraw}
          remoteCursors={remoteCursors}
          chatSection={renderChatSection()}
          smooth={smooth}
        />

        {currentStage.showSidebar && isSidebarOpen && (
          <div className="hidden lg:flex h-full">
             <SidebarTabs 
               sidebarTab={sidebarTab}
               setSidebarTab={setSidebarTab}
               chatSection={renderChatSection()}
               peopleSection={renderPeopleSection()}
               pollSection={renderPollSection()}
             />
          </div>
        )}
      </div>

      {/* DASHBOARD OVERLAY */}
      {userRole === "instructor" && showDashboard && (
        <div className="fixed inset-0 z-[1000] flex animate-in fade-in duration-500">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setShowDashboard(false)} />
           <div className="relative mx-auto mt-12 w-full max-w-7xl overflow-hidden rounded-t-[60px] bg-[#0d0d12] border-x border-t border-white/10 shadow-[0_-40px_100px_rgba(0,0,0,0.9)] pb-12">
              <InstructorLiveDashboard metrics={liveMetrics} sessionId={sessionId} isLive={true} onClose={() => setShowDashboard(false)} />
           </div>
        </div>
      )}

      <BottomHUD 
        viewMode={viewMode}
        setViewMode={setViewMode}
        canUseBoard={canUseBoard}
        brushTool={brushTool}
        setBrushTool={setBrushTool}
        brushColor={brushColor}
        setBrushColor={setBrushColor}
        handleUndo={handleUndo}
        historyCount={historyCount}
        userRole={userRole}
        clearBoardCanvas={clearBoardCanvas}
        setShowDashboard={setShowDashboard}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        hasRaisedHand={hasRaisedHand}
        lowerHand={lowerHand}
        raiseHand={raiseHand}
        onEndClass={endClass}
        smooth={smooth}
      />
    </div>
  );
}

// ─── STABLE SUB-COMPONENTS (Moved outside to prevent unmount-remount cycles) ───

const MainStage = ({ 
  viewMode, setViewMode, currentStage, activeStatus, isMobile, 
  meetingRef, boardRef, canUseBoard, activeDrawer, brushSize, 
  startBoardDraw, continueBoardDraw, stopBoardDraw, remoteCursors, 
  chatSection, smooth 
}) => {
  return (
    <div className={`flex-1 relative overflow-hidden ${smooth} ${currentStage.bg}`}>
      
      {activeStatus && (
        <div className="absolute left-1/2 top-10 z-[60] -translate-x-1/2 animate-in slide-in-from-top-6 duration-700">
           <div className={`flex items-center gap-4 rounded-[20px] border border-white/10 px-8 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl ${
             activeStatus.type === "error" ? "bg-red-500/10 text-red-100 border-red-500/20" : 
             activeStatus.type === "warning" ? "bg-yellow-500/10 text-yellow-100 border-yellow-500/20" : 
             "bg-[#0f0f14]/80 text-indigo-100 border-indigo-500/20"
           }`}>
              <div className={`h-2 w-2 rounded-full ${
                activeStatus.type === "error" ? "bg-red-500 animate-pulse" : 
                activeStatus.type === "warning" ? "bg-yellow-500 animate-pulse" : 
                "bg-indigo-500"
              }`} />
              <span className="text-[11px] font-black uppercase tracking-[0.25em]">{activeStatus.label}</span>
           </div>
        </div>
      )}

      <div 
        onClick={() => viewMode === "board" && setViewMode("default")}
        className={`${smooth} absolute z-10 overflow-hidden rounded-[32px] md:rounded-[48px] border border-white/10 bg-black shadow-[0_40px_100px_rgba(0,0,0,0.7)] ${
          isMobile && viewMode !== "discussion" ? "inset-0 h-full w-full rounded-none" :
          currentStage.video === "primary" ? "left-4 top-4 md:left-8 md:top-8 h-[40%] md:h-[58%] w-[calc(100%-2rem)] md:w-[calc(100%-4rem)]" :
          currentStage.video === "pip"     ? "right-4 top-12 md:right-10 h-32 w-56 md:h-44 md:w-80 z-40 cursor-pointer ring-[8px] md:ring-[12px] ring-black/40" :
          "hidden"
        }`}
      >
         <div id="zego-container" ref={meetingRef} className="h-full w-full" />
         <div className="absolute bottom-4 left-6 rounded-xl bg-black/60 px-4 py-1.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/50 shadow-2xl backdrop-blur-xl">
           {viewMode === "board" ? "💻 PANEL" : "📡 LIVE"}
         </div>
      </div>

      {/* ✅ BOARD LAYER - Config Driven */}
      <div className={`${smooth} absolute z-[20] overflow-hidden bg-[#07070a] shadow-2xl border-2 border-indigo-500/30 ${
        isMobile && viewMode === "discussion" ? "bottom-4 right-4 h-32 w-56 rounded-2xl z-50 border border-white/20" :
        currentStage.board === "split"      ? "bottom-4 left-4 md:bottom-8 md:left-8 h-[52%] md:h-[32%] w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] rounded-[32px] md:rounded-[40px] border border-white/5" :
        currentStage.board === "fullscreen" ? "inset-0 h-full w-full z-0 opacity-100" :
        "opacity-0 pointer-events-none scale-95"
      }`}>
          <div className="absolute top-2 right-2 z-50 px-2 py-1 bg-indigo-600 text-[8px] font-black uppercase rounded">DEBUG: BOARD</div>
          {activeDrawer && (
            <div className="absolute top-6 left-6 z-10 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 rounded-2xl bg-black/60 px-5 py-2.5 backdrop-blur-md border border-white/10 shadow-2xl">
                 <span className="animate-pulse">✍️</span>
                 <span className="text-[11px] font-black uppercase tracking-widest text-white">
                   {activeDrawer} is drawing...
                 </span>
              </div>
            </div>
          )}

          <canvas 
            ref={boardRef} 
            className="h-full w-full touch-none" 
            onPointerDown={startBoardDraw} 
            onPointerMove={continueBoardDraw} 
            onPointerUp={stopBoardDraw}
            onPointerLeave={() => {
              const overlay = document.getElementById("brush-overlay");
              if (overlay) overlay.style.opacity = "0";
            }}
          />
          
          {canUseBoard && (
            <div 
              id="brush-overlay"
              className="pointer-events-none absolute left-0 top-0 z-[100] rounded-full border-2 border-indigo-500/40 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-opacity duration-300 opacity-0"
              style={{ 
                width: brushSize, 
                height: brushSize,
                marginLeft: -brushSize/2,
                marginTop: -brushSize/2,
                mixBlendMode: 'difference'
              }}
            />
          )}
         
         {viewMode === "board" && (
           <div className="absolute top-4 left-4 md:top-10 md:left-10 pointer-events-none flex items-center gap-4 animate-in slide-in-from-left-4 duration-1000">
               <div className="flex items-center gap-2 md:gap-4 rounded-2xl md:rounded-3xl bg-black/40 px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-white/40 backdrop-blur-3xl border border-white/10 shadow-2xl">
                  <div className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full ${activeDrawer ? "bg-indigo-500 animate-ping" : "bg-emerald-500 animate-pulse"}`} />
                  {activeDrawer ? `DRAWING: ${activeDrawer}` : `BOARD`}
               </div>
           </div>
         )}
      </div>

      {/* ✅ DISCUSSION OVERLAY (Adaptive) */}
      {(viewMode === "discussion" || (isMobile && viewMode === "default")) && (
        <div className={`${smooth} absolute md:right-8 md:top-8 md:bottom-8 w-full md:w-[440px] h-full md:h-auto flex flex-col md:rounded-[48px] border-t md:border border-white/5 bg-[#07070a]/95 p-6 md:p-10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-20 md:slide-in-from-right-20 duration-700 backdrop-blur-3xl z-40`}>
           <div className="md:hidden flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Mobile Stream Active</span>
              </div>
              <button onClick={() => setViewMode("board")} className="px-4 py-2 rounded-xl bg-white/5 text-[9px] font-black uppercase tracking-widest border border-white/10">Switch to Board</button>
           </div>
           {chatSection}
        </div>
      )}

      {/* ✅ REMOTE CURSORS */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
         {Object.entries(remoteCursors).map(([uid, cursor]) => (
             <div key={uid} className="absolute z-30 flex items-center gap-3 will-change-transform"
                  style={{ 
                    transform: `translate(${cursor.x * 100}%, ${cursor.y * 100}%)`,
                    transition: 'transform 120ms linear' 
                  }}>
               <div className={`h-3.5 w-3.5 rounded-full border border-white shadow-2xl ring-4 ring-black/20 ${activeDrawer === cursor.name ? "ring-white/30 scale-150 animate-pulse" : ""}`} 
                    style={{ background: stringToColor(uid) }} />
               <span className="rounded-xl bg-black/80 px-4 py-2 text-[11px] font-black tracking-widest text-white border border-white/10 backdrop-blur-2xl whitespace-nowrap shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                 {cursor.name}
               </span>
            </div>
         ))}
      </div>
    </div>
  );
};

const SidebarTabs = ({ sidebarTab, setSidebarTab, chatSection, peopleSection, pollSection }) => (
  <div className={`flex h-full w-[400px] flex-col border-l border-white/5 bg-[#0a0a0f] shadow-[calc(-20px)_0_60px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden`}>
    <div className="flex bg-[#07070a] px-8 pt-6 pb-2 gap-8 ring-1 ring-white/5">
      {["chat", "people", "polls"].map((tab) => (
        <button
          key={tab}
          onClick={() => setSidebarTab(tab)}
          className={`relative pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
            sidebarTab === tab ? "text-white" : "text-white/20 hover:text-white/40"
          }`}
        >
          {tab}
          {sidebarTab === tab && (
            <div className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-in fade-in zoom-in-50 duration-500" />
          )}
        </button>
      ))}
    </div>
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
      <div className="animate-in fade-in slide-in-from-right-4 duration-700">
         {sidebarTab === "chat" && chatSection}
         {sidebarTab === "people" && peopleSection}
         {sidebarTab === "polls" && pollSection}
      </div>
    </div>
  </div>
);

const BottomHUD = ({ 
  viewMode, setViewMode, canUseBoard, brushTool, setBrushTool, 
  brushColor, setBrushColor, handleUndo, historyCount, userRole, 
  clearBoardCanvas, setShowDashboard, isSidebarOpen, setIsSidebarOpen, 
  hasRaisedHand, lowerHand, raiseHand, onEndClass, smooth 
}) => (
  <div className={`fixed bottom-8 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-6 rounded-3xl border border-white/10 bg-richblack-900/60 p-2.5 px-8 shadow-2xl backdrop-blur-2xl ${smooth}`}>

    <div className="flex items-center gap-2 border-r border-white/10 pr-6">
       {[
         { mode: "default", icon: "📺", label: "Teach" },
         { mode: "board", icon: "✏️", label: "Board" },
         { mode: "discussion", icon: "💬", label: "Group" }
       ].map(m => (
         <button 
           key={m.mode}
           onClick={() => setViewMode(m.mode)} 
           className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 ${
             viewMode === m.mode ? "bg-indigo-600 shadow-xl shadow-indigo-500/40 scale-110" : "hover:bg-white/10 text-white/40 hover:text-white"
           }`}
         >
           <span className="text-lg">{m.icon}</span>
           <span className="absolute -top-12 left-1/2 -translate-x-1/2 scale-0 rounded-lg bg-richblack-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter text-white shadow-2xl transition-all group-hover:scale-100">{m.label}</span>
         </button>
       ))}
    </div>
    {viewMode === "board" && canUseBoard && (
      <div className="flex items-center gap-1 border-r border-white/10 pr-6 animate-in zoom-in-90 duration-300">
         <div className="flex items-center gap-1 rounded-2xl bg-white/5 p-1">
            <button onClick={() => setBrushTool("pen")} className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${brushTool === "pen" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}>✏️</button>
            <button onClick={() => setBrushTool("eraser")} className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${brushTool === "eraser" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}>🧽</button>
         </div>
         <div className="flex items-center gap-2 px-2">
            {["#FFD700", "#FFFFFF", "#FF5252", "#42A5F5"].map(c => (
              <button 
                key={c} 
                onClick={() => setBrushColor(c)}
                className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-125 ${brushColor === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
         </div>
         <button onClick={handleUndo} disabled={historyCount === 0} className="h-9 w-9 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-10 transition-all font-black text-xs">UND</button>
         {userRole === "instructor" && (
           <button onClick={() => clearBoardCanvas(true)} className="h-9 px-3 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-red-500/20 transition-all font-black text-xs">CLR</button>
         )}
      </div>
    )}
    <div className="flex items-center gap-4">
        {userRole === "instructor" && (
          <button onClick={() => setShowDashboard(true)} className="group flex items-center gap-2 rounded-2xl bg-yellow-50 px-5 py-2.5 text-[11px] font-black tracking-widest text-black shadow-xl shadow-yellow-500/10 transition-all hover:bg-white hover:scale-105 active:scale-95">
            <span className="animate-pulse group-hover:animate-none">📊</span> ANALYTICS
          </button>
        )}
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 transition-all ${isSidebarOpen ? "bg-white/10 text-white" : "bg-transparent text-white/40 hover:bg-white/5"}`}>
          {isSidebarOpen ? "📂" : "📁"}
        </button>
        <div className="flex flex-col items-center">
           <button onClick={hasRaisedHand ? lowerHand : raiseHand} className={`flex items-center gap-2 rounded-2xl px-6 py-2.5 text-[11px] font-black tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl ${hasRaisedHand ? "bg-pink-600 text-white shadow-pink-500/20" : "bg-indigo-600 text-white shadow-indigo-500/20"}`}>
             {hasRaisedHand ? "✋ LOWER HAND" : "✋ RAISE HAND"}
           </button>
           {hasRaisedHand && (
             <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-yellow-500 animate-bounce flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 rounded-full">
               <span className="animate-pulse">✋</span> Pending approval...
             </p>
           )}
        </div>

        {userRole === "instructor" && (
           <button
             onClick={() => {
               if (window.confirm("Are you sure you want to END the class for everyone?")) {
                 onEndClass();
                 window.location.href = "/dashboard/my-courses";
               }
             }}
             className="flex items-center gap-2 rounded-2xl bg-red-600 px-6 py-2.5 text-[11px] font-black tracking-widest text-white shadow-xl shadow-red-500/20 transition-all hover:bg-red-500 hover:scale-105 active:scale-95"
           >
             🛑 END CLASS
           </button>
        )}
    </div>
  </div>
);

function stringToColor(str) {
  if (!str) return "#6366f1";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
}
