const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Course = require('./models/course');
const LiveSession = require('./models/LiveSession');

async function auditAll() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        
        console.log('--- GLOBAL LIVE AUDIT ---');
        
        const liveCourses = await Course.find({ isLive: true }).populate('instructor', 'firstName lastName email');
        console.log(`Live Courses Count: ${liveCourses.length}`);
        liveCourses.forEach(c => {
            console.log(`- Course: ${c.courseName} (${c._id})`);
            console.log(`  Instructor: ${c.instructor?.email}`);
            console.log(`  RoomID: ${c.liveRoomId}`);
        });

        const activeSessions = await LiveSession.find({ status: 'active' });
        console.log(`Active Sessions Count: ${activeSessions.length}`);
        activeSessions.forEach(s => {
            console.log(`- Session: ${s._id} | CourseID: ${s.courseId} | RoomID: ${s.liveRoomId}`);
        });

        console.log('--- END AUDIT ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

auditAll();
