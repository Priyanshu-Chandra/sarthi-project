const fs = require("fs");
const path = require("path");

const CONTENT_DIR = path.join(__dirname, "../src");
const OUTPUT = path.join(__dirname, "../src/data/site-index.json");

function walk(dir) {
  let results = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (
      entry.name.endsWith(".jsx") ||
      entry.name.endsWith(".tsx") ||
      entry.name.endsWith(".js") ||
      entry.name.endsWith(".ts") ||
      entry.name.endsWith(".md")
    ) {
      const raw = fs.readFileSync(fullPath, "utf8");

      results.push({
        title: entry.name.replace(/\.(jsx|tsx|js|ts|md)$/, ""),
        path: fullPath.replace(/.*src[\\/]/, ""), // shorter path
        content: raw
          .replace(/<[^>]*>/g, " ")  // remove HTML
          .replace(/\s+/g, " ")      // clean spacing
          .slice(0, 3000)            // limit length
      });
    }
  }

  return results;
}

console.log("🔍 Scanning content directory:", CONTENT_DIR);

const index = walk(CONTENT_DIR);

console.log("📁 Files found:", index.length);

fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2));
console.log("✅ site-index.json generated at:", OUTPUT);
