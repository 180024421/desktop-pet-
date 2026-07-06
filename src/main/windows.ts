import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell,
  OpenDialogOptions,
} from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import {
  buildFlipbookFrames,
  buildFramesFromAssignments,
  classifyUploads,
  describeAutoResult,
} from "./imageClassifier";
import { extractGifFrames, extractVideoFrames, isGifFile, isVideoFile } from "./imageProcessor";
import {
  copyImageToStore,
  createProfile,
  deleteProfile,
  exportProfileZip,
  fileUrlForRenderer,
  getImagesDir,
  importProfileZip,
  isPetReady,
  listProfiles,
  loadConfig,
  removeImage,
  renameProfile,
  saveConfig,
  switchProfile,
} from "./store";
import { ImageImportOptions, PetConfig, PetState, cloneConfig } from "./types";
import { setDesktopWallpaper } from "./wallpaper";
import { serializePetConfig } from "./serialize-config";
import { frameCacheGet, frameCacheSet } from "./frame-cache";
import { syncMultiPetWindows } from "./multi-pet";
import { exportStickerPack, exportsDir } from "./export-stickers";
import { renderDiaryCard } from "./diary";
import { createSharePack } from "./share-pack";
import { openStatsPanel } from "./stats-panel";

let petWindow: BrowserWindow | null = null;
let configWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let followInterval: ReturnType<typeof setInterval> | null = null;
let positionSaveTimer: ReturnType<typeof setTimeout> | null = null;

const BASE_PET_WIDTH = 280;
const BASE_PET_HEIGHT = 320;

function shouldOpenDevTools(): boolean {
  return !app.isPackaged && process.env.DESKTOP_PET_DEVTOOLS === "1";
}

function schedulePositionSave(x: number, y: number): void {
  if (positionSaveTimer) clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(() => {
    const c = loadConfig();
    c.position = { x, y };
    saveConfig(c);
    positionSaveTimer = null;
  }, 400);
}

export function applyAutoStartSetting(enabled: boolean): void {
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()],
  });
}

function distPath(...segments: string[]): string {
  return path.join(__dirname, "..", ...segments);
}

function preloadPath(name: "pet" | "config"): string {
  return path.join(__dirname, "..", "preload", `${name}.js`);
}

export function getPetWindow(): BrowserWindow | null {
  return petWindow;
}

function sendPet(channel: string, payload?: unknown): void {
  petWindow?.webContents.send(channel, payload);
}

function workAreaForWindow(win: BrowserWindow | null) {
  const bounds = win?.getBounds() ?? screen.getPrimaryDisplay().bounds;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return screen.getDisplayNearestPoint(center).workArea;
}

export function resizePetWindow(scale: number): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const w = Math.round(BASE_PET_WIDTH * scale);
  const h = Math.round(BASE_PET_HEIGHT * scale);
  petWindow.setSize(w, h);
}

function sendConfig(channel: string, payload?: unknown): void {
  configWindow?.webContents.send(channel, payload);
}

export function createPetWindow(show = true): BrowserWindow | null {
  const config = loadConfig();
  if (!isPetReady(config)) return null;

  if (petWindow && !petWindow.isDestroyed()) {
    if (show) petWindow.show();
    applyRuntimeFlags(config);
    resizePetWindow(config.scale || 1);
    petWindow.webContents.send("pet:reload", serializePetConfig(config));
    return petWindow;
  }

  const area = workAreaForWindow(null);
  const pos = config.position ?? defaultPositionForConfig(config);

  petWindow = new BrowserWindow({
    width: BASE_PET_WIDTH,
    height: BASE_PET_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: config.alwaysOnTop,
    focusable: !config.clickThrough,
    webPreferences: {
      preload: preloadPath("pet"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  petWindow.webContents.on("did-finish-load", () => {
    if (shouldOpenDevTools()) {
      petWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  applyRuntimeFlags(config);
  resizePetWindow(config.scale || 1);
  petWindow.loadFile(distPath("renderer", "pet", "index.html"));

  petWindow.webContents.on("did-finish-load", () => {
    petWindow?.webContents.send("pet:init", serializePetConfig(config));
  });

  petWindow.on("moved", () => {
    if (!petWindow) return;
    const [x, y] = petWindow.getPosition();
    schedulePositionSave(x, y);
  });

  petWindow.on("closed", () => {
    petWindow = null;
  });

  if (!show) petWindow.hide();
  syncFollowCursorLoop();
  return petWindow;
}

function syncFollowCursorLoop(): void {
  if (followInterval) {
    clearInterval(followInterval);
    followInterval = null;
  }
  const config = loadConfig();
  if (!config.followMouse || !petWindow || petWindow.isDestroyed()) return;

  followInterval = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const cfg = loadConfig();
    if (!cfg.followMouse) return;

    const cursor = screen.getCursorScreenPoint();
    const [wx, wy] = petWindow.getPosition();
    const ww = petWindow.getBounds().width;
    const wh = petWindow.getBounds().height;
    const cx = wx + ww / 2;
    const cy = wy + wh / 2;
    const dx = cursor.x - cx;
    const dy = cursor.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) return;

    const step = Math.min(cfg.followSpeed ?? 12, dist * 0.08);
    const nx = Math.round(wx + (dx / dist) * step);
    const ny = Math.round(wy + (dy / dist) * step);
    const area = workAreaForWindow(petWindow);
    petWindow.setPosition(
      Math.max(area.x, Math.min(area.x + area.width - ww, nx)),
      Math.max(area.y, Math.min(area.y + area.height - wh, ny))
    );
    petWindow.webContents.send("pet:cursor-near", { near: dist < 80 });
  }, 50);
}

export function createConfigWindow(): BrowserWindow {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.focus();
    return configWindow;
  }

  configWindow = new BrowserWindow({
    width: 980,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: "Desktop Pet · 创建你的桌面宠物",
    show: true,
    webPreferences: {
      preload: preloadPath("config"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  configWindow.loadFile(distPath("renderer", "config", "index.html"));

  configWindow.webContents.on("did-finish-load", () => {
    if (shouldOpenDevTools()) {
      configWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  configWindow.on("closed", () => {
    configWindow = null;
  });
  return configWindow;
}

function defaultPositionForConfig(config: PetConfig): { x: number; y: number } {
  const area = workAreaForWindow(null);
  const displays = screen.getAllDisplays();
  for (const d of displays) {
    const key = String(d.id);
    if (config.positionsByDisplay?.[key]) return config.positionsByDisplay[key];
  }
  return { x: area.x + area.width - 220, y: area.y + area.height - 260 };
}

function serializeConfigForRenderer(config: PetConfig) {
  return serializePetConfig(config);
}

function applyRuntimeFlags(config: PetConfig): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setAlwaysOnTop(config.alwaysOnTop, "screen-saver");
  petWindow.setIgnoreMouseEvents(config.clickThrough, { forward: true });
  petWindow.setFocusable(!config.clickThrough);
  sendPet("pet:settings", {
    clickThrough: config.clickThrough,
    wander: config.wander,
    followMouse: config.followMouse,
  });
}

async function exportStickersMenu(): Promise<void> {
  const cfg = loadConfig();
  fs.mkdirSync(exportsDir(), { recursive: true });
  const dest = path.join(exportsDir(), `${cfg.petName || "pet"}-stickers.zip`);
  await exportStickerPack(cfg, dest);
  await dialog.showMessageBox({ message: `贴纸包已保存：${dest}`, type: "info" });
  shell.openPath(exportsDir());
}

async function diaryMenu(): Promise<void> {
  const file = await renderDiaryCard(loadConfig());
  await dialog.showMessageBox({ message: `日记卡片已生成：${file}`, type: "info" });
  shell.showItemInFolder(file);
}

async function shareCreateMenu(): Promise<void> {
  const cfg = loadConfig();
  const { code, zipPath } = createSharePack(cfg.profileId, cfg.petName);
  await dialog.showMessageBox({
    message: `分享码：${code}\n文件：${zipPath}\n把分享码发给好友，在工坊「导入分享码」使用。`,
    type: "info",
  });
}

function showPetContextMenu(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const config = loadConfig();
  const menu = Menu.buildFromTemplate([
    { label: "摸一摸 😊", click: () => sendPet("pet:action", { type: "pet" }) },
    { label: "喂食 🍎", click: () => sendPet("pet:action", { type: "feed" }) },
    { label: "陪玩 🎾", click: () => sendPet("pet:action", { type: "play" }) },
    { label: "哄睡觉 💤", click: () => sendPet("pet:action", { type: "sleep" }) },
    { label: "叫醒 ⏰", click: () => sendPet("pet:action", { type: "wake" }) },
    { type: "separator" },
    { label: "导出透明贴纸包", click: () => void exportStickersMenu() },
    { label: "生成今日日记卡片", click: () => void diaryMenu() },
    { label: "创建分享码", click: () => void shareCreateMenu() },
    { type: "separator" },
    { label: "编辑宠物", click: () => createConfigWindow() },
    {
      label: config.clickThrough ? "关闭鼠标穿透" : "开启鼠标穿透",
      click: () => {
        const c = loadConfig();
        c.clickThrough = !c.clickThrough;
        saveConfig(c);
        applyRuntimeFlags(c);
        rebuildTray(() => undefined);
      },
    },
    { type: "separator" },
    { label: "隐藏宠物", click: () => petWindow?.hide() },
  ]);
  menu.popup({ window: petWindow });
}

function rebuildTray(onReady: () => void): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  const iconPath = distPath("assets", "tray-icon.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  tray = new Tray(
    icon.isEmpty()
      ? nativeImage.createFromDataURL(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        )
      : icon
  );

  const config = loadConfig();
  const profiles = listProfiles();
  const profileMenu = profiles.map((p) => ({
    label: p.name,
    type: "radio" as const,
    checked: p.id === config.profileId,
    click: () => {
      switchProfile(p.id);
      const next = loadConfig();
      if (isPetReady(next)) createPetWindow(true);
      else petWindow?.close();
      rebuildTray(onReady);
    },
  }));

  const menu = Menu.buildFromTemplate([
    { label: config.petName || "Desktop Pet", enabled: false },
    { type: "separator" },
    { label: "显示/隐藏宠物", click: () => togglePetVisibility() },
    {
      label: "跟随鼠标",
      type: "checkbox",
      checked: config.followMouse,
      click: (item) => {
        const c = loadConfig();
        c.followMouse = item.checked;
        saveConfig(c);
        sendPet("pet:settings", { followMouse: c.followMouse });
        syncFollowCursorLoop();
        rebuildTray(onReady);
      },
    },
    {
      label: "开机自启",
      type: "checkbox",
      checked: config.autoStart,
      click: (item) => {
        const c = loadConfig();
        c.autoStart = item.checked;
        saveConfig(c);
        applyAutoStartSetting(c.autoStart);
        rebuildTray(onReady);
      },
    },
    {
      label: "桌面漫游",
      type: "checkbox",
      checked: config.wander,
      click: (item) => {
        const c = loadConfig();
        c.wander = item.checked;
        saveConfig(c);
        sendPet("pet:settings", { wander: c.wander });
        rebuildTray(onReady);
      },
    },
    {
      label: "鼠标穿透",
      type: "checkbox",
      checked: config.clickThrough,
      click: (item) => {
        const c = loadConfig();
        c.clickThrough = item.checked;
        saveConfig(c);
        applyRuntimeFlags(c);
        rebuildTray(onReady);
      },
    },
    {
      label: "始终置顶",
      type: "checkbox",
      checked: config.alwaysOnTop,
      click: (item) => {
        const c = loadConfig();
        c.alwaysOnTop = item.checked;
        saveConfig(c);
        applyRuntimeFlags(c);
        rebuildTray(onReady);
      },
    },
    { type: "separator" },
    { label: "切换档案", submenu: profileMenu },
    { label: "摸一摸 😊", click: () => sendPet("pet:action", { type: "pet" }) },
    { label: "喂食 🍎", click: () => sendPet("pet:action", { type: "feed" }) },
    { label: "陪玩 🎾", click: () => sendPet("pet:action", { type: "play" }) },
    { label: "哄睡觉 💤", click: () => sendPet("pet:action", { type: "sleep" }) },
    { label: "叫醒 ⏰", click: () => sendPet("pet:action", { type: "wake" }) },
    { type: "separator" },
    { label: "陪伴统计", click: () => openStatsPanel() },
    { label: "编辑宠物 / 上传图片", click: () => createConfigWindow() },
    { label: "打开图片目录", click: () => shell.openPath(getImagesDir()) },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]);

  tray.setToolTip(`${config.petName} · 桌面宠物`);
  tray.setContextMenu(menu);
  tray.on("double-click", () => togglePetVisibility());
}

function togglePetVisibility(): void {
  if (!petWindow || petWindow.isDestroyed()) {
    createPetWindow(true);
    return;
  }
  if (petWindow.isVisible()) petWindow.hide();
  else petWindow.show();
}

export function registerGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
  const shortcuts: Array<[string, () => void]> = [
    ["CommandOrControl+Shift+P", () => togglePetVisibility()],
    ["CommandOrControl+Shift+F", () => sendPet("pet:action", { type: "feed" })],
    ["CommandOrControl+Shift+H", () => sendPet("pet:action", { type: "pet" })],
    ["CommandOrControl+Shift+E", () => createConfigWindow()],
  ];
  for (const [accel, fn] of shortcuts) {
    try {
      globalShortcut.register(accel, fn);
    } catch (err) {
      console.warn("[desktop-pet] shortcut register failed:", accel, err);
    }
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}

export function registerIpc(onReady: () => void): void {
  ipcMain.on("app:log", (_e, message: string) => {
    console.log("[renderer]", message);
  });

  ipcMain.handle("media:get-image-url", (_e, filePath: string) => {
    const cfg = loadConfig();
    const cached = frameCacheGet(filePath);
    if (cached) return cached;
    const url = fileUrlForRenderer(filePath);
    frameCacheSet(filePath, url, cfg.frameCacheMax || 120);
    return url;
  });

  ipcMain.handle("pet:get-config", () => serializePetConfig(loadConfig()));
  ipcMain.handle("config:get", () => serializePetConfig(loadConfig()));

  ipcMain.handle("pet:get-bounds", (_e, pos?: { x: number; y: number }) => {
    if (pos && typeof pos.x === "number") {
      return screen.getDisplayNearestPoint(pos).workArea;
    }
    return workAreaForWindow(petWindow);
  });

  ipcMain.handle("pet:save-affection", (_e, value: number) => {
    const c = loadConfig();
    c.affection = Math.max(0, Math.min(100, Math.round(value)));
    saveConfig(c);
  });

  ipcMain.handle("pet:save-scale", (_e, scale: number) => {
    const c = loadConfig();
    c.scale = scale;
    saveConfig(c);
    resizePetWindow(scale);
  });

  ipcMain.handle("pet:set-click-through", (_e, enabled: boolean) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.setIgnoreMouseEvents(enabled, { forward: true });
  });

  ipcMain.on("pet:context-menu", () => showPetContextMenu());

  ipcMain.handle("pet:set-wallpaper", async (_e, filePath: string) => {
    if (!filePath) return { ok: false };
    const ok = await setDesktopWallpaper(filePath);
    return { ok };
  });

  ipcMain.handle("config:pick-images", async () => {
    const parent =
      configWindow && !configWindow.isDestroyed() ? configWindow : null;
    if (parent) {
      parent.show();
      parent.focus();
    }
    const options: OpenDialogOptions = {
      title: "选择宠物图片（可多选）",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      ],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return { canceled: true, items: [] as unknown[] };
    const classified = classifyUploads(result.filePaths);
    const items = classified.map((item) => ({
      ...item,
      previewUrl: fileUrlForRenderer(item.filePath),
    }));
    return { canceled: false, items };
  });

  ipcMain.handle("config:pick-media", async () => {
    const parent =
      configWindow && !configWindow.isDestroyed() ? configWindow : null;
    const options: OpenDialogOptions = {
      title: "选择 GIF 或视频",
      properties: ["openFile"],
      filters: [
        { name: "Media", extensions: ["gif", "mp4", "webm", "mov", "mkv"] },
      ],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { canceled: true, paths: [] as string[] };
    return { canceled: false, paths: result.filePaths };
  });

  ipcMain.handle(
    "config:extract-frames",
    async (_e, payload: { sourcePath: string; fps?: number; maxFrames?: number }) => {
      const tempDir = path.join(os.tmpdir(), `desktop-pet-extract-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      try {
        let frames: string[] = [];
        if (isGifFile(payload.sourcePath)) {
          frames = await extractGifFrames(payload.sourcePath, tempDir, payload.maxFrames ?? 60);
        } else if (isVideoFile(payload.sourcePath)) {
          frames = extractVideoFrames(
            payload.sourcePath,
            tempDir,
            payload.fps ?? 8,
            payload.maxFrames ?? 60
          );
        } else {
          throw new Error("不支持的文件格式");
        }
        return { ok: true, frames };
      } catch (err) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle("profiles:list", () => ({
    profiles: listProfiles(),
    activeId: loadConfig().profileId,
  }));

  ipcMain.handle("profiles:create", (_e, name: string) => {
    const info = createProfile(name);
    switchProfile(info.id);
    return { ok: true, profile: info };
  });

  ipcMain.handle("profiles:switch", (_e, profileId: string) => {
    const ok = switchProfile(profileId);
    if (ok && isPetReady(loadConfig())) createPetWindow(true);
    rebuildTray(onReady);
    return { ok, config: serializeConfigForRenderer(loadConfig()) };
  });

  ipcMain.handle("profiles:rename", (_e, payload: { id: string; name: string }) => ({
    ok: renameProfile(payload.id, payload.name),
  }));

  ipcMain.handle("profiles:delete", (_e, profileId: string) => {
    const ok = deleteProfile(profileId);
    if (ok) rebuildTray(onReady);
    return { ok };
  });

  ipcMain.handle("profiles:export", async (_e, profileId?: string) => {
    const id = profileId ?? loadConfig().profileId;
    const parent = configWindow && !configWindow.isDestroyed() ? configWindow : undefined;
    const result = parent
      ? await dialog.showSaveDialog(parent, {
          title: "导出宠物包",
          defaultPath: `${loadConfig().petName || "pet"}.zip`,
          filters: [{ name: "ZIP", extensions: ["zip"] }],
        })
      : await dialog.showSaveDialog({
          title: "导出宠物包",
          defaultPath: "pet.zip",
          filters: [{ name: "ZIP", extensions: ["zip"] }],
        });
    if (result.canceled || !result.filePath) return { ok: false };
    exportProfileZip(id, result.filePath);
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle("profiles:import", async () => {
    const parent = configWindow && !configWindow.isDestroyed() ? configWindow : undefined;
    const result = parent
      ? await dialog.showOpenDialog(parent, {
          properties: ["openFile"],
          filters: [{ name: "ZIP", extensions: ["zip"] }],
        })
      : await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "ZIP", extensions: ["zip"] }],
        });
    if (result.canceled || !result.filePaths[0]) return { ok: false };
    const info = importProfileZip(result.filePaths[0]);
    switchProfile(info.id);
    rebuildTray(onReady);
    return { ok: true, profile: info, config: serializeConfigForRenderer(loadConfig()) };
  });

  ipcMain.handle(
    "config:save",
    async (
      _e,
      payload: {
        config: Partial<PetConfig>;
        assignments?: Array<{ sourcePath: string; state: PetState }>;
        importOptions?: ImageImportOptions;
      }
    ) => {
      const current = loadConfig();
      let frames = current.frames;
      const importOpts = payload.importOptions ?? payload.config.importOptions ?? current.importOptions;

      if (payload.assignments?.length) {
        const mode = payload.config.animationMode ?? current.animationMode ?? "flipbook";
        const copied: Array<{ destPath: string; state: PetState }> = [];
        for (const a of payload.assignments) {
          const destPath = await copyImageToStore(a.sourcePath, importOpts);
          copied.push({ destPath, state: a.state });
        }
        if (mode === "flipbook") {
          frames = buildFlipbookFrames(copied.map((c) => c.destPath));
        } else {
          frames = buildFramesFromAssignments(copied);
        }
      }

      const next: PetConfig = {
        ...current,
        ...payload.config,
        frames,
        importOptions: importOpts,
        version: 1,
      };
      saveConfig(next);
      applyAutoStartSetting(Boolean(next.autoStart));
      syncMultiPetWindows(next.multiPetProfileIds || [], next.profileId);

      if (isPetReady(next)) {
        createPetWindow(true);
        applyRuntimeFlags(next);
        syncFollowCursorLoop();
        sendPet("pet:reload", serializePetConfig(next));
      }
      rebuildTray(onReady);
      sendConfig("config:profile-changed", serializeConfigForRenderer(next));
      return {
        ok: true,
        summary: describeAutoResult(next.frames),
        config: serializeConfigForRenderer(next),
      };
    }
  );

  ipcMain.handle("config:clear-images", async () => {
    const config = loadConfig();
    for (const list of Object.values(config.frames)) {
      for (const p of list) removeImage(p);
    }
    config.frames = {
      idle: [],
      click: [],
      walk: [],
      drag: [],
      sleep: [],
      happy: [],
      sad: [],
      eat: [],
      angry: [],
      special: [],
    };
    saveConfig(config);
    petWindow?.close();
    petWindow = null;
    return serializeConfigForRenderer(config);
  });

  ipcMain.handle("config:launch-pet", () => {
    const config = loadConfig();
    if (!isPetReady(config)) return { ok: false, reason: "请先上传至少一张图片" };
    createPetWindow(true);
    return { ok: true };
  });

  ipcMain.handle("pet:save-position", (_e, pos: { x: number; y: number }) => {
    const c = loadConfig();
    const display = screen.getDisplayNearestPoint(pos);
    c.position = pos;
    c.positionsByDisplay = c.positionsByDisplay || {};
    c.positionsByDisplay[String(display.id)] = pos;
    saveConfig(c);
  });
}

export function bootstrapWindows(onReady: () => void): void {
  const config = loadConfig();
  applyAutoStartSetting(Boolean(config.autoStart));
  rebuildTray(onReady);
  if (isPetReady(config)) {
    createPetWindow(true);
    syncMultiPetWindows(config.multiPetProfileIds || [], config.profileId);
  } else {
    createConfigWindow();
  }
}
