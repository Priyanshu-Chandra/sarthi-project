const mongoose = require('mongoose');
require('dotenv').config();

const TestResult = require('./models/TestResult');

async function checkGlobalTestResults() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to DB');

        const testId = '69c23440f2bc849ba01ec340';
        
        const results = await TestResult.find({
            $or: [
                { testId: testId },
                { quizId: testId }
            ]
        }).populate('studentId', 'firstName lastName email');

        console.log('\n--- ALL Submissions for "Basics Of Programming" ---');
        console.log('Total Records Found:', results.length);
        
        results.forEach(r => {
            console.log(`- Student: ${r.studentId?.firstName} ${r.studentId?.lastName} | Status: ${r.status} | Score: ${r.score} | Date: ${r.createdAt} | StudentID: ${r.studentId?._id}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkGlobalTestResults();
