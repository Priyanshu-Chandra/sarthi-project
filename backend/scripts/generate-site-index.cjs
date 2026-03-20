const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../../frontend/src");
const OUTPUT = path.join(__dirname, "../data/site-index.json");

function walk(dir, list = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);

    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, list);
    } else if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".md")) {
      const content = fs.readFileSync(filePath, "utf-8");
      list.push({
        file: filePath.replace(ROOT, ""),
        content,
      });
    }
  });

  return list;
}

const allFiles = walk(ROOT);

fs.writeFileSync(OUTPUT, JSON.stringify(allFiles, null, 2));

console.log("📄 site-index.json created at:", OUTPUT);
console.log("📁 Total files indexed:", allFiles.length);
