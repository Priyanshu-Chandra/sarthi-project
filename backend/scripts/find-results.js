const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const TestResult = require('../models/TestResult');
const User = require('../models/user');

async function run() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    const testId = '69e881fbcf7e1eefbb20e391';
    const results = await TestResult.find({ 
      $or: [{ testId: testId }, { quizId: testId }] 
    }).populate('studentId', 'firstName lastName email');
    
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
