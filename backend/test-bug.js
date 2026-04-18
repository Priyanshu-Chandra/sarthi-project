const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { connectDB } = require('./config/database');
const User = require('./models/user');
const Profile = require('./models/profile');
const Course = require('./models/course');
const Section = require('./models/section');
const Category = require('./models/category');
const Test = require('./models/Test');
const TestResult = require('./models/TestResult');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

const runTests = async () => {
    try {
        await connectDB();

        const instructorToken = jwt.sign(
            { id: new mongoose.Types.ObjectId(), email: 'x@x.com', accountType: 'Instructor' },
            process.env.JWT_SECRET, { expiresIn: '24h' }
        );
        const studentToken = jwt.sign(
            { id: new mongoose.Types.ObjectId(), email: 'y@y.com', accountType: 'Student' },
            process.env.JWT_SECRET, { expiresIn: '24h' }
        );

        const fetchAPI = async (endpoint, options = {}) => {
            const url = `${BASE_URL}${endpoint}`;
            const res = await fetch(url, options);
            let data = null;
            try { data = await res.json(); } catch(e) {}
            return { status: res.status, data };
        };

        // Create a test just using DB
        const course = await Course.create({
            courseName: 'Bug Test Course',
            instructor: new mongoose.Types.ObjectId(),
            status: 'Published' // Added to bypass validations
        });
        
        const test = await Test.create({
            title: 'Bug Test',
            courseId: course._id,
            createdBy: new mongoose.Types.ObjectId(),
            questions: [ { question: 'A?', options: ['1','2','3','4'], correctAnswer: 0 } ]
        });

        // Student tries to use getTestByCourse
        console.log("--> Testing bug in getTestByCourse");
        const getRes = await fetchAPI(`/test/course/${course._id}`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        
        console.log("getTestByCourse result: ", getRes.data);
        const attemptSessionToken = getRes.data.attemptSessionToken;

        console.log("--> Now submitting with that attempt form getTestByCourse");
        const submitRes = await fetchAPI('/test/submit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}` 
            },
            body: JSON.stringify({
                testId: test._id,
                answers: [0],
                tabSwitchCount: 0,
                attemptSessionToken: attemptSessionToken
            })
        });

        console.log("submitTest result: ", submitRes.data);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

runTests();
