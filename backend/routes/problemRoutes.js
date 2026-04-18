const express = require("express");
const router = express.Router();
const { getAllProblems, getProblemById } = require("../controllers/problemController");

router.get("/all", getAllProblems);
router.get("/:id", getProblemById);

module.exports = router;
