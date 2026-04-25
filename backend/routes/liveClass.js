const express = require("express");
const router = express.Router();

const {
  startLiveClass,
  endLiveClass,
  validateLiveClass,
  generateZegoToken,
  heartbeat,
} = require("../controllers/liveClass");

const { auth, isInstructor } = require("../middleware/auth");

// Instructor-only routes
router.post("/start", auth, isInstructor, startLiveClass);
router.post("/end",   auth, isInstructor, endLiveClass);

// Any authenticated user can validate (students + instructors)
router.get("/validate/:roomId", auth, validateLiveClass);

// Any authenticated user can get a token (students + instructors)
router.post("/token", auth, generateZegoToken);

// Instructor sends heartbeat every 60s to keep session alive
router.post("/heartbeat", auth, isInstructor, heartbeat);

module.exports = router;
