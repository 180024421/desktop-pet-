import { BrowserWindow, screen } from "electron";
import path from "path";
import { loadConfigForProfile, isPetReady } from "./store";
import { serializePetConfig } from "./serialize-config";
import { PetConfig } from "./types";

const extraWindows = new Map<string, BrowserWindow>();

export interface PetPositionReport {
  profileId: string;
  petName: string;
  x: number;
  y: number;
  isPrimary: boolean;
}

const positionRegistry = new Map<string, PetPositionReport>();

function distPath(...segments: string[]): string {
  return path.join(__dirname, "..", ...segments);
}

function preloadPath(): string {
  return path.join(__dirname, "..", "preload", "pet.js");
}

function defaultPositionForConfig(config: PetConfig, offset = 0): { x: number; y: number } {
  const display = screen.getPrimaryDisplay();
  const saved = config.positionsByDisplay?.[String(display.id)];
  if (saved) return saved;
  const area = display.workArea;
  return {
    x: area.x + area.width - 300 - offset * 180,
    y: area.y + area.height - 280,
  };
}

function applyExtraRuntime(win: BrowserWindow, cfg: PetConfig): void {
  win.setAlwaysOnTop(cfg.alwaysOnTop, "screen-saver");
  win.setIgnoreMouseEvents(Boolean(cfg.clickThrough), { forward: true });
}

export function reportPetPosition(report: PetPositionReport): void {
  positionRegistry.set(report.profileId, report);
}

export function getAllPetPositions(): PetPositionReport[] {
  return Array.from(positionRegistry.values());
}

export function getExtraWindows(): Map<string, BrowserWindow> {
  return extraWindows;
}

export function syncMultiPetWindows(profileIds: string[], primaryId: string): void {
  const want = new Set(profileIds.filter((id) => id && id !== primaryId).slice(0, 2));

  for (const [id, win] of extraWindows) {
    if (!want.has(id)) {
      if (!win.isDestroyed()) win.close();
      extraWindows.delete(id);
      positionRegistry.delete(id);
    }
  }

  let offset = 1;
  for (const id of want) {
    const cfg = loadConfigForProfile(id);
    if (!isPetReady(cfg)) continue;

    const existing = extraWindows.get(id);
    if (existing && !existing.isDestroyed()) {
      existing.webContents.send("pet:reload", serializePetConfig(cfg));
      applyExtraRuntime(existing, cfg);
      continue;
    }

    const pos = defaultPositionForConfig(cfg, offset);
    const win = new BrowserWindow({
      width: Math.round(280 * (cfg.scale || 1)),
      height: Math.round(320 * (cfg.scale || 1)),
      x: pos.x,
      y: pos.y,
      frame: false,
      transparent: true,
      resizable: false,
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: cfg.alwaysOnTop,
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    win.loadFile(distPath("renderer", "pet", "index.html"));
    win.webContents.on("did-finish-load", () => {
      win.webContents.send("pet:init", { ...serializePetConfig(cfg), isSecondary: true });
    });
    applyExtraRuntime(win, cfg);
    win.on("closed", () => {
      extraWindows.delete(id);
      positionRegistry.delete(id);
    });
    extraWindows.set(id, win);
    offset += 1;
  }
}

export function closeAllExtraPets(): void {
  for (const win of extraWindows.values()) {
    if (!win.isDestroyed()) win.close();
  }
  extraWindows.clear();
  for (const [id, p] of positionRegistry) {
    if (!p.isPrimary) positionRegistry.delete(id);
  }
}

export function broadcastToAllPets(channel: string, payload: unknown): void {
  for (const win of extraWindows.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
