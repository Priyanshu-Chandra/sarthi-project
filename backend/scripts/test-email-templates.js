const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { courseEnrollmentEmail } = require('../mail/templates/courseEnrollmentEmail');
const { courseUpdateNotificationEmail } = require('../mail/templates/courseUpdateNotification');
const otpTemplate = require('../mail/templates/emailVerificationTemplate');
const newCourseEmail = require('../mail/templates/newCoursePublished');
const { newTestNotificationEmail } = require('../mail/templates/newTestNotification');
const { passwordUpdated } = require('../mail/templates/passwordUpdate');
const { paymentSuccessEmail } = require('../mail/templates/paymentSuccessEmail');
const { resetPasswordEmail } = require('../mail/templates/resetPasswordEmail');

async function testTemplates() {
    console.log("=== Starting Email Template Verification ===\n");

    const testData = {
        name: "John Doe",
        courseName: "Full Stack Web Development",
        instructorName: "Jane Smith",
        otp: "123456",
        amount: "499",
        orderId: "order_123",
        paymentId: "pay_456",
        testTitle: "React Basics Quiz",
        resetUrl: "http://localhost:5173/reset-password/token123",
        email: "john@example.com",
        description: "A comprehensive course on modern web development."
    };

    const templates = [
        { name: "Course Enrollment", fn: () => courseEnrollmentEmail(testData.courseName, testData.name) },
        { name: "Course Update", fn: () => courseUpdateNotificationEmail(testData.courseName, testData.instructorName, testData.name) },
        { name: "OTP Verification", fn: () => otpTemplate(testData.otp, testData.name) },
        { name: "New Course Published", fn: () => newCourseEmail(testData.name, testData.instructorName, testData.courseName, testData.description) },
        { name: "New Test Notification", fn: () => newTestNotificationEmail(testData.courseName, testData.testTitle, testData.instructorName) },
        { name: "Password Updated", fn: () => passwordUpdated(testData.email, testData.name) },
        { name: "Payment Success", fn: () => paymentSuccessEmail(testData.name, testData.amount, testData.orderId, testData.paymentId) },
        { name: "Reset Password Link", fn: () => resetPasswordEmail(testData.email, testData.resetUrl, testData.name) }
    ];

    let allPassed = true;

    for (const t of templates) {
        try {
            console.log(`Testing: ${t.name}...`);
            const html = t.fn();
            
            // Check for common issues
            if (!html || typeof html !== 'string') throw new Error("Template returned non-string");
            
            // Look for fallbacks if env is missing
            if (!process.env.FRONTEND_URL) {
                if (!html.includes("http://localhost:5173")) {
                    console.warn(`  [WARN] Fallback 'http://localhost:5173' not found in ${t.name}`);
                }
            } else {
                if (!html.includes(process.env.FRONTEND_URL)) {
                    console.warn(`  [WARN] FRONTEND_URL '${process.env.FRONTEND_URL}' not found in ${t.name}`);
                }
            }

            // Check for logo href
            const logoHrefMatch = html.match(/<a[^>]+href="([^"]*)"[^>]*><img[^>]+alt="Sarthi Logo"/);
            if (logoHrefMatch && logoHrefMatch[1] === "") {
                throw new Error("Logo link has empty href");
            }

            // Check for personalization
            if (t.name === "Course Update" && !html.includes(`Hello ${testData.name}`)) {
                throw new Error("Course Update template not personalized");
            }
            if (t.name === "New Course Published" && !html.includes("<!DOCTYPE html>")) {
                throw new Error("New Course template missing DOCTYPE");
            }

            console.log(`  [OK] ${t.name} rendered successfully.`);
        } catch (err) {
            console.error(`  [FAIL] ${t.name}: ${err.message}`);
            allPassed = false;
        }
    }

    console.log("\n=== Verification Finished ===");
    process.exit(allPassed ? 0 : 1);
}

testTemplates();
