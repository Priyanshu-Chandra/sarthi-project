const mailSender = require('./utils/mailSender');
const { courseEnrollmentEmail } = require('./mail/templates/courseEnrollmentEmail');
require('dotenv').config();

async function sendSample() {
    const targetEmail = process.env.MAIL_USER;
    const sampleCourse = "Full Stack Web Development (Sarthi Edition)";
    const sampleName = "Priyanshu (Sarthi Admin)";

    console.log(`Sending sample Sarthi email to: ${targetEmail}...`);

    try {
        const body = courseEnrollmentEmail(sampleCourse, sampleName);
        await mailSender(
            targetEmail, 
            "🎓 Welcome to Sarthi | Your Enrollment is Confirmed", 
            body
        );
        console.log("\n\x1b[32m[SUCCESS] Sample email sent successfully!\x1b[0m");
        console.log("Please check your inbox (including Spam/Promoted folders just in case).");
    } catch (error) {
        console.error("\n\x1b[31m[FAILED] Could not send sample email.\x1b[0m");
        console.error("Error Message:", error.message);
    }
}

sendSample();
