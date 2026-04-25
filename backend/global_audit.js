const mongoose = require('mongoose');
require('dotenv').config();

const TestResult = require('./models/TestResult');
const Test = require('./models/Test');
const User = require('./models/User');

async function auditAllResults() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to DB');

        // Find all test results
        const results = await TestResult.find().sort({ createdAt: -1 }).limit(20);
        
        console.log('\n--- Recent Global Test Activity ---');
        for (const r of results) {
            const test = await Test.findById(r.testId || r.quizId);
            const student = await User.findById(r.studentId);
            console.log(`- Test: ${test?.title || 'Unknown'} | CourseID: ${test?.courseId} | Student: ${student?.firstName} ${student?.lastName} | Status: ${r.status} | Date: ${r.createdAt}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

auditAllResults();
