import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import sharp from "sharp";
import { PetConfig, PetState, StateFrames } from "./types";
import { getImagesDir, getProfileBaseDir } from "./profiles";

const EXPORT_STATES: PetState[] = ["idle", "click", "walk", "sleep", "happy", "eat", "special"];

function pickFrame(paths: string[]): string | null {
  if (!paths.length) return null;
  return paths[Math.floor(paths.length / 2)] || paths[0];
}

export function exportsDir(): string {
  return path.join(os.homedir(), "Documents", "desktop-pet", "exports");
}

export async function exportStickerPack(config: PetConfig, destZip: string): Promise<string[]> {
  const base = getProfileBaseDir(config.profileId);
  const zip = new AdmZip();
  const saved: string[] = [];
  const tmpDir = path.join(os.tmpdir(), `pet-stickers-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const state of EXPORT_STATES) {
    const framePath = pickFrame(config.frames[state]);
    if (!framePath || !fs.existsSync(framePath)) continue;
    const outName = `${config.petName || "pet"}-${state}.png`;
    const outPath = path.join(tmpDir, outName);
    await sharp(framePath).png().toFile(outPath);
    zip.addLocalFile(outPath);
    saved.push(outName);
  }

  const manifest = {
    petName: config.petName,
    profileId: config.profileId,
    states: saved,
    exportedAt: new Date().toISOString(),
  };
  const manifestPath = path.join(tmpDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  zip.addLocalFile(manifestPath);

  fs.mkdirSync(path.dirname(destZip), { recursive: true });
  zip.writeZip(destZip);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return saved;
}

export function listFramesForStates(frames: StateFrames): Array<{ state: PetState; path: string }> {
  const out: Array<{ state: PetState; path: string }> = [];
  for (const state of EXPORT_STATES) {
    const p = pickFrame(frames[state]);
    if (p) out.push({ state, path: p });
  }
  return out;
}

export function getImagesDirForProfile(profileId: string): string {
  return getImagesDir(profileId);
}
