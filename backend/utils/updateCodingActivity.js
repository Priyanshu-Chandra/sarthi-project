const CodingActivity = require("../models/CodingActivity");

exports.updateCodingActivity = async (userId) => {
  const today = new Date().toLocaleDateString("en-CA");

  try {
    await CodingActivity.updateOne(
      { userId, date: today },
      { $inc: { count: 1 } },
      { upsert: true }
    );
  } catch (err) {
    console.log("ACTIVITY_UPDATE_ERROR", err);
  }
};
