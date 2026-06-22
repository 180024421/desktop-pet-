#!/usr/bin/env python3
"""
从基准橘猫图自动生成各动作多帧素材，并写入 desktop-pet 配置。
（本地程序化动帧；非云端大模型重绘。接入 API 后可替换为真 AI 生成。）
"""

from __future__ import annotations

import json
import math
import os
import shutil
from pathlib import Path

from PIL import Image, ImageEnhance

ASSET_DIR = Path(
    r"C:\Users\EDY\.cursor\projects\e-xiangmu-jetlinks-cloud\assets"
)
APP_IMAGES = Path(os.environ.get("APPDATA", "")) / "desktop-pet" / "images"
OUT_DIR = APP_IMAGES / "generated"
CONFIG_PATH = Path(os.environ.get("APPDATA", "")) / "desktop-pet" / "pet-config.json"

CANVAS = (480, 480)


def resolve_existing(name: str, fallbacks: list[Path]) -> Path:
    p = APP_IMAGES / name
    if p.exists():
        return p
    for fb in fallbacks:
        if fb.exists():
            return fb
    raise FileNotFoundError(f"找不到素材: {name}")


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def fit_canvas(img: Image.Image, canvas: tuple[int, int] = CANVAS) -> Image.Image:
    cw, ch = canvas
    w, h = img.size
    scale = min(cw / w, ch / h, 1.0) * 0.88
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    out.paste(resized, ((cw - nw) // 2, ch - nh + int(ch * 0.06)), resized)
    return out


def transform(
    base: Image.Image,
    *,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    dx: float = 0.0,
    dy: float = 0.0,
    rotate: float = 0.0,
    brightness: float = 1.0,
) -> Image.Image:
    w, h = base.size
    nw = max(1, int(w * scale_x))
    nh = max(1, int(h * scale_y))
    img = base.resize((nw, nh), Image.Resampling.LANCZOS)
    if rotate:
        img = img.rotate(rotate, resample=Image.Resampling.BICUBIC, expand=True)
    if brightness != 1.0:
        r, g, b, a = img.split()
        rgb = Image.merge("RGB", (r, g, b))
        rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
        r, g, b = rgb.split()
        img = Image.merge("RGBA", (r, g, b, a))
    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    x = (base.size[0] - img.size[0]) // 2 + int(dx)
    y = (base.size[1] - img.size[1]) // 2 + int(dy)
    canvas.paste(img, (x, y), img)
    return canvas


def save_frames(frames: list[Image.Image], prefix: str) -> list[str]:
    paths: list[str] = []
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(frames):
        dest = OUT_DIR / f"{prefix}_{i:02d}.png"
        frame.save(dest, "PNG")
        paths.append(str(dest.resolve()))
    return paths


def gen_idle(base: Image.Image, n: int = 10) -> list[Image.Image]:
    out: list[Image.Image] = []
    for i in range(n):
        t = (i / n) * math.tau
        sy = 1.0 + 0.035 * math.sin(t)
        sx = 1.0 - 0.012 * math.sin(t)
        dy = -4 * math.sin(t)
        out.append(transform(base, scale_x=sx, scale_y=sy, dy=dy))
    return out


def gen_click(base: Image.Image) -> list[Image.Image]:
    return [
        transform(base, scale_x=1.05, scale_y=0.9, dy=6),
        transform(base, scale_x=0.96, scale_y=1.06, dy=-8),
        transform(base, scale_x=1.02, scale_y=0.96, dy=2),
        base,
    ]


def gen_walk(base: Image.Image, n: int = 8) -> list[Image.Image]:
    out: list[Image.Image] = []
    for i in range(n):
        t = (i / n) * math.tau
        lean = 4 * math.sin(t)
        bob = -6 * abs(math.sin(t))
        sx = 1.0 + 0.02 * math.sin(t + math.pi / 2)
        out.append(transform(base, scale_x=sx, scale_y=1.0, dx=lean * 2, dy=bob, rotate=lean * 0.35))
    return out


def gen_drag(base: Image.Image) -> list[Image.Image]:
    return [
        transform(base, rotate=-6, dy=-4),
        transform(base, rotate=6, dy=-4),
        transform(base, rotate=-3, dy=-2),
    ]


def gen_happy(happy: Image.Image, n: int = 6) -> list[Image.Image]:
    out: list[Image.Image] = []
    for i in range(n):
        t = (i / n) * math.tau
        jump = -14 * max(0, math.sin(t))
        scale = 1.0 + 0.04 * max(0, math.sin(t))
        out.append(transform(happy, scale_x=scale, scale_y=scale, dy=jump))
    return out


def gen_sleep(sleep: Image.Image, n: int = 6) -> list[Image.Image]:
    out: list[Image.Image] = []
    for i in range(n):
        t = (i / n) * math.tau
        sy = 1.0 + 0.015 * math.sin(t)
        out.append(transform(sleep, scale_y=sy, brightness=0.95))
    return out


def gen_sad(sleep: Image.Image) -> list[Image.Image]:
    return [
        transform(sleep, rotate=-2, brightness=0.9),
        transform(sleep, scale_y=0.98, dy=4, brightness=0.88),
        transform(sleep, rotate=2, brightness=0.9),
    ]


def gen_eat(happy: Image.Image) -> list[Image.Image]:
    return [
        transform(happy, dy=8, scale_y=0.97),
        transform(happy, dy=-10, scale_y=1.03),
        transform(happy, dy=4, scale_y=0.98),
        transform(happy, dy=-6),
    ]


def gen_angry(idle: Image.Image) -> list[Image.Image]:
    return [
        transform(idle, scale_x=1.04, scale_y=1.04, rotate=-3),
        transform(idle, scale_x=1.06, scale_y=0.96, dy=2, rotate=3),
        transform(idle, scale_x=1.03, scale_y=1.02, rotate=-2),
    ]


def main() -> int:
    idle_src = resolve_existing(
        "cat_idle.png",
        [ASSET_DIR / "e__xiangmu_video-promo-pipeline______20260622152231_3743_22.jpg"],
    )
    happy_src = resolve_existing(
        "cat_happy.png",
        [ASSET_DIR / "e__xiangmu_video-promo-pipeline______20260622152237_3747_22.jpg"],
    )
    sleep_src = resolve_existing(
        "cat_sleep.png",
        [ASSET_DIR / "e__xiangmu_video-promo-pipeline______20260622152238_3748_22.jpg"],
    )

    idle_base = fit_canvas(load_rgba(idle_src))
    happy_base = fit_canvas(load_rgba(happy_src))
    sleep_base = fit_canvas(load_rgba(sleep_src))

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    frames = {
        "idle": save_frames(gen_idle(idle_base), "idle"),
        "click": save_frames(gen_click(idle_base), "click"),
        "walk": save_frames(gen_walk(idle_base), "walk"),
        "drag": save_frames(gen_drag(idle_base), "drag"),
        "happy": save_frames(gen_happy(happy_base), "happy"),
        "sleep": save_frames(gen_sleep(sleep_base), "sleep"),
        "sad": save_frames(gen_sad(sleep_base), "sad"),
        "eat": save_frames(gen_eat(happy_base), "eat"),
        "angry": save_frames(gen_angry(idle_base), "angry"),
    }

    config = {
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
        "frameIntervalMs": 120,
        "position": None,
        "frames": frames,
        "cssEffect": "none",
        "animationMode": "states",
    }

    if CONFIG_PATH.exists():
        shutil.copy2(CONFIG_PATH, CONFIG_PATH.with_suffix(".json.bak"))
    CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

    total = sum(len(v) for v in frames.values())
    print(f"已生成 {total} 帧 -> {OUT_DIR}")
    for state, paths in frames.items():
        print(f"  {state}: {len(paths)} 帧")
    print(f"配置已写入 {CONFIG_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
