const LiveSession   = require("../models/LiveSession");
const LiveAttendance = require("../models/LiveAttendance");
const PollResult     = require("../models/PollResult");
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
    // Recompute all metrics on the fly from raw attendance + event data.

    const allAttendances = await LiveAttendance.find({ sessionId })
      .populate("userId", "firstName lastName email");

    const durationSeconds = session.endedAt
      ? Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 1000)
      : 1;

    let activeCount = 0, passiveCount = 0, dropoffCount = 0, lateCount = 0, unstableCount = 0;
    const sessionStart = session.startedAt ? new Date(session.startedAt).getTime() : 0;

    allAttendances.forEach(att => {
      const ratio = att.activeSeconds / durationSeconds;
      if (att.activeSeconds >= 30) {
        if (ratio >= 0.6) activeCount++;
        else if (ratio >= 0.2) passiveCount++;
        else dropoffCount++;
      } else {
        dropoffCount++;
      }
      if (att.joinedAt && (new Date(att.joinedAt).getTime() - sessionStart > 5 * 60 * 1000)) lateCount++;
      if (att.rejoinCount > 3) unstableCount++;
    });

    const totalStudents = allAttendances.length || 1;

    // Build insights
    const insights = [];
    if (dropoffCount / totalStudents > 0.3) insights.push({ level: "high",   msg: "High drop-off detected mid-session" });
    if (unstableCount / totalStudents > 0.2) insights.push({ level: "high",   msg: "Many students faced connection instability" });
    if (lateCount / totalStudents > 0.2)     insights.push({ level: "low",    msg: "Significant number of late joiners" });
    insights.push({ level: "low", msg: `Average active time: ${Math.round((allAttendances.reduce((s, a) => s + a.activeSeconds, 0) / totalStudents) / 60)} min per student` });

    // Top 5 by engagement score
    const topParticipants = [...allAttendances]
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5)
      .map(a => ({
        userId:          a.userId?._id,
        name:            a.userId ? `${a.userId.firstName} ${a.userId.lastName}` : "Unknown",
        email:           a.userId?.email,
        engagementScore: a.engagementScore,
        activeMinutes:   Math.round(a.activeSeconds / 60),
        rejoinCount:     a.rejoinCount,
        status:          a.attendanceStatus || "active",
      }));

    return res.status(200).json({
      success: true,
      summary: {
        sessionId,
        course:           session.courseId?.courseName || "Unknown",
        instructor:       session.instructorId ? `${session.instructorId.firstName} ${session.instructorId.lastName}` : "Unknown",
        startedAt:        session.startedAt,
        endedAt:          session.endedAt,
        durationSeconds,
        status:           session.status,
        endedReason:      session.endedReason,
        expectedStudents: session.expectedStudents,
        totalAttended:    totalStudents,
        attendanceRate:   session.expectedStudents
          ? Math.round((totalStudents / session.expectedStudents) * 100) : null,
        activeCount,
        passiveCount,
        dropoffCount,
        lateJoiners:      lateCount,
        unstableCount,
        raisedHands:      session.raisedHands || 0,
        messages:         session.messages || 0,
        polls:            session.pollResponses || 0,
        board:            session.boardDraws || 0,
        timeline:         session.engagementTimeline || [],
        insights,
        topParticipants,
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
        breakdown:       a.engagementBreakdown || { chat:0, polls:0, board:0, hands:0 }
      })),
    });
  } catch (err) {
    console.error("getSessionStudents error:", err);
    return res.status(500).json({ success: false, message: "Failed to load students", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/live-analytics/session/:sessionId/polls
// Returns all poll results recorded during the session.
// ─────────────────────────────────────────────────────────────────────────────
exports.getSessionPolls = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid sessionId" });
    }

    const polls = await PollResult.find({ sessionId }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      polls: polls.map(p => ({
        id:         p.pollId,
        question:   p.question,
        options:    p.options,
        tally:      p.tally instanceof Map ? Object.fromEntries(p.tally) : p.tally,
        totalVotes: p.totalVotes,
        createdAt:  p.createdAt
      }))
    });
  } catch (err) {
    console.error("getSessionPolls error:", err);
    return res.status(500).json({ success: false, message: "Failed to load polls", error: err.message });
  }
};
