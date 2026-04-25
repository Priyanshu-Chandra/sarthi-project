const nodemailer = require('nodemailer');

// Create transporter once at the module level for reuse
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT || 587,
    secure: process.env.MAIL_PORT == 465,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

const mailSender = async (email, title, body) => {
    try {
        const info = await transporter.sendMail({
            from: 'Sarthi | Advanced Learning Platform',
            to: email,
            subject: title,
            html: body
        });

        return info;
    }
    catch (error) {
        console.error(`[MailSender Error] Target: ${email} | Message: ${error.message}`);
        throw error; // Let the controller handle or log the failure
    }
}

module.exports = mailSender;