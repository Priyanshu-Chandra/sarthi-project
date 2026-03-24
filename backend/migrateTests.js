const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load backend .env config
dotenv.config({ path: "./.env" });
const dbURL = process.env.DATABASE_URL;

const Test = require("./models/Test");
const Course = require("./models/course");

async function runMigration() {
  try {
    await mongoose.connect(dbURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    const tests = await Test.find({ sectionId: { $exists: false } });
    console.log(`Found ${tests.length} tests without a sectionId.`);

    for (const test of tests) {
      if (!test.courseId) continue;

      const course = await Course.findById(test.courseId).select("courseContent");
      if (course && course.courseContent && course.courseContent.length > 0) {
        test.sectionId = course.courseContent[0]; // assign to first section
        await test.save();
        console.log(`Updated test "${test.title}" to section ${test.sectionId}`);
      } else {
        console.log(`Test "${test.title}" has no sections available in its course. Skipping...`);
      }
    }
    
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    mongoose.disconnect();
  }
}

runMigration();
