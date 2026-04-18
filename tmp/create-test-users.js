const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: 'backend/.env' });

const User = require('./backend/models/user');
const Profile = require('./backend/models/profile');

const createTestData = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log("DB Connected");

        // Cleanup
        await User.deleteMany({ email: { $in: ['e2e_instructor@sarthi.com', 'e2e_student@sarthi.com'] } });

        const hashedPassword = await bcrypt.hash('Password123', 10);

        // Instructor
        const instructorProfile = await Profile.create({ gender: null, dateOfBirth: null, about: 'E2E Instructor', contactNumber: '1234567890' });
        await User.create({
            firstName: 'E2E',
            lastName: 'Instructor',
            email: 'e2e_instructor@sarthi.com',
            password: hashedPassword,
            accountType: 'Instructor',
            additionalDetails: instructorProfile._id,
            approved: true,
            image: 'https://api.dicebear.com/5.x/initials/svg?seed=E2E Instructor'
        });

        // Student
        const studentProfile = await Profile.create({ gender: null, dateOfBirth: null, about: 'E2E Student', contactNumber: '0987654321' });
        await User.create({
            firstName: 'E2E',
            lastName: 'Student',
            email: 'e2e_student@sarthi.com',
            password: hashedPassword,
            accountType: 'Student',
            additionalDetails: studentProfile._id,
            approved: true,
            image: 'https://api.dicebear.com/5.x/initials/svg?seed=E2E Student'
        });

        console.log("Test users created: e2e_instructor@sarthi.com & e2e_student@sarthi.com (Password: Password123)");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createTestData();
