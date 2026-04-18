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
        console.log("Connected to DB successfully.");

        // Clean up previous test runs
        await User.deleteMany({ email: { $regex: 'test_e2e' } });
        await Course.deleteMany({ courseName: 'E2E Test Course' });
        await Category.deleteMany({ name: 'E2E Category' });
        await Test.deleteMany({ title: 'E2E Test Title' });
        await TestResult.deleteMany({}); // Just clear all test results for now or based on user

        const profileDetails = await Profile.create({
            gender: null, dateOfBirth: null, about: null, contactNumber: null
        });

        // 1. Create Instructor
        const instructor = await User.create({
            firstName: 'Inv',
            lastName: 'Test',
            email: 'test_e2e_instructor@example.com',
            password: 'hashedpassword',
            accountType: 'Instructor',
            approved: true,
            additionalDetails: profileDetails._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=Inv Test`
        });

        const profileDetails2 = await Profile.create({
            gender: null, dateOfBirth: null, about: null, contactNumber: null
        });

        // 2. Create Student
        const student = await User.create({
            firstName: 'Stu',
            lastName: 'Test',
            email: 'test_e2e_student@example.com',
            password: 'hashedpassword',
            accountType: 'Student',
            approved: true,
            additionalDetails: profileDetails2._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=Stu Test`
        });

        // 3. Create Category
        const category = await Category.create({
            name: 'E2E Category',
            description: 'For testing'
        });

        // 4. Create Course
        const course = await Course.create({
            courseName: 'E2E Test Course',
            courseDescription: 'Desc',
            instructor: instructor._id,
            whatYouWillLearn: 'Everything',
            price: 100,
            category: category._id,
            status: 'Published'
        });

        // 5. Create Section
        const section = await Section.create({
            sectionName: 'E2E Test Section'
        });

        course.courseContent.push(section._id);
        await course.save();

        student.courses.push(course._id);
        await student.save();

        // Let's generate tokens for both
        const instructorToken = jwt.sign(
            { id: instructor._id, email: instructor.email, accountType: instructor.accountType },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const studentToken = jwt.sign(
            { id: student._id, email: student.email, accountType: student.accountType },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('--- Initialized Test Data ---');

        // ==== API TESTS ====
        const fetchAPI = async (endpoint, options = {}) => {
            const url = `${BASE_URL}${endpoint}`;
            try {
                const res = await fetch(url, options);
                let data = null;
                try {
                    data = await res.json();
                } catch(e) {}
                return { status: res.status, data };
            } catch(e) {
                console.error("Fetch Error:", e);
                return { status: 500, error: e };
            }
        };

        // Ping the server to check if it's running
        const ping = await fetchAPI('', {method: 'GET'});
        if (ping.status === 500 && ping.error) {
            console.log("WAIT: Server not responding or not running on port 5000. Is the server started?");
            process.exit(1);
        }

        let testId;

        // T1: Instructor creates a test
        console.log("Testing: Create Test (Instructor)");
        const createRes = await fetchAPI('/test/create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${instructorToken}` 
            },
            body: JSON.stringify({
                title: 'E2E Test Title',
                courseId: course._id,
                sectionId: section._id,
                questions: [
                    {
                        question: 'What is 2+2?',
                        options: ['3', '4', '5', '6'],
                        correctAnswer: 1
                    },
                    {
                        question: 'What is the capital of France?',
                        options: ['London', 'Berlin', 'Paris', 'Rome'],
                        correctAnswer: 2
                    }
                ],
                passingScore: 1,
                timeLimitSeconds: 600,
                maxAttempts: 2
            })
        });

        if (!createRes.data || !createRes.data.success) {
            console.error('FAILED to create test:', createRes.data || createRes.status);
            process.exit(1);
        }
        testId = createRes.data.test._id;
        console.log('SUCCESS: create test');

        // T2: Student fetches the test details
        console.log("Testing: Get Test by ID (Student)");
        const getRes = await fetchAPI(`/test/${testId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });

        if (!getRes.data || !getRes.data.success) {
            console.error('FAILED to get test:', getRes.data || getRes.status);
            process.exit(1);
        }
        console.log('SUCCESS: get test details');
        const attemptSessionToken = getRes.data.attemptSessionToken;

        // T3: Student submits the test (1 correct, 1 wrong)
        console.log("Testing: Submit Test (Student)");
        const submitRes = await fetchAPI('/test/submit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}` 
            },
            body: JSON.stringify({
                testId: testId,
                answers: [1, 0], // Question 1 is 1 (index 1 is '4', which is correct). Question 2 is 0 ('London', WRONG, correct is 2)
                tabSwitchCount: 0,
                attemptSessionToken: attemptSessionToken
            })
        });

        if (!submitRes.data || !submitRes.data.success) {
            console.error('FAILED to submit test:', submitRes.data || submitRes.status);
            process.exit(1);
        }
        console.log(`SUCCESS: submit test. Result passed: ${submitRes.data.passed}, Score: ${submitRes.data.score}/${submitRes.data.total}`);

        // T4: Student fetches the test results by course id
        console.log("Testing: Get Test by Course (Student)");
        const getByCourseRes = await fetchAPI(`/test/course/${course._id}/list`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        
        console.log("Get Test by Course Output:");
        console.dir(getByCourseRes.data, {depth: null});
        
        // T5: Try getting test by ID again (Student) -> should show results
        console.log("Testing: Get Test by ID after submit (Student)");
        const getAfterSubmitRes = await fetchAPI(`/test/${testId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        console.log("Get Test by ID after submit Output:");
        console.dir(getAfterSubmitRes.data, {depth: null});

        console.log('--- ALL TESTS COMPLETED SUCCESSFULLY ---');
        process.exit(0);

    } catch (e) {
        console.error("Test script failed:", e);
        process.exit(1);
    }
};

runTests();
