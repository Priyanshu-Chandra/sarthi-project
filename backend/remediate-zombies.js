const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Course = require('./models/course');
const LiveSession = require('./models/LiveSession');

async function remediateZombies() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        
        console.log('🏁 Starting remediation...');
        
        // 1. Identify all courses currently marked as LIVE
        const liveCourses = await Course.find({ isLive: true });
        console.log(`Found ${liveCourses.length} courses marked as LIVE.`);
        
        for (const course of liveCourses) {
            // Check if there is ANY active LiveSession for this course
            const activeSession = await LiveSession.findOne({ 
                courseId: course._id, 
                status: 'active' 
            });
            
            if (!activeSession) {
                console.log(`🧹 Killing zombie state for Course: ${course.courseName} (${course._id})`);
                await Course.findByIdAndUpdate(course._id, {
                    isLive: false,
                    liveRoomId: null,
                    lastHeartbeatAt: null,
                    liveStartedAt: null
                });
            } else {
                console.log(`⚠️ Course ${course.courseName} has an active session. Checking age...`);
                const ageMinutes = (Date.now() - new Date(activeSession.startedAt).getTime()) / 60000;
                if (ageMinutes > 720) { // 12 hours failsafe
                    console.log(`🔥 Force-terminating stale session (>12h) for ${course.courseName}`);
                    await LiveSession.findByIdAndUpdate(activeSession._id, { status: 'ended', endedAt: new Date(), endedReason: 'force_remediation' });
                    await Course.findByIdAndUpdate(course._id, { isLive: false, liveRoomId: null });
                } else {
                    console.log(`✅ Session for ${course.courseName} is recent (${Math.round(ageMinutes)}m). Skipping.`);
                }
            }
        }
        
        console.log('✨ Remediation complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

remediateZombies();
