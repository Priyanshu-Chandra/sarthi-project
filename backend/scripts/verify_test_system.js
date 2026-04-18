const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { connectDB } = require('../config/database');
const User = require('../models/user');
const Course = require('../models/course');
const Section = require('../models/section');
const Category = require('../models/category');
const Problem = require('../models/Problem');
const Test = require('../models/Test');
const TestResult = require('../models/TestResult');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

const fetchAPI = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    try {
        const res = await fetch(url, options);
        const data = await res.json();
        return { status: res.status, data };
    } catch (e) {
        return { status: 500, error: e.message };
    }
};

const runVerification = async () => {
    try {
        await connectDB();
        console.log("Connected to DB.");

        // Setup base data
        const instructor = await User.findOne({ accountType: 'Instructor' });
        const student = await User.findOne({ accountType: 'Student' });
        const category = await Category.findOne({});
        const problem = await Problem.findOne({});

        if (!instructor || !student || !category || !problem) {
            console.error("Please ensure you have at least one Instructor, Student, Category, and Problem in the DB.");
            process.exit(1);
        }

        const course = await Course.create({
            courseName: 'Verification Course',
            courseDescription: 'Testing fixes',
            instructor: instructor._id,
            category: category._id,
            status: 'Published',
            studentsEnrolled: [student._id]
        });

        const section = await Section.create({ sectionName: 'Test Section' });
        course.courseContent.push(section._id);
        await course.save();

        student.courses.push(course._id);
        await student.save();

        const studentToken = jwt.sign(
            { id: student._id, email: student.email, accountType: 'Student' },
            process.env.JWT_SECRET, { expiresIn: '1h' }
        );

        console.log("--- CASE 1: CODING TEST SUBMISSION ---");
        const codingTest = await Test.create({
            title: 'Coding Fix Verification',
            testType: 'CODING',
            courseId: course._id,
            sectionId: section._id,
            createdBy: instructor._id,
            questions: [{ type: 'CODING', problemId: problem._id }],
            maxAttempts: 5,
            timeLimitSeconds: 600
        });

        // 1. Get test details to start session
        const getRes = await fetchAPI(`/test/${codingTest._id}?deviceId=test-device`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        
        if (!getRes.data.success) throw new Error("Failed to get coding test: " + JSON.stringify(getRes.data));
        const sessionToken = getRes.data.attemptSessionToken;

        // 2. Mock a coding submission in TestResult (as would be done by runCode/submitCode)
        const tr = await TestResult.findOne({ testId: codingTest._id, studentId: student._id });
        tr.codingSubmissions.push({
            problemId: problem._id,
            status: 'Accepted',
            passedTestCases: 5,
            totalTestCases: 5,
            submittedAt: new Date(),
            runCount: 1
        });
        await tr.save();

        // 3. Submit the test
        const submitRes = await fetchAPI('/test/submit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}` 
            },
            body: JSON.stringify({
                testId: codingTest._id,
                answers: [], // Ignored for coding
                tabSwitchCount: 0,
                attemptSessionToken: sessionToken,
                deviceId: "test-device"
            })
        });

        console.log("Coding submission result:", submitRes.data);
        if (submitRes.data.success && submitRes.data.total === 1 && submitRes.data.score === 1) {
            console.log("✅ CODING TEST SUCCESS: No crash, totalQuestions correctly reassigned.");
        } else {
            console.error("❌ CODING TEST FAILED:", submitRes.data);
            process.exit(1);
        }

        console.log("\n--- CASE 2: MCQ TEST SUBMISSION ---");
        const mcqTest = await Test.create({
            title: 'MCQ Fix Verification',
            testType: 'MCQ',
            courseId: course._id,
            sectionId: section._id,
            createdBy: instructor._id,
            questions: [{ type: 'MCQ', question: 'Fix?', options: ['Yes','No','Maybe','IDK'], correctAnswer: 0 }],
            maxAttempts: 5,
            timeLimitSeconds: 600,
            isLegacy: false
        });

        const getRes2 = await fetchAPI(`/test/${mcqTest._id}?deviceId=test-device`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const sessionToken2 = getRes2.data.attemptSessionToken;

        const submitRes2 = await fetchAPI('/test/submit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}` 
            },
            body: JSON.stringify({
                testId: mcqTest._id,
                answers: [0],
                tabSwitchCount: 0,
                attemptSessionToken: sessionToken2,
                deviceId: "test-device"
            })
        });

        console.log("MCQ submission result:", submitRes2.data);
        if (submitRes2.data.success && submitRes2.data.score === 1) {
            console.log("✅ MCQ TEST SUCCESS.");
        } else {
            console.error("❌ MCQ TEST FAILED:", submitRes2.data);
            process.exit(1);
        }

        // Cleanup
        console.log("\n🧹 Cleaning up...");
        await Course.findByIdAndDelete(course._id);
        await Section.findByIdAndDelete(section._id);
        await Test.deleteMany({ _id: { $in: [codingTest._id, mcqTest._id] } });
        await TestResult.deleteMany({ studentId: student._id, testId: { $in: [codingTest._id, mcqTest._id] } });
        
        console.log("\n✨ ALL VERIFICATIONS PASSED!");
        process.exit(0);

    } catch (e) {
        console.error("Verification failed:", e);
        process.exit(1);
    }
};

runVerification();
