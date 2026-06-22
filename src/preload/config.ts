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
  save: (payload: unknown) => ipcRenderer.invoke("config:save", payload),
  clearImages: () => ipcRenderer.invoke("config:clear-images"),
  launchPet: () => ipcRenderer.invoke("config:launch-pet"),
});
