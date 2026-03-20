const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Fuse = require("fuse.js");

// Load site-index.json
const siteIndexPath = path.join(__dirname, "../data/site-index.json");
let siteIndex = [];
try {
  siteIndex = JSON.parse(fs.readFileSync(siteIndexPath, "utf8"));
} catch (err) {
  console.error("Error reading site-index.json", err);
}

// Configure Fuse.js
const fuse = new Fuse(siteIndex, {
  keys: ["title", "content"],  // search both title and content
  threshold: 0.4,              // adjust fuzzy sensitivity
  ignoreLocation: true,
});

router.post("/", (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ reply: "Message missing" });

    const results = fuse.search(userMessage);

    if (results.length > 0) {
      return res.json({ reply: results[0].item.content });
    } else {
      return res.json({ reply: "Sorry, I couldn't find this information on the website." });
    }
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ reply: "Server error" });
  }
});

module.exports = router;
