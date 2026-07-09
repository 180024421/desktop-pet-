import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("getPathForFile", (file: File) =>
  webUtils.getPathForFile(file)
);

contextBridge.exposeInMainWorld("appLog", (message: string) => {
  ipcRenderer.send("app:log", message);
});

contextBridge.exposeInMainWorld("configApi", {
  getImageUrl: (filePath: string) => ipcRenderer.invoke("media:get-image-url", filePath),
  getConfig: () => ipcRenderer.invoke("config:get"),
  pickImages: () => ipcRenderer.invoke("config:pick-images"),
  pickMedia: () => ipcRenderer.invoke("config:pick-media"),
  pickSpriteSheet: () => ipcRenderer.invoke("config:pick-sprite-sheet"),
  extractFrames: (payload: { sourcePath: string; fps?: number; maxFrames?: number }) =>
    ipcRenderer.invoke("config:extract-frames", payload),
  save: (payload: unknown) => ipcRenderer.invoke("config:save", payload),
  clearImages: () => ipcRenderer.invoke("config:clear-images"),
  launchPet: () => ipcRenderer.invoke("config:launch-pet"),
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  createProfile: (name: string) => ipcRenderer.invoke("profiles:create", name),
  switchProfile: (profileId: string) => ipcRenderer.invoke("profiles:switch", profileId),
  renameProfile: (payload: { id: string; name: string }) =>
    ipcRenderer.invoke("profiles:rename", payload),
  deleteProfile: (profileId: string) => ipcRenderer.invoke("profiles:delete", profileId),
  exportProfile: (profileId?: string) => ipcRenderer.invoke("profiles:export", profileId),
  importProfile: () => ipcRenderer.invoke("profiles:import"),
  onProfileChanged: (cb: (config: unknown) => void) => {
    ipcRenderer.on("config:profile-changed", (_e, data) => cb(data));
  },
  exportStickers: () => ipcRenderer.invoke("features:export-stickers"),
  exportGif: () => ipcRenderer.invoke("features:export-gif"),
  exportWebp: () => ipcRenderer.invoke("features:export-webp"),
  diary: (weekly?: boolean) => ipcRenderer.invoke("features:diary", weekly),
  shareCreate: () => ipcRenderer.invoke("features:share-create"),
  shareImport: (code: string) => ipcRenderer.invoke("features:share-import", code),
  backupExport: () => ipcRenderer.invoke("features:backup-export"),
  backupImport: () => ipcRenderer.invoke("features:backup-import"),
  frameGaps: () => ipcRenderer.invoke("features:frame-gaps"),
  suggestName: (fileName: string) => ipcRenderer.invoke("features:suggest-name", fileName),
  phraseSuggestions: (petName: string) => ipcRenderer.invoke("features:phrase-suggestions", petName),
  configSummary: () => ipcRenderer.invoke("features:config-summary"),
  openExports: () => ipcRenderer.invoke("features:open-exports"),
  openDiary: () => ipcRenderer.invoke("features:open-diary"),
  syncMultiPet: () => ipcRenderer.invoke("features:sync-multi-pet"),
  stats: () => ipcRenderer.invoke("features:stats"),
  openStatsWindow: () => ipcRenderer.invoke("features:open-stats-window"),
  batchRename: (payload: unknown) => ipcRenderer.invoke("features:batch-rename", payload),
  bundledPacks: () => ipcRenderer.invoke("features:bundled-packs"),
  importBundled: (packId: string) => ipcRenderer.invoke("features:import-bundled", packId),
  openPluginsDir: () => ipcRenderer.invoke("features:open-plugins-dir"),
  listPlugins: () => ipcRenderer.invoke("features:plugins"),
});
