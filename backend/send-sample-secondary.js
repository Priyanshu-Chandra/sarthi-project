const mailSender = require('./utils/mailSender');
const { courseEnrollmentEmail } = require('./mail/templates/courseEnrollmentEmail');
require('dotenv').config();

async function sendSample() {
    // Manually overriding target for this one-time proof
    const targetEmail = "priyanshunet98@gmail.com";
    const sampleCourse = "Advanced MERN Stack with Sarthi";
    const sampleName = "Priyanshu Chandra";

    console.log(`Sending sample Sarthi email to secondary address: ${targetEmail}...`);

    try {
        const body = courseEnrollmentEmail(sampleCourse, sampleName);
        await mailSender(
            targetEmail, 
            "🎓 Sarthi Branding Verification | Sample Review", 
            body
        );
        console.log("\n\x1b[32m[SUCCESS] Sample email sent to secondary address successfully!\x1b[0m");
    } catch (error) {
        console.error("\n\x1b[31m[FAILED] Could not send to secondary address.\x1b[0m");
        console.error("Error Message:", error.message);
    }
}

sendSample();
