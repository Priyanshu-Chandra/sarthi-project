// test-student-flow.js
require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Course = require("./models/Course");
const Test = require("./models/Test");
const TestResult = require("./models/TestResult");
const { checkCourseEligibility } = require("./services/testEligibilityService");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log("DB connected");
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    // 1. Get the target course
    const course = await Course.findOne({ courseStatus: "COMPLETED", isCertificateEnabled: true });
    if (!course) {
        console.log("❌ No completed course found. Did you run test-cert-setup.js?");
        process.exit(1);
    }
    const courseId = course._id;
    console.log(`✅ Target Course: ${course.courseName} (${courseId})`);

    // 2. Get a student enrolled in the course
    if (!course.studentsEnrolled || course.studentsEnrolled.length === 0) {
       console.log("❌ No students enrolled in this course for testing.");
       process.exit(1);
    }
    const studentId = course.studentsEnrolled[0];
    const student = await User.findById(studentId);
    console.log(`✅ Target Student: ${student.firstName} ${student.lastName} (${studentId})`);

    // 3. Find a test for this course
    const test = await Test.findOne({ courseId });
    if (!test) {
       console.log("❌ No test found for this course. Cannot generate results.");
       process.exit(1);
    }
    const testId = test._id;
    console.log(`✅ Target Test found: ${test.title} (${testId})`);

    // 4. Cleanup any stale results from previous runs so the script is always clean
    console.log("\n🧹 Removing any existing results for this student-test pair…");
    const deleted = await TestResult.deleteMany({ studentId, testId });
    console.log(`   Deleted ${deleted.deletedCount} existing result(s).`);

    // Check Eligibility BEFORE dummy data
    let eligibility = await checkCourseEligibility(studentId, courseId);
    console.log(`\nEligibility BEFORE dummy data: ${eligibility.eligible} (Reason: ${eligibility.reason})`);

    // 5. Create Dummy Test Result
    console.log("\n🧪 Inserting dummy passed TestResult...");
    const dummyResult = await TestResult.create({
        testId: testId,
        studentId: studentId,
        score: 100,
        totalQuestions: test.questions?.length || 1,
        tabSwitchCount: 0,
        suspicious: false,
        status: "COMPLETED",
        passed: true,
        eligibleForCertificate: true,
        timeTakenSeconds: 120,
        questionSnapshot: [],
        studentAnswers: [],
    });

    // 6. Check Eligibility AFTER dummy data
    eligibility = await checkCourseEligibility(studentId, courseId);
    console.log(`\n✅ Eligibility AFTER dummy data: ${eligibility.eligible} (Reason: ${eligibility.reason})`);

    if (eligibility.eligible === true) {
        console.log("🎉 SUCCESS: The student is now eligible for the certificate!");
    } else {
        console.log("🔴 FAIL: Eligibility is still false.");
    }

    // 7. Cleanup
    console.log("\n🧹 Cleaning up dummy data...");
    await TestResult.findByIdAndDelete(dummyResult._id);
    
    // Check Eligibility AFTER cleanup
    eligibility = await checkCourseEligibility(studentId, courseId);
    console.log(`✅ Cleanup successful. Eligibility reversed to: ${eligibility.eligible} (Reason: ${eligibility.reason})`);

    process.exit(0);
};

run();
