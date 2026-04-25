const LiveSession   = require("../models/LiveSession");
const LiveAttendance = require("../models/LiveAttendance");
const LiveEvent     = require("../models/LiveEvent");
const mongoose      = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/live-analytics/session/:sessionId/summary
// Returns post-class aggregated metrics for a finished session.
// ─────────────────────────────────────────────────────────────────────────────
exports.getSessionSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid sessionId" });
    }

    const session = await LiveSession.findById(sessionId)
      .populate("courseId", "courseName")
      .populate("instructorId", "firstName lastName");

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    // [Production Hardening] Early return for cached sessions
    // Avoids 3 aggregates and 2 heavy finds in the common case.
    if (session.summaryCache) {
      // Small optimization: Fetch top participants only (they aren't cached fully with population)
      // Optimized query: only select necessary fields
      const topParticipants = await LiveAttendance.find({ sessionId })
        .sort({ engagementScore: -1 })
        .limit(5)
        .select("userId activeSeconds engagementScore rejoinCount attendanceStatus")
        .populate("userId", "firstName lastName email");

      return res.status(200).json({
        success: true,
        summary: {
          sessionId,
          course:          session.courseId?.courseName || "Unknown",
          instructor:      session.instructorId ? `${session.instructorId.firstName} ${session.instructorId.lastName}` : "Unknown",
          startedAt:       session.startedAt,
          endedAt:         session.endedAt,
          durationSeconds: session.endedAt ? Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 1000) : null,
          status:          session.status,
          endedReason:     session.endedReason,
          expectedStudents: session.expectedStudents,
          totalAttended:   session.presentStudents,
          attendanceRate:  session.expectedStudents ? Math.round((session.presentStudents / session.expectedStudents) * 100) : null,
          
          activeCount:     session.summaryCache.activeCount,
          passiveCount:    session.summaryCache.passiveCount,
          dropoffCount:    session.summaryCache.dropoffCount,
          lateJoiners:     session.summaryCache.lateJoiners,
          unstableCount:   session.summaryCache.unstableCount,
          insights:        session.summaryCache.insights,
          raisedHands:     session.summaryCache.raisedHands || session.raisedHands || 0,
          
          // Normalized mapping for frontend
          timeline:        session.engagementTimeline || [],
          
          messages:        session.messages || 0,
          polls:           session.pollResponses || 0,
          board:           session.boardDraws || 0,

          topParticipants: topParticipants.map(a => ({
            userId:         a.userId?._id,
            name:           a.userId ? `${a.userId.firstName} ${a.userId.lastName}` : "Unknown",
            email:          a.userId?.email,
            engagementScore: a.engagementScore,
            activeMinutes:  Math.round(a.activeSeconds / 60),
            rejoinCount:    a.rejoinCount,
            status:         a.attendanceStatus
          })),
        }
      });
    }

    // ── FALLBACK FOR LEGACY DATA (If no summaryCache) ───────────────────────
    
    const attendanceStats = await LiveAttendance.aggregate([
      { $match: { sessionId: new mongoose.Types.ObjectId(sessionId) } },
      {
        $group: {
          _id: null,
          totalAttended:    { $sum: 1 },
          avgActiveSeconds: { $avg: "$activeSeconds" },
          avgEngagement:    { $avg: "$engagementScore" },
        },
      },
    ]);

    const stats = attendanceStats[0] || { totalAttended: 0, avgActiveSeconds: 0, avgEngagement: 0 };

    // Top 5 participants (highest engagement)
    const topParticipants = await LiveAttendance.find({ sessionId })
      .sort({ engagementScore: -1 })
      .limit(5)
      .populate("userId", "firstName lastName email");

    // Low-engagement students (score < 2 = silent the whole class)
    const lowEngagement = await LiveAttendance.find({ sessionId, engagementScore: { $lt: 2 } })
      .populate("userId", "firstName lastName email");

    // Event breakdown counts
    const eventCounts = await LiveEvent.aggregate([
      { $match: { sessionId: new mongoose.Types.ObjectId(sessionId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    const eventMap = {};
    eventCounts.forEach(e => { eventMap[e._id] = e.count; });

    const durationSeconds = session.endedAt
      ? Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 1000)
      : null;

    return res.status(200).json({
      success: true,
      summary: {
        sessionId,
        course:          session.courseId?.courseName || "Unknown",
        instructor:      session.instructorId ? `${session.instructorId.firstName} ${session.instructorId.lastName}` : "Unknown",
        startedAt:       session.startedAt,
        endedAt:         session.endedAt,
        status:          session.status,
        topParticipants: [],
        insights:        []
      },
    });
  } catch (err) {
    console.error("getSessionSummary error:", err);
    return res.status(500).json({ success: false, message: "Failed to load session summary", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/live-analytics/course/:courseId/history
// Returns all past sessions for a course (list view for dashboard).
// ─────────────────────────────────────────────────────────────────────────────
exports.getCourseSessionHistory = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Invalid courseId" });
    }

    const sessions = await LiveSession.find({ courseId })
      .sort({ startedAt: -1 })
      .limit(20)
      .select("startedAt endedAt status endedReason expectedStudents presentStudents avgEngagementScore liveRoomId");

    return res.status(200).json({ success: true, sessions });
  } catch (err) {
    console.error("getCourseSessionHistory error:", err);
    return res.status(500).json({ success: false, message: "Failed to load history", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/live-analytics/session/:sessionId/students
// Full per-student attendance table for a session (paginated).
// ─────────────────────────────────────────────────────────────────────────────
exports.getSessionStudents = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid sessionId" });
    }

    const [students, total] = await Promise.all([
      LiveAttendance.find({ sessionId })
        .sort({ engagementScore: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "firstName lastName email"),
      LiveAttendance.countDocuments({ sessionId }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      students: students.map(a => ({
        userId:          a.userId?._id,
        name:            a.userId ? `${a.userId.firstName} ${a.userId.lastName}` : "Unknown",
        email:           a.userId?.email,
        joinedAt:        a.joinedAt,
        leftAt:          a.leftAt,
        activeMinutes:   Math.round(a.activeSeconds / 60),
        engagementScore: a.engagementScore,
        rejoinCount:     a.rejoinCount,
        status:          a.attendanceStatus || a.status,
        atRisk:          a.attendanceStatus === "dropoff",
      })),
    });
  } catch (err) {
    console.error("getSessionStudents error:", err);
    return res.status(500).json({ success: false, message: "Failed to load students", error: err.message });
  }
};
