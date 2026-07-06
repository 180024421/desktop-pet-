import fs from "fs";
import path from "path";
import { app } from "electron";
import { importProfileZip } from "./profiles";

export interface BundledPack {
  id: string;
  name: string;
  description: string;
  zipPath: string;
}

function bundledRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bundled");
  }
  return path.join(app.getAppPath(), "bundled");
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
      packs.push({ id: entry.name, name, description, zipPath: zip });
    } else if (fs.existsSync(path.join(dir, "pet-config.json"))) {
      packs.push({
        id: entry.name,
        name: name === "default" ? "默认小猫" : name,
        description: "内置默认宠物（首次启动已导入）",
        zipPath: "",
      });
    }
  }
  return packs;
}

export function importBundledPack(packId: string): { ok: boolean; profileId?: string; reason?: string } {
  const pack = listBundledPacks().find((p) => p.id === packId);
  if (!pack) return { ok: false, reason: "素材包不存在" };
  if (!pack.zipPath) return { ok: false, reason: "该包为内置档案，请从档案列表切换 default" };
  if (!fs.existsSync(pack.zipPath)) return { ok: false, reason: "ZIP 文件缺失" };
  const info = importProfileZip(pack.zipPath);
  return { ok: true, profileId: info.id };
}
