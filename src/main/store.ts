import fs from "fs";
import path from "path";
import { app } from "electron";
import {
  DEFAULT_CONFIG,
  PetConfig,
  cloneConfig,
  hasAnyFrame,
} from "./types";
import {
  buildFlipbookFrames,
  mergeExistingToFlipbook,
} from "./imageClassifier";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function configPath(): string {
  return path.join(app.getPath("userData"), "pet-config.json");
}

function imagesDir(): string {
  return path.join(app.getPath("userData"), "images");
}

export function getImagesDir(): string {
  fs.mkdirSync(imagesDir(), { recursive: true });
  return imagesDir();
}

export function loadConfig(): PetConfig {
  const file = configPath();
  if (!fs.existsSync(file)) return cloneConfig(DEFAULT_CONFIG);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as PetConfig;
    const merged = { ...cloneConfig(DEFAULT_CONFIG), ...raw, version: 1 };
    return normalizeAnimation(merged);
  } catch {
    return cloneConfig(DEFAULT_CONFIG);
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
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf-8");
}

export function isPetReady(config: PetConfig): boolean {
  return hasAnyFrame(config.frames);
}

export function copyImageToStore(sourcePath: string): string {
  const dir = getImagesDir();
  const normalized = path.resolve(sourcePath);
  if (normalized.startsWith(path.resolve(dir))) return normalized;
  const ext = path.extname(sourcePath).toLowerCase() || ".png";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const dest = path.join(dir, name);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

export function removeImage(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function fileUrlForRenderer(absPath: string): string {
  try {
    if (!fs.existsSync(absPath)) {
      console.warn("[desktop-pet] image missing:", absPath);
      return "";
    }
    const ext = path.extname(absPath).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "image/png";
    const base64 = fs.readFileSync(absPath).toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.error("[desktop-pet] read image failed:", absPath, err);
    return "";
  }
}
