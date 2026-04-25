const mongoose = require('mongoose');
require('dotenv').config();

const Course = require('./models/Course');
const Test = require('./models/Test');
const TestResult = require('./models/TestResult');
const User = require('./models/User');

async function checkDetailedActivity() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to DB');

        const courseId = '69c11d2ca8bc95d8b2aea63e';
        const course = await Course.findById(courseId);
        
        if (!course) {
            console.log('Course not found');
            return;
        }

        console.log('Course:', course.courseName);
        console.log('Instructor ID:', course.instructor);
        
        const enrolledIds = course.studentsEnrolled || [];
        console.log('Enrolled Student Count:', enrolledIds.length);
        
        if (enrolledIds.length > 0) {
            const students = await User.find({ _id: { $in: enrolledIds } }).select('firstName lastName email');
            console.log('\n--- Enrolled Students ---');
            students.forEach(s => console.log(`- ${s.firstName} ${s.lastName} (${s.email}) [ID: ${s._id}]`));

            const tests = await Test.find({ courseId: courseId });
            console.log('\n--- Tests in Course ---');
            tests.forEach(t => console.log(`- ${t.title} [ID: ${t._id}]`));

            const testIds = tests.map(t => t._id);

            if (testIds.length > 0) {
                const results = await TestResult.find({
                    $or: [
                        { testId: { $in: testIds } },
                        { quizId: { $in: testIds } }
                    ],
                    studentId: { $in: enrolledIds }
                });

                console.log('\n--- Student Test Results ---');
                if (results.length === 0) {
                    console.log('No results found for these students/tests.');
                } else {
                    results.forEach(r => {
                        console.log(`- StudentID: ${r.studentId} | TestID: ${r.testId} | Status: ${r.status} | Score: ${r.score} | Date: ${r.createdAt}`);
                    });
                }
            } else {
                console.log('No tests found in this course.');
            }
        } else {
            console.log('No students enrolled in this course.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkDetailedActivity();
