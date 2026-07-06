import { app } from "electron";
import { registerPetProtocolSchemes, setupPetProtocolHandler } from "./protocol";
import {
  bootstrapWindows,
  createConfigWindow,
  createPetWindow,
  getPetWindow,
  registerGlobalShortcuts,
  registerIpc,
  unregisterGlobalShortcuts,
} from "./windows";
import { registerFeatureIpc, startScenePoll, startOfficeBridgePoll } from "./features-ipc";
import { startActivityPoll, stopActivityPoll } from "./activity";
import { isPetReady, loadConfig } from "./store";
import { checkForUpdatesOptional } from "./auto-update";

registerPetProtocolSchemes();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const pet = getPetWindow();
    if (pet && !pet.isDestroyed()) {
      pet.show();
      pet.focus();
    } else {
      createConfigWindow();
    }
  });

  app.whenReady().then(() => {
    setupPetProtocolHandler();
    registerIpc(() => undefined);
    registerFeatureIpc();
    registerGlobalShortcuts();
    startActivityPoll((level) => {
      const pet = getPetWindow();
      if (pet && !pet.isDestroyed()) {
        pet.webContents.send("pet:activity", { level, busy: level > 50 });
      }
    });
    startScenePoll();
    startOfficeBridgePoll();
    const cfg = loadConfig();
    void checkForUpdatesOptional(cfg.autoUpdateCheck !== false);
    bootstrapWindows(() => undefined);

    app.on("activate", () => {
      if (isPetReady(loadConfig())) createPetWindow(true);
      else createConfigWindow();
    });
  });

  app.on("will-quit", () => {
    unregisterGlobalShortcuts();
    stopActivityPoll();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
