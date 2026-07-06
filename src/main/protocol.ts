import { app, net, protocol } from "electron";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const SCHEME = "pet";

export function registerPetProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

export function setupPetProtocolHandler(): void {
  protocol.handle(SCHEME, (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "local") {
        return new Response("Not Found", { status: 404 });
      }
      const filePath = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response("Not Found", { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).href);
    } catch (err) {
      console.error("[desktop-pet] protocol error:", err);
      return new Response("Error", { status: 500 });
    }
  });
}

export function fileUrlForRenderer(absPath: string): string {
  if (!absPath) return "";
  try {
    if (!fs.existsSync(absPath)) {
      console.warn("[desktop-pet] image missing:", absPath);
      return "";
    }
    const normalized = path.resolve(absPath).replace(/\\/g, "/");
    return `${SCHEME}://local/${encodeURIComponent(normalized)}`;
  } catch (err) {
    console.error("[desktop-pet] file url failed:", absPath, err);
    return "";
  }
}

export function ensureProtocolReady(): void {
  if (!app.isReady()) {
    throw new Error("App must be ready before protocol handler");
  }
}
