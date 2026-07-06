import fs from "fs";
import path from "path";
import os from "os";
import { PetState } from "./types";

export function batchRenameSuggestions(
  files: Array<{ fileName: string; state: string }>,
  mode: "flipbook" | "states"
): Array<{ from: string; to: string; state: string }> {
  const counts: Record<string, number> = {};
  return files.map((f, index) => {
    const ext = path.extname(f.fileName) || ".png";
    let state = f.state as PetState;
    if (mode === "flipbook") state = "idle";
    counts[state] = (counts[state] || 0) + 1;
    const num = String(counts[state]).padStart(2, "0");
    const to = mode === "flipbook" ? `frame_${String(index + 1).padStart(3, "0")}${ext}` : `${state}_${num}${ext}`;
    return { from: f.fileName, to, state };
  });
}
