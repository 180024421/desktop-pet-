import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("petApi", {
  onInit: (cb: (config: unknown) => void) => {
    ipcRenderer.on("pet:init", (_e, data) => cb(data));
    ipcRenderer.on("pet:reload", (_e, data) => cb(data));
  },
  onSettings: (cb: (data: unknown) => void) => {
    ipcRenderer.on("pet:settings", (_e, data) => cb(data));
  },
  onAction: (cb: (data: unknown) => void) => {
    ipcRenderer.on("pet:action", (_e, data) => cb(data));
  },
  onCursorNear: (cb: (data: { near: boolean }) => void) => {
    ipcRenderer.on("pet:cursor-near", (_e, data) => cb(data));
  },
  onActivity: (cb: (data: { level: number; busy: boolean }) => void) => {
    ipcRenderer.on("pet:activity", (_e, data) => cb(data));
  },
  onScene: (cb: (data: { scene: string; hide: boolean; shrink: boolean }) => void) => {
    ipcRenderer.on("pet:scene", (_e, data) => cb(data));
  },
  onOfficeHint: (cb: (data: { hint: string }) => void) => {
    ipcRenderer.on("pet:office-hint", (_e, data) => cb(data));
  },
  onPositions: (cb: (list: unknown[]) => void) => {
    ipcRenderer.on("pet:positions", (_e, data) => cb(data));
  },
  getConfig: () => ipcRenderer.invoke("pet:get-config"),
  getImageUrl: (filePath: string) => ipcRenderer.invoke("media:get-image-url", filePath),
  getWorkArea: (pos?: { x: number; y: number }) => ipcRenderer.invoke("pet:get-bounds", pos),
  savePosition: (pos: { x: number; y: number }) =>
    ipcRenderer.invoke("pet:save-position", pos),
  saveScale: (scale: number) => ipcRenderer.invoke("pet:save-scale", scale),
  saveAffection: (value: number) => ipcRenderer.invoke("pet:save-affection", value),
  setClickThrough: (enabled: boolean) => ipcRenderer.invoke("pet:set-click-through", enabled),
  setWallpaper: (filePath: string) => ipcRenderer.invoke("pet:set-wallpaper", filePath),
  showContextMenu: () => ipcRenderer.send("pet:context-menu"),
  openConfig: () => ipcRenderer.invoke("config:launch-pet"),
  bumpInteract: (action?: string) => ipcRenderer.invoke("pet:bump-interact", action),
  unlockTier: (tier: number) => ipcRenderer.invoke("pet:unlock-tier", tier),
  fetchWeather: (city?: string) => ipcRenderer.invoke("features:weather", city),
  officeBridge: () => ipcRenderer.invoke("features:office-bridge"),
  officeBridgeStats: () => ipcRenderer.invoke("features:office-bridge-stats"),
  reportPosition: (report: unknown) => ipcRenderer.invoke("pet:report-position", report),
  lmStudioPhrase: () => ipcRenderer.invoke("features:lmstudio-phrase"),
  pluginPhrases: (category: string) => ipcRenderer.invoke("features:plugin-phrases", category),
  pluginOnInteract: () => ipcRenderer.invoke("features:plugin-on-interact"),
});
