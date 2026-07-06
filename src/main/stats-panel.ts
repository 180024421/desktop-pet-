import { BrowserWindow } from "electron";
import { loadConfig } from "./store";
import { statsSummary } from "./stats";

export function openStatsPanel(): void {
  const win = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const summary = statsSummary(loadConfig());
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><style>
    body{font-family:"Microsoft YaHei",sans-serif;padding:20px;background:#fdf2f8;color:#334155}
    h1{font-size:18px} li{margin:8px 0}
  </style></head><body>
  <h1>📊 陪伴统计</h1>
  <ul>
    <li>今日互动：${summary.today}</li>
    <li>本周互动：${summary.weekTotal}</li>
    <li>累计互动：${summary.totalInteracts}</li>
    <li>陪伴天数：${summary.daysActive}</li>
    <li>解锁档位：${summary.unlockedTiers.join(", ") || "无"}</li>
  </ul>
  <h2>最常触发</h2>
  <ul>${summary.topActions.map((a) => `<li>${a.action} × ${a.count}</li>`).join("") || "<li>暂无</li>"}</ul>
  </body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}
