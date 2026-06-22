const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pairs = [
  ["src/renderer/pet", "dist/renderer/pet"],
  ["src/renderer/config", "dist/renderer/config"],
  ["assets", "dist/assets"],
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (!entry.name.endsWith(".ts")) fs.copyFileSync(from, to);
  }
}

for (const [srcRel, destRel] of pairs) {
  const src = path.join(root, srcRel);
  const dest = path.join(root, destRel);
  if (fs.existsSync(src)) copyDir(src, dest);
}

console.log("Assets copied.");
