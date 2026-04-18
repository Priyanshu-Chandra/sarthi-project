const express = require("express");
const router = express.Router();

const { getPostTestAnalysis } = require("../controllers/analysisController");
const { auth } = require("../middleware/auth");

router.get("/post-test/:testId", auth, getPostTestAnalysis);

module.exports = router;
