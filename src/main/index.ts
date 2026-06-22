import { app } from "electron";
import { bootstrapWindows, createConfigWindow, createPetWindow, getPetWindow, registerIpc } from "./windows";
import { isPetReady, loadConfig } from "./store";

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
    registerIpc(() => undefined);
    bootstrapWindows(() => undefined);

    app.on("activate", () => {
      if (isPetReady(loadConfig())) createPetWindow(true);
      else createConfigWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
