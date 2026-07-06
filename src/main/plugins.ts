import fs from "fs";
import path from "path";
import os from "os";
import vm from "vm";

export interface PluginPhrasePack {
  name: string;
  phrases?: Record<string, string[]>;
  scheduleMessages?: string[];
}

export interface LoadedPlugin {
  name: string;
  phrases: Record<string, string[]>;
  scheduleMessages: string[];
  onInteract?: () => string | null;
}

function pluginsDir(): string {
  return path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "desktop-pet",
    "plugins"
  );
}

export function ensurePluginsDir(): string {
  const dir = pluginsDir();
  fs.mkdirSync(dir, { recursive: true });
  const readme = path.join(dir, "README.txt");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      "将 .plugin.json 或 .plugin.js 放于此目录。\n" +
        "JSON 示例: { \"name\":\"demo\", \"phrases\": { \"idle\": [\"插件台词\"] } }\n" +
        "JS 示例: module.exports = function(api) { api.onInteract = () => '来自插件~'; };\n",
      "utf8"
    );
  }
  return dir;
}

export function loadPlugins(): LoadedPlugin[] {
  const dir = ensurePluginsDir();
  const out: LoadedPlugin[] = [];
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (!fs.statSync(full).isFile()) continue;
    try {
      if (file.endsWith(".plugin.json")) {
        const raw = JSON.parse(fs.readFileSync(full, "utf8")) as PluginPhrasePack;
        out.push({
          name: raw.name || file,
          phrases: raw.phrases || {},
          scheduleMessages: raw.scheduleMessages || [],
        });
      } else if (file.endsWith(".plugin.js")) {
        const sandbox: {
          module: { exports?: unknown };
          exports: Record<string, unknown>;
        } = { module: {}, exports: {} };
        const code = fs.readFileSync(full, "utf8");
        vm.runInNewContext(code, sandbox, { filename: full, timeout: 1000 });
        const fn = sandbox.module.exports ?? sandbox.exports;
        const plugin: LoadedPlugin = {
          name: file,
          phrases: {},
          scheduleMessages: [],
        };
        if (typeof fn === "function") {
          const api: { onInteract?: () => string | null } = {};
          (fn as (a: typeof api) => void)(api);
          plugin.onInteract = api.onInteract;
        }
        out.push(plugin);
      }
    } catch {
      /* skip bad plugin */
    }
  }
  return out;
}

export function mergePluginPhrases(
  plugins: LoadedPlugin[],
  category: string
): string[] {
  const lines: string[] = [];
  for (const p of plugins) {
    const list = p.phrases[category];
    if (list?.length) lines.push(...list);
  }
  return lines;
}

export function runPluginOnInteract(plugins: LoadedPlugin[]): string | null {
  for (const p of plugins) {
    try {
      const line = p.onInteract?.();
      if (line) return line;
    } catch {
      /* ignore */
    }
  }
  return null;
}
