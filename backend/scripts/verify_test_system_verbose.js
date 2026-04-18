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

const PORT = 5000;
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

        const instructor = await User.findOne({ accountType: 'Instructor' });
        const student = await User.findOne({ accountType: 'Student' });
        const category = await Category.findOne({});
        const problem = await Problem.findOne({});

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
        
        console.log("Created coding test:", { id: codingTest._id, testType: codingTest.testType });

        // 1. Get test details
        const getRes = await fetchAPI(`/test/${codingTest._id}?deviceId=test-device`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        
        console.log("Get test response:", getRes.data);
        const sessionToken = getRes.data.attemptSessionToken;

        const tr = await TestResult.findOne({ testId: codingTest._id, studentId: student._id });
        console.log("Found TestResult snapshot length:", tr.questionSnapshot?.length);
        
        tr.codingSubmissions.push({
            problemId: problem._id,
            status: 'Accepted',
            passedTestCases: 5,
            totalTestCases: 5,
            submittedAt: new Date(),
            runCount: 1
        });
        await tr.save();

        // 3. Submit
        const submitRes = await fetchAPI('/test/submit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}` 
            },
            body: JSON.stringify({
                testId: codingTest._id,
                answers: [],
                tabSwitchCount: 0,
                attemptSessionToken: sessionToken,
                deviceId: "test-device"
            })
        });

        console.log("Coding submission result:", submitRes.data);
        if (submitRes.data.success) {
            console.log("✅ CODING TEST SUCCESS");
        } else {
            console.log("❌ CODING TEST FAILED");
        }

        // Cleanup
        await Course.findByIdAndDelete(course._id);
        await Section.findByIdAndDelete(section._id);
        await Test.deleteMany({ _id: { $in: [codingTest._id] } });
        await TestResult.deleteMany({ studentId: student._id, testId: { $in: [codingTest._id] } });
        
        await mongoose.connection.close();
        console.log("DB closed.");
        process.exit(0);

    } catch (e) {
        console.error("Verification failed:", e);
        process.exit(1);
    }
};

runVerification();
