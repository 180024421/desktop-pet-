import { app, dialog } from "electron";

let checking = false;

export async function checkForUpdatesOptional(enabled: boolean): Promise<void> {
  if (!enabled || !app.isPackaged || checking) return;
  checking = true;
  try {
    const { autoUpdater } = await import("electron-updater");
    autoUpdater.autoDownload = false;
    autoUpdater.on("update-available", (info) => {
      void dialog.showMessageBox({
        type: "info",
        message: `发现新版本 ${info.version}`,
        detail: "请在 GitHub Releases 页面下载，或稍后支持一键更新。",
      });
    });
    autoUpdater.on("error", () => {
      /* silent */
    });
    await autoUpdater.checkForUpdates();
  } catch {
    /* electron-updater optional */
  } finally {
    checking = false;
  }
}
