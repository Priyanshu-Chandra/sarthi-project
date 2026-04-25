const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const TestResult = require('../models/TestResult');

async function run() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("Connected to DB");

    const studentId = '69b814e98f281552c9130da1';
    const testId = '69e881fbcf7e1eefbb20e391';

    const results = await TestResult.deleteMany({
      studentId: studentId,
      $or: [{ testId: testId }, { quizId: testId }]
    });

    console.log(`Successfully deleted ${results.deletedCount} attempt(s) for Priyanshu Chandra (priyanshunet98@gmail.com)`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
