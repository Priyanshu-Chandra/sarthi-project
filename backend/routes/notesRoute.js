const express = require("express");
const router = express.Router();

const { generateNotes } = require("../controllers/notesController");

router.post("/generate-notes", generateNotes);

module.exports = router;
