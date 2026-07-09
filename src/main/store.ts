import fs from "fs";
import path from "path";
import {
  DEFAULT_CONFIG,
  ImageImportOptions,
  PetConfig,
  cloneConfig,
  hasAnyFrame,
  isPetRenderable,
} from "./types";
import {
  buildFlipbookFrames,
  mergeExistingToFlipbook,
} from "./imageClassifier";
import { fileUrlForRenderer } from "./protocol";
import { getActiveProfileId, getConfigPath, getImagesDir, getProfileBaseDir } from "./profiles";
import { processImageFile } from "./imageProcessor";

export { fileUrlForRenderer } from "./protocol";
export {
  createProfile,
  deleteProfile,
  exportProfileZip,
  getActiveProfileId,
  getImagesDir,
  importProfileZip,
  listProfiles,
  renameProfile,
  switchProfile,
} from "./profiles";

function resolveFramePaths(config: PetConfig): PetConfig {
  const base = getProfileBaseDir(config.profileId);
  const next = cloneConfig(config);
  for (const key of Object.keys(next.frames) as (keyof typeof next.frames)[]) {
    next.frames[key] = next.frames[key].map((p) => {
      if (!p) return p;
      return path.isAbsolute(p) ? p : path.join(base, p.replace(/\//g, path.sep));
    });
  }
  if (next.spriteSheet?.imagePath && !path.isAbsolute(next.spriteSheet.imagePath)) {
    next.spriteSheet = {
      ...next.spriteSheet,
      imagePath: path.join(base, next.spriteSheet.imagePath.replace(/\//g, path.sep)),
    };
  }
  return next;
}

export function loadConfig(): PetConfig {
  return loadConfigForProfile(getActiveProfileId());
}

function hasAiImportFrames(frames: PetConfig["frames"]): boolean {
  return Object.values(frames).some((list) =>
    list.some((p: string) => String(p).includes("ai-import"))
  );
}

function migrateRenderMode(config: PetConfig, raw: Partial<PetConfig>): PetConfig {
  const next = config;
  const aiImport = hasAiImportFrames(next.frames);
  if (aiImport) {
    next.renderMode = "flipbook";
    next.shimejiMode = false;
    next.bongoMode = false;
    return next;
  }
  if (raw.renderMode === undefined || raw.renderMode === null) {
    next.renderMode = hasAnyFrame(next.frames) ? "flipbook" : "pixel";
  }
  return next;
}

export function loadConfigForProfile(profileId: string): PetConfig {
  const file = getConfigPath(profileId);
  if (!fs.existsSync(file)) {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    cfg.profileId = profileId;
    return cfg;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as PetConfig;
    const merged: PetConfig = {
      ...cloneConfig(DEFAULT_CONFIG),
      ...raw,
      version: 1,
      profileId,
      frames: { ...cloneConfig(DEFAULT_CONFIG).frames, ...(raw.frames || {}) },
    };
    const normalized = normalizeAnimation(migrateRenderMode(resolveFramePaths(merged), raw));
    if (hasAiImportFrames(raw.frames || merged.frames)) {
      const persisted = { ...raw, renderMode: "flipbook", shimejiMode: false, bongoMode: false, profileId, version: 1 };
      if (raw.renderMode !== "flipbook" || raw.shimejiMode !== false) {
        fs.writeFileSync(file, JSON.stringify(persisted, null, 2), "utf-8");
      }
    }
    return normalized;
  } catch {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    cfg.profileId = profileId;
    return cfg;
  }
}

function normalizeAnimation(config: PetConfig): PetConfig {
  const mode = config.animationMode ?? "flipbook";
  config.animationMode = mode;
  if (mode !== "flipbook") return config;

  const idleCount = config.frames.idle.length;
  const total = Object.values(config.frames).reduce((n, list) => n + list.length, 0);
  if (idleCount >= 2 || total <= 1) return config;

  const paths = mergeExistingToFlipbook(config.frames);
  if (paths.length <= 1) return config;

  config.frames = buildFlipbookFrames(paths);
  return config;
}

export function saveConfig(config: PetConfig): void {
  const file = getConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  config.profileId = getActiveProfileId();
  fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf-8");
}

export function isPetReady(config: PetConfig): boolean {
  return isPetRenderable(config);
}

export async function copyImageToStore(
  sourcePath: string,
  importOptions?: ImageImportOptions
): Promise<string> {
  const dir = getImagesDir();
  const normalized = path.resolve(sourcePath);
  if (normalized.startsWith(path.resolve(dir))) return normalized;

  const ext = path.extname(sourcePath).toLowerCase() || ".png";
  const usePng = importOptions?.chromakey || importOptions?.trimTransparent || importOptions?.useRembg;
  const outExt = usePng ? ".png" : ext;
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${outExt}`;
  const dest = path.join(dir, name);

  if (
    importOptions &&
    (importOptions.trimTransparent || importOptions.chromakey || importOptions.useRembg)
  ) {
    await processImageFile(sourcePath, dest, importOptions);
  } else {
    fs.copyFileSync(sourcePath, dest);
  }
  return dest;
}

export function removeImage(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function remapFramePaths(config: PetConfig, pathMap: Map<string, string>): PetConfig {
  const next = cloneConfig(config);
  for (const state of Object.keys(next.frames) as (keyof typeof next.frames)[]) {
    next.frames[state] = next.frames[state].map((p) => pathMap.get(p) ?? p);
  }
  return next;
}
