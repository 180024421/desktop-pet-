import fs from "fs";
import path from "path";
import os from "os";

export interface OfficeBridgeStats {
  keystrokesToday: number;
  activeMinutes: number;
  slackMinutes: number;
  petPetsToday?: number;
}

function buddyConfigPath(): string {
  return path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "desktop-office-buddy",
    "config.json"
  );
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function readOfficeBuddyStats(): OfficeBridgeStats | null {
  try {
    const cfgPath = buddyConfigPath();
    if (!fs.existsSync(cfgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
      stats?: {
        keystrokes?: number;
        activeMinutes?: number;
        slackMinutes?: number;
        petPets?: number;
        date?: string;
      };
    };
    const today = todayStr();
    if (raw.stats?.date !== today) {
      return { keystrokesToday: 0, activeMinutes: 0, slackMinutes: 0, petPetsToday: 0 };
    }
    return {
      keystrokesToday: raw.stats?.keystrokes ?? 0,
      activeMinutes: raw.stats?.activeMinutes ?? 0,
      slackMinutes: raw.stats?.slackMinutes ?? 0,
      petPetsToday: raw.stats?.petPets ?? 0,
    };
  } catch {
    return null;
  }
}

export function writeOfficeBuddyPetPet(): boolean {
  try {
    const cfgPath = buddyConfigPath();
    if (!fs.existsSync(cfgPath)) return false;
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
      stats?: {
        date?: string;
        keystrokes?: number;
        activeMinutes?: number;
        slackMinutes?: number;
        bossVisits?: number;
        petPets?: number;
      };
    };
    const today = todayStr();
    if (!raw.stats || raw.stats.date !== today) {
      raw.stats = {
        date: today,
        keystrokes: 0,
        activeMinutes: 0,
        slackMinutes: 0,
        bossVisits: 0,
        petPets: 0,
      };
    }
    raw.stats.petPets = (raw.stats.petPets ?? 0) + 1;
    fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function officeBridgePhrase(): string | null {
  const s = readOfficeBuddyStats();
  if (!s) return null;
  if (s.slackMinutes > s.activeMinutes && s.slackMinutes > 15) {
    return `打工人今天摸鱼 ${s.slackMinutes} 分钟了…`;
  }
  if (s.keystrokesToday > 500) return `主人在键盘上敲了 ${s.keystrokesToday} 下，好忙！`;
  if ((s.petPetsToday ?? 0) > 3) return `Buddy 也被撸了 ${s.petPetsToday} 次~`;
  return null;
}

export type OfficePetHint = "sleep" | "complain" | "cheer" | null;

export function officeBridgePetHint(): OfficePetHint {
  const s = readOfficeBuddyStats();
  if (!s) return null;
  if (s.slackMinutes > s.activeMinutes * 1.5 && s.slackMinutes > 20) return "sleep";
  if (s.keystrokesToday > 800 && s.activeMinutes > 60) return "complain";
  if (s.keystrokesToday > 200 && s.slackMinutes < 10) return "cheer";
  return null;
}
