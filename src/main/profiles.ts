import fs from "fs";
import path from "path";
import { app } from "electron";
import AdmZip from "adm-zip";
import { PetConfig, ProfileInfo, ProfilesIndex, cloneConfig, DEFAULT_CONFIG, hasAnyFrame } from "./types";

function userRoot(): string {
  return app.getPath("userData");
}

function bundledProfileDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bundled", "default");
  }
  return path.join(app.getAppPath(), "bundled", "default");
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

export function seedBundledProfileIfNeeded(): void {
  migrateLegacyLayout();
  const bundled = bundledProfileDir();
  if (!fs.existsSync(bundled)) return;

  const destDir = profileDir("default");
  const destConfig = profileConfigPath("default");
  let needsSeed = !fs.existsSync(destConfig);
  if (!needsSeed) {
    try {
      const raw = JSON.parse(fs.readFileSync(destConfig, "utf-8")) as PetConfig;
      needsSeed = !hasAnyFrame(raw.frames);
    } catch {
      needsSeed = true;
    }
  }
  if (!needsSeed) return;

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  copyDirRecursive(bundled, destDir);

  const bundledIndex = path.join(bundled, "profiles.json");
  if (fs.existsSync(bundledIndex)) {
    fs.copyFileSync(bundledIndex, indexPath());
  } else {
    fs.writeFileSync(indexPath(), JSON.stringify(defaultIndex(), null, 2), "utf-8");
  }
}

function indexPath(): string {
  return path.join(userRoot(), "profiles.json");
}

function profileDir(id: string): string {
  return path.join(userRoot(), "profiles", id);
}

function profileConfigPath(id: string): string {
  return path.join(profileDir(id), "pet-config.json");
}

function profileImagesDir(id: string): string {
  return path.join(profileDir(id), "images");
}

function defaultIndex(): ProfilesIndex {
  return { activeId: "default", profiles: [{ id: "default", name: "默认宠物" }] };
}

function migrateLegacyLayout(): void {
  const legacyConfig = path.join(userRoot(), "pet-config.json");
  const legacyImages = path.join(userRoot(), "images");
  if (!fs.existsSync(legacyConfig)) return;

  const targetDir = profileDir("default");
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(legacyConfig, profileConfigPath("default"));

  if (fs.existsSync(legacyImages)) {
    const dest = profileImagesDir("default");
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(legacyImages)) {
      const src = path.join(legacyImages, name);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(dest, name));
      }
    }
  }

  if (!fs.existsSync(indexPath())) {
    fs.writeFileSync(indexPath(), JSON.stringify(defaultIndex(), null, 2), "utf-8");
  }

  fs.renameSync(legacyConfig, `${legacyConfig}.migrated`);
}

export function loadProfilesIndex(): ProfilesIndex {
  migrateLegacyLayout();
  seedBundledProfileIfNeeded();
  const file = indexPath();
  if (!fs.existsSync(file)) {
    const idx = defaultIndex();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(idx, null, 2), "utf-8");
    fs.mkdirSync(profileDir("default"), { recursive: true });
    fs.mkdirSync(profileImagesDir("default"), { recursive: true });
    return idx;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as ProfilesIndex;
    if (!raw.activeId || !raw.profiles?.length) return defaultIndex();
    return raw;
  } catch {
    return defaultIndex();
  }
}

export function saveProfilesIndex(index: ProfilesIndex): void {
  fs.mkdirSync(userRoot(), { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(index, null, 2), "utf-8");
}

export function getActiveProfileId(): string {
  return loadProfilesIndex().activeId;
}

export function listProfiles(): ProfileInfo[] {
  return loadProfilesIndex().profiles;
}

export function getImagesDir(profileId?: string): string {
  const id = profileId ?? getActiveProfileId();
  const dir = profileImagesDir(id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getProfileBaseDir(profileId?: string): string {
  const id = profileId ?? getActiveProfileId();
  return profileDir(id);
}

export function getConfigPath(profileId?: string): string {
  const id = profileId ?? getActiveProfileId();
  fs.mkdirSync(profileDir(id), { recursive: true });
  return profileConfigPath(id);
}

export function createProfile(name: string): ProfileInfo {
  const index = loadProfilesIndex();
  const id = `p-${Date.now().toString(36)}`;
  const info: ProfileInfo = { id, name: name.trim() || "新宠物" };
  index.profiles.push(info);
  saveProfilesIndex(index);
  fs.mkdirSync(profileImagesDir(id), { recursive: true });
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.profileId = id;
  cfg.petName = info.name;
  fs.writeFileSync(profileConfigPath(id), JSON.stringify(cfg, null, 2), "utf-8");
  return info;
}

export function switchProfile(profileId: string): boolean {
  const index = loadProfilesIndex();
  if (!index.profiles.some((p) => p.id === profileId)) return false;
  index.activeId = profileId;
  saveProfilesIndex(index);
  return true;
}

export function renameProfile(profileId: string, name: string): boolean {
  const index = loadProfilesIndex();
  const item = index.profiles.find((p) => p.id === profileId);
  if (!item) return false;
  item.name = name.trim() || item.name;
  saveProfilesIndex(index);
  return true;
}

export function deleteProfile(profileId: string): boolean {
  if (profileId === "default") return false;
  const index = loadProfilesIndex();
  const next = index.profiles.filter((p) => p.id !== profileId);
  if (next.length === index.profiles.length) return false;
  index.profiles = next;
  if (index.activeId === profileId) index.activeId = next[0]?.id ?? "default";
  saveProfilesIndex(index);
  fs.rmSync(profileDir(profileId), { recursive: true, force: true });
  return true;
}

export function exportProfileZip(profileId: string, destZip: string): void {
  const configFile = profileConfigPath(profileId);
  if (!fs.existsSync(configFile)) throw new Error("档案不存在");
  const zip = new AdmZip();
  zip.addLocalFile(configFile, "", "pet-config.json");
  const images = profileImagesDir(profileId);
  if (fs.existsSync(images)) {
    for (const name of fs.readdirSync(images)) {
      const full = path.join(images, name);
      if (fs.statSync(full).isFile()) zip.addLocalFile(full, "images", name);
    }
  }
  zip.writeZip(destZip);
}

export function importProfileZip(zipPath: string, nameHint?: string): ProfileInfo {
  const zip = new AdmZip(zipPath);
  const info = createProfile(nameHint || "导入的宠物");
  const destConfig = profileConfigPath(info.id);
  const entry = zip.getEntry("pet-config.json");
  if (!entry) throw new Error("压缩包缺少 pet-config.json");
  fs.writeFileSync(destConfig, entry.getData());
  const imagesDir = profileImagesDir(info.id);
  for (const entryItem of zip.getEntries()) {
    if (entryItem.entryName.startsWith("images/") && !entryItem.isDirectory) {
      const base = path.basename(entryItem.entryName);
      fs.writeFileSync(path.join(imagesDir, base), entryItem.getData());
    }
  }
  const cfg = JSON.parse(fs.readFileSync(destConfig, "utf-8")) as PetConfig;
  cfg.profileId = info.id;
  fs.writeFileSync(destConfig, JSON.stringify(cfg, null, 2), "utf-8");
  return info;
}
