#!/usr/bin/env python3
"""Import cat photos: lightweight matting + desktop-pet config (no rembg download)."""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = Path(
    r"C:\Users\EDY\.cursor\projects\e-xiangmu-jetlinks-cloud\assets"
)
SOURCES = [
    {
        "paths": [
            ASSET_DIR / "e__xiangmu_video-promo-pipeline______20260622152231_3743_22.jpg",
            Path(r"E:\xiangmu\video-promo-pipeline\微信图片_20260622152231_3743_22.jpg"),
        ],
        "name": "cat_idle.png",
        "states": ["idle", "click", "walk", "drag"],
        "mat": "white",
    },
    {
        "paths": [
            ASSET_DIR / "e__xiangmu_video-promo-pipeline______20260622152237_3747_22.jpg",
            Path(r"E:\xiangmu\video-promo-pipeline\微信图片_20260622152237_3747_22.jpg"),
        ],
        "name": "cat_happy.png",
        "states": ["happy", "eat"],
        "mat": "soft",
    },
    {
        "paths": [
            ASSET_DIR / "e__xiangmu_video-promo-pipeline______20260622152238_3748_22.jpg",
            Path(r"E:\xiangmu\video-promo-pipeline\微信图片_20260622152238_3748_22.jpg"),
        ],
        "name": "cat_sleep.png",
        "states": ["sleep", "sad"],
        "mat": "soft",
    },
]

DEFAULT_FRAMES = {
    "idle": [],
    "click": [],
    "walk": [],
    "drag": [],
    "sleep": [],
    "happy": [],
    "sad": [],
    "eat": [],
    "angry": [],
}


def resolve_source(candidates: list[Path]) -> Path:
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError("missing: " + " | ".join(str(p) for p in candidates))


def remove_white_bg(img: Image.Image, threshold: int = 238) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def remove_soft_bg(img: Image.Image) -> Image.Image:
    """Rough matting: flood from corners + light pixels."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    visited = bytearray(w * h)
    stack: list[tuple[int, int]] = []

    def idx(x: int, y: int) -> int:
        return y * w + x

    def is_bg(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        # bright neutral background
        return r > 200 and g > 200 and b > 200 and abs(int(r) - int(g)) < 25 and abs(int(g) - int(b)) < 25

    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        sx, sy = seed
        if is_bg(sx, sy):
            stack.append(seed)

    while stack:
        x, y = stack.pop()
        i = idx(x, y)
        if visited[i]:
            continue
        visited[i] = 1
        if not is_bg(x, y):
            continue
        pixels[x, y] = (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2], 0)
        if x > 0:
            stack.append((x - 1, y))
        if x + 1 < w:
            stack.append((x + 1, y))
        if y > 0:
            stack.append((x, y - 1))
        if y + 1 < h:
            stack.append((x, y + 1))

    return rgba


def process_image(src: Path, dest: Path, mode: str) -> None:
    print(f"  process {src.name} -> {dest.name} ({mode})")
    with Image.open(src) as img:
        if mode == "white":
            out = remove_white_bg(img)
        else:
            out = remove_soft_bg(img)
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "PNG")


def app_data_dir() -> Path:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        raise RuntimeError("APPDATA not set")
    return Path(appdata) / "desktop-pet"


def build_config(image_map: dict[str, str]) -> dict:
    frames = {k: [] for k in DEFAULT_FRAMES}
    for item in SOURCES:
        out_path = image_map[item["name"]]
        for state in item["states"]:
            if out_path not in frames[state]:
                frames[state].append(out_path)
    if not frames["angry"]:
        frames["angry"] = [frames["idle"][0]]

    return {
        "version": 1,
        "petName": "橘猫",
        "scale": 1,
        "alwaysOnTop": True,
        "clickThrough": False,
        "followMouse": False,
        "wander": True,
        "speechEnabled": True,
        "autoStart": False,
        "idleSleepSeconds": 120,
        "frameIntervalMs": 200,
        "position": None,
        "frames": frames,
        "cssEffect": "breathe",
        "animationMode": "states",
    }


def main() -> int:
    data_dir = app_data_dir()
    images_dir = data_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    config_path = data_dir / "pet-config.json"
    if config_path.exists():
        shutil.copy2(config_path, data_dir / "pet-config.json.bak")

    image_map: dict[str, str] = {}
    for item in SOURCES:
        src = resolve_source(item["paths"])
        dest = images_dir / item["name"]
        process_image(src, dest, item["mat"])
        image_map[item["name"]] = str(dest.resolve())

    config = build_config(image_map)
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nOK: {config_path}")
    for state, paths in config["frames"].items():
        if paths:
            print(f"  {state}: {', '.join(Path(p).name for p in paths)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
