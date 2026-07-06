import { execSync } from "child_process";

export type SceneMode = "normal" | "fullscreen" | "presentation";

export function detectForegroundScene(): SceneMode {
  if (process.platform === "win32") return detectWindows();
  if (process.platform === "darwin") return detectMac();
  return "normal";
}

function detectWindows(): SceneMode {
  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class U32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
}
"@
$h=[U32]::GetForegroundWindow()
$r=New-Object U32+RECT
[void][U32]::GetWindowRect($h,[ref]$r)
$sw=[U32]::GetSystemMetrics(0); $sh=[U32]::GetSystemMetrics(1)
$ww=$r.R-$r.L; $wh=$r.B-$r.T
if($ww -ge $sw*0.92 -and $wh -ge $sh*0.85){'fullscreen'}else{'normal'}
`;
    const out = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, " ")}"`, {
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    }).trim();
    return out === "fullscreen" ? "fullscreen" : "normal";
  } catch {
    return "normal";
  }
}

function detectMac(): SceneMode {
  try {
    const out = execSync(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
      { encoding: "utf8", timeout: 3000 }
    ).trim();
    if (/Keynote|PowerPoint|fullscreen/i.test(out)) return "presentation";
    return "normal";
  } catch {
    return "normal";
  }
}
