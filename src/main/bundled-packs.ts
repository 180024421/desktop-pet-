import fs from "fs";
import path from "path";
import { app } from "electron";
import { importProfileZip, createProfile, switchProfile, getProfileBaseDir } from "./profiles";
import { loadConfig, saveConfig } from "./store";
import { cloneConfig } from "./types";
import { parseSpriteSheetJson, buildSpriteSheetConfig } from "./sprite-sheet";

export interface BundledPack {
  id: string;
  name: string;
  description: string;
  zipPath: string;
  dirPath: string;
}

function bundledRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bundled");
  }
  return path.join(app.getAppPath(), "bundled");
}

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

export function listBundledPacks(): BundledPack[] {
  const root = bundledRoot();
  if (!fs.existsSync(root)) return [];
  const packs: BundledPack[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const zip = path.join(dir, "pack.zip");
    const metaPath = path.join(dir, "pack.json");
    let name = entry.name;
    let description = "内置素材包";
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
          name?: string;
          description?: string;
        };
        name = meta.name || name;
        description = meta.description || description;
      } catch {
        /* ignore */
      }
    }
    if (fs.existsSync(zip)) {
      packs.push({ id: entry.name, name, description, zipPath: zip, dirPath: dir });
    } else if (fs.existsSync(path.join(dir, "pet-config.json")) || fs.existsSync(path.join(dir, "sprite-sheet.json"))) {
      packs.push({
        id: entry.name,
        name: name === "default" ? "像素猫（默认）" : name,
        description,
        zipPath: "",
        dirPath: dir,
      });
    }
  }
  return packs;
}

function importBundledDirectory(pack: BundledPack): { ok: boolean; profileId?: string; reason?: string } {
  const info = createProfile(pack.name);
  const destDir = getProfileBaseDir(info.id);
  copyDirRecursive(pack.dirPath, destDir);

  const cfgPath = path.join(destDir, "pet-config.json");
  if (fs.existsSync(cfgPath)) {
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    raw.profileId = info.id;
    raw.petName = pack.name;
    fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2), "utf-8");
  } else if (fs.existsSync(path.join(pack.dirPath, "sprite-sheet.json"))) {
    const json = parseSpriteSheetJson(path.join(pack.dirPath, "sprite-sheet.json"));
    const pngName = fs.existsSync(path.join(destDir, "sprite-sheet.png"))
      ? "sprite-sheet.png"
      : fs.readdirSync(destDir).find((f) => f.endsWith(".png")) || "";
    const cfg = cloneConfig(loadConfig());
    cfg.profileId = info.id;
    cfg.petName = pack.name;
    cfg.renderMode = "spritesheet";
    cfg.spriteSheet = buildSpriteSheetConfig(path.join("images", pngName).replace(/\\/g, "/"), json);
    if (fs.existsSync(path.join(pack.dirPath, "sprite-sheet.png"))) {
      fs.mkdirSync(path.join(destDir, "images"), { recursive: true });
      fs.copyFileSync(
        path.join(pack.dirPath, "sprite-sheet.png"),
        path.join(destDir, "images", "sprite-sheet.png")
      );
      cfg.spriteSheet = buildSpriteSheetConfig("images/sprite-sheet.png", json);
    }
    fs.writeFileSync(path.join(destDir, "pet-config.json"), JSON.stringify(cfg, null, 2), "utf-8");
  }

  switchProfile(info.id);
  saveConfig(loadConfig());
  return { ok: true, profileId: info.id };
}

export function importBundledPack(packId: string): { ok: boolean; profileId?: string; reason?: string } {
  const pack = listBundledPacks().find((p) => p.id === packId);
  if (!pack) return { ok: false, reason: "素材包不存在" };
  if (packId === "default") return { ok: false, reason: "默认档案已在首次启动导入，请从档案列表切换" };
  if (!pack.zipPath) return importBundledDirectory(pack);
  if (!fs.existsSync(pack.zipPath)) return { ok: false, reason: "ZIP 文件缺失" };
  const info = importProfileZip(pack.zipPath, pack.name);
  return { ok: true, profileId: info.id };
}
