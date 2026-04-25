const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const LiveSession = require('./models/LiveSession');
const Course = require('./models/course');

async function countZombies() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        
        const activeSessions = await LiveSession.find({ status: 'active' });
        const liveCourses = await Course.find({ isLive: true });
        
        console.log('--- Database State ---');
        console.log('Active LiveSessions:', activeSessions.length);
        activeSessions.forEach(s => {
            console.log(`  - SessionID: ${s._id} | RoomID: ${s.liveRoomId} | StartedAt: ${s.startedAt}`);
        });
        
        console.log('Live Courses:', liveCourses.length);
        liveCourses.forEach(c => {
            console.log(`  - Course: ${c.courseName} | ID: ${c._id} | RoomID: ${c.liveRoomId} | Heartbeat: ${c.lastHeartbeatAt}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

countZombies();
