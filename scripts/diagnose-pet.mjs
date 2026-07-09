/**
 * 诊断宠物窗口：加载配置、生成 URL、检查协议路径解析
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const APPDATA = process.env.APPDATA;
const profileDir = path.join(APPDATA, "desktop-pet", "profiles", "default");
const cfgPath = path.join(profileDir, "pet-config.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

function fileUrlForRenderer(absPath) {
  const normalized = path.resolve(absPath);
  if (!fs.existsSync(normalized)) return { url: "", exists: false, normalized };
  const posix = normalized.replace(/\\/g, "/");
  const url = `pet://local/${encodeURI(posix)}`;
  const u = new URL(url);
  let fp = decodeURIComponent(u.pathname.replace(/^\//, ""));
  return { url, exists: fs.existsSync(fp), normalized, decoded: fp };
}

const rel = cfg.frames.idle[0];
const abs = path.join(profileDir, rel.replace(/\//g, path.sep));
const info = fileUrlForRenderer(abs);

console.log("=== Desktop Pet 诊断 ===");
console.log("renderMode:", cfg.renderMode);
console.log("animationMode:", cfg.animationMode);
console.log("idle frames:", cfg.frames.idle.length);
console.log("first rel:", rel);
console.log("first abs exists:", fs.existsSync(abs));
console.log("pet url:", info.url?.slice(0, 100));
console.log("protocol decode exists:", info.exists);
console.log("decoded path:", info.decoded);
