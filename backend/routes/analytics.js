const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { getStudentAnalytics } = require("../controllers/analytics");

router.get("/student", auth, getStudentAnalytics);

module.exports = router;
