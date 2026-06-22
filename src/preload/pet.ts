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
  savePosition: (pos: { x: number; y: number }) =>
    ipcRenderer.invoke("pet:save-position", pos),
  saveScale: (scale: number) => ipcRenderer.invoke("pet:save-scale", scale),
  getWorkArea: () => ipcRenderer.invoke("pet:get-bounds"),
  openConfig: () => ipcRenderer.invoke("config:launch-pet"),
});
