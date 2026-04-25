const mongoose = require('mongoose');
require('dotenv').config();

const Course = require('./models/course');

async function forceClearZombie() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to DB');

        const result = await Course.updateMany(
            { courseName: /linux devops/i, isLive: true },
            { 
               $set: { 
                 isLive: false, 
                 liveRoomId: null, 
                 lastHeartbeatAt: null,
                 liveStartedAt: null 
               } 
            }
        );

        console.log(`✅ Force cleared ${result.modifiedCount} zombie session(s).`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

forceClearZombie();
