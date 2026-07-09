import { dialog, ipcMain, shell } from "electron";

import path from "path";

import fs from "fs";

import { loadConfig, saveConfig } from "./store";

import { exportStickerPack, exportsDir } from "./export-stickers";

import { exportPetGif, exportPetWebp } from "./export-gif";

import { renderDiaryCard, diaryDir } from "./diary";

import { createSharePack, importByShareCode } from "./share-pack";

import { exportSettingsBackup, importSettingsBackup, writeConfigToProfile } from "./settings-backup";

import { fetchWeather } from "./weather";

import {

  officeBridgePhrase,
  officeBridgePetHint,
  writeOfficeBuddyPetPet,
  readOfficeBuddyStats,
} from "./office-bridge";

import {

  analyzeFrameGaps,

  suggestFilename,

  generatePhraseSuggestions,

  configSummary,

} from "./pet-suggestions";

import {

  syncMultiPetWindows,

  getAllPetPositions,

  reportPetPosition,

  broadcastToAllPets,

} from "./multi-pet";

import { bumpLifetimeStats, statsSummary } from "./stats";

import { fetchLmStudioPhrase } from "./lmstudio-phrases";

import { detectForegroundScene } from "./scene-detect";

import { loadPlugins, mergePluginPhrases, runPluginOnInteract, ensurePluginsDir } from "./plugins";

import { listBundledPacks, importBundledPack } from "./bundled-packs";

import { batchRenameSuggestions } from "./batch-rename";

import { getPetWindow } from "./windows";
import { openStatsPanel } from "./stats-panel";



let cachedPlugins = loadPlugins();



function refreshPlugins(): void {

  cachedPlugins = loadPlugins();

}



export function registerFeatureIpc(): void {

  ipcMain.handle("pet:bump-interact", (_e, action?: string) => {

    const c = loadConfig();

    const result = bumpLifetimeStats(c, action || "interact");

    if (c.officeBridgeWriteEnabled) writeOfficeBuddyPetPet();

    saveConfig(c);

    return result;

  });



  ipcMain.handle("pet:unlock-tier", (_e, tier: number) => {

    const c = loadConfig();

    if (!c.unlockedTiers.includes(tier)) {

      c.unlockedTiers.push(tier);

      c.unlockedTiers.sort((a, b) => a - b);

      saveConfig(c);

    }

    return c.unlockedTiers;

  });



  ipcMain.handle("pet:report-position", (_e, report) => {

    reportPetPosition(report);

    broadcastToAllPets("pet:positions", getAllPetPositions());

    return { ok: true };

  });



  ipcMain.handle("features:export-stickers", async () => {

    const cfg = loadConfig();

    const dir = exportsDir();

    fs.mkdirSync(dir, { recursive: true });

    const dest = path.join(dir, `${cfg.petName || "pet"}-stickers.zip`);

    const files = await exportStickerPack(cfg, dest);

    return { ok: true, path: dest, files };

  });



  ipcMain.handle("features:export-gif", async () => {

    const cfg = loadConfig();

    const file = await exportPetGif(cfg);

    return { ok: true, path: file };

  });



  ipcMain.handle("features:export-webp", async () => {

    const cfg = loadConfig();

    const file = await exportPetWebp(cfg);

    return { ok: true, path: file };

  });



  ipcMain.handle("features:diary", async (_e, weekly?: boolean) => {

    const cfg = loadConfig();

    const file = await renderDiaryCard(cfg, Boolean(weekly));

    return { ok: true, path: file };

  });



  ipcMain.handle("features:share-create", () => {

    const cfg = loadConfig();

    return createSharePack(cfg.profileId, cfg.petName);

  });



  ipcMain.handle("features:share-import", (_e, code: string) => importByShareCode(code));



  ipcMain.handle("features:backup-export", () => {

    const cfg = loadConfig();

    return { ok: true, path: exportSettingsBackup(cfg) };

  });



  ipcMain.handle("features:backup-import", async () => {

    const result = await dialog.showOpenDialog({

      properties: ["openFile"],

      filters: [{ name: "JSON", extensions: ["json"] }],

    });

    if (result.canceled || !result.filePaths[0]) return { ok: false };

    const cfg = importSettingsBackup(result.filePaths[0]);

    writeConfigToProfile(cfg);

    return { ok: true, config: cfg };

  });



  ipcMain.handle("features:weather", async (_e, city?: string) => {

    const cfg = loadConfig();

    return fetchWeather(city || cfg.weatherCity || "Beijing");

  });



  ipcMain.handle("features:office-bridge", () => officeBridgePhrase());
  ipcMain.handle("features:office-bridge-stats", () => readOfficeBuddyStats());

  ipcMain.handle("features:office-hint", () => officeBridgePetHint());



  ipcMain.handle("features:frame-gaps", () => analyzeFrameGaps(loadConfig().frames));

  ipcMain.handle("features:suggest-name", (_e, fileName: string) => suggestFilename(fileName));

  ipcMain.handle("features:phrase-suggestions", (_e, petName: string) =>

    generatePhraseSuggestions(petName)

  );

  ipcMain.handle("features:config-summary", () => configSummary(loadConfig()));

  ipcMain.handle("features:open-exports", () => shell.openPath(exportsDir()));

  ipcMain.handle("features:open-diary", () => shell.openPath(diaryDir()));



  ipcMain.handle("features:sync-multi-pet", () => {

    const cfg = loadConfig();

    syncMultiPetWindows(cfg.multiPetProfileIds || [], cfg.profileId);

    return { ok: true };

  });



  ipcMain.handle("features:stats", () => statsSummary(loadConfig()));



  ipcMain.handle("features:lmstudio-phrase", async () => {

    const cfg = loadConfig();

    if (!cfg.lmStudioEnabled) return { ok: false };

    const phrase = await fetchLmStudioPhrase(cfg.lmStudioBaseUrl, cfg.petName);

    return { ok: Boolean(phrase), phrase };

  });



  ipcMain.handle("features:scene", () => detectForegroundScene());



  ipcMain.handle("features:pet-positions", () => getAllPetPositions());



  ipcMain.handle("features:plugins", () => {

    refreshPlugins();

    return cachedPlugins.map((p) => ({

      name: p.name,

      phraseKeys: Object.keys(p.phrases),

      scheduleCount: p.scheduleMessages.length,

      hasOnInteract: Boolean(p.onInteract),

    }));

  });



  ipcMain.handle("features:plugin-phrases", (_e, category: string) => {

    if (!loadConfig().pluginsEnabled) return [];

    return mergePluginPhrases(cachedPlugins, category);

  });



  ipcMain.handle("features:plugin-on-interact", () => {

    if (!loadConfig().pluginsEnabled) return null;

    return runPluginOnInteract(cachedPlugins);

  });



  ipcMain.handle("features:open-plugins-dir", () => shell.openPath(ensurePluginsDir()));



  ipcMain.handle("features:bundled-packs", () => listBundledPacks());

  ipcMain.handle("features:import-bundled", (_e, packId: string) => importBundledPack(packId));



  ipcMain.handle(

    "features:batch-rename",

    (_e, payload: { files: Array<{ fileName: string; state: string }>; mode: string }) =>

      batchRenameSuggestions(payload.files, payload.mode === "states" ? "states" : "flipbook")

  );



  ipcMain.handle("features:open-stats-window", () => {
    openStatsPanel();
    return { ok: true };
  });
}



export function startScenePoll(): void {

  setInterval(() => {

    const cfg = loadConfig();

    if (!cfg.sceneAutoHide && !cfg.sceneAutoShrink) return;

    const scene = detectForegroundScene();

    const pet = getPetWindow();

    if (!pet || pet.isDestroyed()) return;

  pet.webContents.send("pet:scene", {

      scene,

      hide: cfg.sceneAutoHide && scene === "fullscreen",

      shrink: cfg.sceneAutoShrink && scene === "fullscreen",

    });

  }, 4000);

}



export function startOfficeBridgePoll(): void {

  setInterval(() => {

    const cfg = loadConfig();

    if (!cfg.officeBridgeEnabled) return;

    const hint = officeBridgePetHint();

    if (!hint) return;

    const pet = getPetWindow();

    if (!pet || pet.isDestroyed()) return;

    pet.webContents.send("pet:office-hint", { hint });

  }, 60000);

}


