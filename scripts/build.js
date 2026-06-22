const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");

try {
  execSync(`node "${tsc}"`, { cwd: root, stdio: "inherit" });
} catch {
  console.error("TypeScript 编译失败，请先运行: npm install");
  process.exit(1);
}

require("./copy-assets");
