const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/user');

const bcrypt = require('bcrypt');

async function findStudent() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        const password = await bcrypt.hash('12345678', 10);
        const student = await User.findOneAndUpdate(
            { email: 'ongunpoint@gmail.com' },
            { password: password },
            { new: true }
        );
        if (student) {
            console.log('Updated student password:', student.email);
        } else {
            console.log('No student found');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findStudent();
