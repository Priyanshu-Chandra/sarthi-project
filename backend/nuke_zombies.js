const mongoose = require("mongoose");
const Course = require("./models/course");
const LiveSession = require("./models/LiveSession");
require("dotenv").config();

const nukeZombies = async () => {
  try {
    console.log("🚀 Connecting to database to nuke zombies...");
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("✅ Connected.");

    console.log("🧹 Clearing 'isLive' flag from all courses...");
    const courseRes = await Course.updateMany(
      { isLive: true },
      { 
        $set: { 
          isLive: false, 
          liveRoomId: null, 
          lastHeartbeatAt: null, 
          liveStartedAt: null 
        } 
      }
    );
    console.log(`✅ Updated ${courseRes.modifiedCount} courses.`);

    console.log("🧹 Marking all active LiveSessions as 'completed'...");
    const sessionRes = await LiveSession.updateMany(
      { status: "active" },
      { $set: { status: "completed", endedAt: new Date(), endedReason: "manual_nuke" } }
    );
    console.log(`✅ Updated ${sessionRes.modifiedCount} sessions.`);

    console.log("✨ All zombies cleared. You can now start a fresh class.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Nuke failed:", err.message);
    process.exit(1);
  }
};

nukeZombies();
