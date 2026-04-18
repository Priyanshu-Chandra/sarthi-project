const mongoose = require('mongoose');
const mailSender = require('../utils/mailSender');

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 5 * 60, // The document will be automatically deleted after 3 minutes of its creation time
    }

});

// Email sending logic handled completely by auth.js controller to prevent duplicate/raw emails.




module.exports = mongoose.model('OTP', OTPSchema);