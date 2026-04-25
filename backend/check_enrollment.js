const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Course = require('./models/Course');
const Test = require('./models/Test');
const TestResult = require('./models/TestResult');

async function checkEnrollment() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to DB');

        const instructor = await User.findOne({ 
            $or: [
                { firstName: /Priyanshu/i, lastName: /Chandra/i },
                { email: /priyanshu/i }
            ]
        });

        if (!instructor) {
            console.log('Instructor Priyanshu Chandra not found');
            return;
        }
        console.log('Instructor Found:', instructor.firstName, instructor.lastName, 'ID:', instructor._id);

        const course = await Course.findOne({ 
            courseName: /DSA in Action/i, 
            instructor: instructor._id 
        });

        if (!course) {
            console.log('Course "DSA in Action" not found for this instructor');
            return;
        }
        console.log('Course Found:', course.courseName, 'ID:', course._id);
        
        const enrolledIds = course.studentsEnrolled || [];
        console.log('Enrolled Student Count:', enrolledIds.length);

        if (enrolledIds.length > 0) {
            const students = await User.find({ _id: { $in: enrolledIds } }).select('firstName lastName email');
            console.log('\n--- Enrolled Students ---');
            students.forEach(s => console.log(`- ${s.firstName} ${s.lastName} (${s.email})`));

            const tests = await Test.find({ courseId: course._id });
            console.log('\n--- Tests in Course ---');
            tests.forEach(t => console.log(`- ${t.title} (ID: ${t._id})`));
            
            const testIds = tests.map(t => t._id);

            // Check results matching these tests AND these students
            const results = await TestResult.find({ 
                $or: [
                    { testId: { $in: testIds } },
                    { quizId: { $in: testIds } }
                ],
                studentId: { $in: enrolledIds }
            }).populate('testId', 'title').populate('studentId', 'firstName lastName');

            console.log('\n--- Student Activity (ALL) ---');
            const finished = results.filter(r => r.status === 'COMPLETED' || r.status ==='CHEATED');
            console.log('Total Processed Attempts:', finished.length);
            
            results.forEach(r => {
                console.log(`- Student: ${r.studentId?.firstName} | Test: ${r.testId?.title || 'Unknown'} | Status: ${r.status} | Score: ${r.score}/${r.totalQuestions}`);
            });

        } else {
            console.log('No students enrolled in this course.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkEnrollment();
