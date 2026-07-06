import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Windows：将桌面壁纸设为指定图片（PNG/JPG） */
export async function setDesktopWallpaper(imagePath: string): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const abs = path.resolve(imagePath);
  if (!fs.existsSync(abs)) return false;

  const escaped = abs.replace(/'/g, "''");
  const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DesktopPetWallpaper {
  [DllImport("user32.dll", CharSet=CharSet.Auto, SetLastError=true)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
[DesktopPetWallpaper]::SystemParametersInfo(20, 0, '${escaped}', 3) | Out-Null
`;
  try {
    await execFileAsync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true }
    );
    return true;
  } catch (err) {
    console.warn("[desktop-pet] set wallpaper failed:", err);
    return false;
  }
}
