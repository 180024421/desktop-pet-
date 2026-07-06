import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { exportProfileZip } from "./profiles";
import { importProfileZip } from "./profiles";

const shareDir = (): string => path.join(os.homedir(), "Documents", "desktop-pet", "share-codes");

export function createSharePack(profileId: string, petName: string): { code: string; zipPath: string } {
  const dir = shareDir();
  fs.mkdirSync(dir, { recursive: true });
  const code = `${petName.slice(0, 4)}-${profileId.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase();
  const zipPath = path.join(dir, `${code}.zip`);
  exportProfileZip(profileId, zipPath);
  fs.writeFileSync(path.join(dir, `${code}.txt`), zipPath, "utf8");
  return { code, zipPath };
}

export function importByShareCode(code: string): { ok: boolean; reason?: string; profileId?: string } {
  const dir = shareDir();
  const zipPath = path.join(dir, `${code.trim().toUpperCase()}.zip`);
  if (!fs.existsSync(zipPath)) {
    return { ok: false, reason: "分享码无效或已过期" };
  }
  const info = importProfileZip(zipPath);
  return { ok: true, profileId: info.id };
}
