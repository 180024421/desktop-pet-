import fs from "fs";
import path from "path";
import os from "os";
import { PetConfig, cloneConfig } from "./types";
import { getConfigPath } from "./profiles";

export function settingsBackupDir(): string {
  return path.join(os.homedir(), "Documents", "desktop-pet", "backups");
}

export function exportSettingsBackup(config: PetConfig): string {
  const dir = settingsBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  const name = `${config.petName || "pet"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(cloneConfig(config), null, 2), "utf8");
  return file;
}

export function importSettingsBackup(filePath: string): PetConfig {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as PetConfig;
  return raw;
}

export function writeConfigToProfile(config: PetConfig): void {
  const file = getConfigPath(config.profileId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf8");
}
