const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

require("./build");

const electronExe = path.join(
  root,
  "node_modules",
  "electron",
  "dist",
  "electron.exe"
);

function runElectron() {
  const result = spawnSync(electronExe, [root], {
    stdio: "inherit",
    windowsHide: false,
    cwd: root,
  });
  process.exit(result.status ?? 0);
}

runElectron();
