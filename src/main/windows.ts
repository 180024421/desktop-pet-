import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  shell,
  OpenDialogOptions,
} from "electron";
import path from "path";
import fs from "fs";
import {
  buildFlipbookFrames,
  buildFramesFromAssignments,
  classifyUploads,
  describeAutoResult,
} from "./imageClassifier";
import {
  copyImageToStore,
  fileUrlForRenderer,
  getImagesDir,
  isPetReady,
  loadConfig,
  removeImage,
  saveConfig,
} from "./store";
import { PetConfig, PetState, cloneConfig } from "./types";

let petWindow: BrowserWindow | null = null;
let configWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let followInterval: ReturnType<typeof setInterval> | null = null;

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

function sendConfig(channel: string, payload?: unknown): void {
  configWindow?.webContents.send(channel, payload);
}

export function createPetWindow(show = true): BrowserWindow | null {
  const config = loadConfig();
  if (!isPetReady(config)) return null;

  if (petWindow && !petWindow.isDestroyed()) {
    if (show) petWindow.show();
    petWindow.webContents.send("pet:reload", serializePetConfig(config));
    return petWindow;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const pos = config.position ?? { x: width - 220, y: height - 260 };

  petWindow = new BrowserWindow({
    width: 280,
    height: 320,
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
    if (!app.isPackaged) {
      petWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  petWindow.setIgnoreMouseEvents(config.clickThrough, { forward: true });
  petWindow.loadFile(distPath("renderer", "pet", "index.html"));

  petWindow.webContents.on("did-finish-load", () => {
    petWindow?.webContents.send("pet:init", serializePetConfig(config));
  });

  petWindow.on("moved", () => {
    if (!petWindow) return;
    const [x, y] = petWindow.getPosition();
    const c = loadConfig();
    c.position = { x, y };
    saveConfig(c);
  });

  petWindow.on("closed", () => {
    petWindow = null;
  });

  if (!show) petWindow.hide();
  startFollowCursorLoop();
  return petWindow;
}

function startFollowCursorLoop(): void {
  if (followInterval) clearInterval(followInterval);
  followInterval = setInterval(() => {
    const config = loadConfig();
    if (!petWindow || petWindow.isDestroyed() || !config.followMouse) return;
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
    const step = Math.min(12, dist * 0.08);
    const nx = Math.round(wx + (dx / dist) * step);
    const ny = Math.round(wy + (dy / dist) * step);
    const area = screen.getDisplayNearestPoint(cursor).workArea;
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
    width: 920,
    height: 680,
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
    if (!app.isPackaged) {
      configWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  configWindow.on("closed", () => {
    configWindow = null;
  });
  return configWindow;
}

function serializePetConfig(config: PetConfig) {
  const mapFrames = (paths: string[]) => paths.map((path) => ({ path }));
  return {
    ...config,
    frames: {
      idle: mapFrames(config.frames.idle),
      click: mapFrames(config.frames.click),
      walk: mapFrames(config.frames.walk),
      drag: mapFrames(config.frames.drag),
      sleep: mapFrames(config.frames.sleep),
      happy: mapFrames(config.frames.happy),
      sad: mapFrames(config.frames.sad),
      eat: mapFrames(config.frames.eat),
      angry: mapFrames(config.frames.angry),
    },
  };
}

function serializeConfigForRenderer(config: PetConfig) {
  const mapFrames = (paths: string[]) =>
    paths.map((p) => ({ path: p, url: fileUrlForRenderer(p) }));

  return {
    ...config,
    frames: {
      idle: mapFrames(config.frames.idle),
      click: mapFrames(config.frames.click),
      walk: mapFrames(config.frames.walk),
      drag: mapFrames(config.frames.drag),
      sleep: mapFrames(config.frames.sleep),
      happy: mapFrames(config.frames.happy),
      sad: mapFrames(config.frames.sad),
      eat: mapFrames(config.frames.eat),
      angry: mapFrames(config.frames.angry),
    },
  };
}

function applyRuntimeFlags(config: PetConfig): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setAlwaysOnTop(config.alwaysOnTop, "screen-saver");
  petWindow.setIgnoreMouseEvents(config.clickThrough, { forward: true });
  petWindow.setFocusable(!config.clickThrough);
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
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  ) : icon);

  const config = loadConfig();
  const menu = Menu.buildFromTemplate([
    {
      label: config.petName || "Desktop Pet",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "显示/隐藏宠物",
      click: () => togglePetVisibility(),
    },
    {
      label: "跟随鼠标",
      type: "checkbox",
      checked: config.followMouse,
      click: (item) => {
        const c = loadConfig();
        c.followMouse = item.checked;
        saveConfig(c);
        sendPet("pet:settings", { followMouse: c.followMouse });
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
    {
      label: "摸一摸 😊",
      click: () => sendPet("pet:action", { type: "pet" }),
    },
    {
      label: "喂食 🍎",
      click: () => sendPet("pet:action", { type: "feed" }),
    },
    {
      label: "陪玩 🎾",
      click: () => sendPet("pet:action", { type: "play" }),
    },
    {
      label: "哄睡觉 💤",
      click: () => sendPet("pet:action", { type: "sleep" }),
    },
    {
      label: "叫醒 ⏰",
      click: () => sendPet("pet:action", { type: "wake" }),
    },
    { type: "separator" },
    {
      label: "编辑宠物 / 上传图片",
      click: () => createConfigWindow(),
    },
    {
      label: "打开图片目录",
      click: () => shell.openPath(getImagesDir()),
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => app.quit(),
    },
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

export function registerIpc(onReady: () => void): void {
  ipcMain.on("app:log", (_e, message: string) => {
    console.log("[renderer]", message);
  });

  ipcMain.handle("media:get-image-url", (_e, filePath: string) =>
    fileUrlForRenderer(filePath)
  );

  ipcMain.handle("pet:get-config", () => serializePetConfig(loadConfig()));

  ipcMain.handle("config:get", () => serializePetConfig(loadConfig()));

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

  ipcMain.handle(
    "config:save",
    async (_e, payload: { config: Partial<PetConfig>; assignments?: Array<{ sourcePath: string; state: PetState }> }) => {
      const current = loadConfig();
      let frames = current.frames;

      if (payload.assignments?.length) {
        const mode = payload.config.animationMode ?? current.animationMode ?? "flipbook";
        if (mode === "flipbook") {
          const paths = payload.assignments.map((a) => copyImageToStore(a.sourcePath));
          frames = buildFlipbookFrames(paths);
        } else {
          const mapped = payload.assignments.map((a) => ({
            destPath: copyImageToStore(a.sourcePath),
            state: a.state,
          }));
          frames = buildFramesFromAssignments(mapped);
        }
      }

      const next: PetConfig = {
        ...current,
        ...payload.config,
        frames,
        version: 1,
      };
      saveConfig(next);

      if (isPetReady(next)) {
        createPetWindow(true);
        applyRuntimeFlags(next);
      }
      rebuildTray(onReady);
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
    c.position = pos;
    saveConfig(c);
  });

  ipcMain.handle("pet:save-scale", (_e, scale: number) => {
    const c = loadConfig();
    c.scale = scale;
    saveConfig(c);
  });

  ipcMain.handle("pet:get-bounds", () => {
    const display = screen.getPrimaryDisplay().workArea;
    return display;
  });
}

export function bootstrapWindows(onReady: () => void): void {
  rebuildTray(onReady);
  const config = loadConfig();
  if (isPetReady(config)) {
    createPetWindow(true);
  } else {
    createConfigWindow();
  }
}
