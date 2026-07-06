#!/usr/bin/env python3
"""
从 video/ 目录导入 AI 动图：去背景、去水印、写入配置 + bundled 内置资源。
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "video"
BUNDLED_DIR = ROOT / "bundled" / "default"
BUNDLED_IMAGES = BUNDLED_DIR / "images" / "ai-import"
APP_DATA = Path(os.environ.get("APPDATA", "")) / "desktop-pet"
PROFILE_ID = "default"
APP_IMAGES = APP_DATA / "profiles" / PROFILE_ID / "images" / "ai-import"
CONFIG_PATH = APP_DATA / "profiles" / PROFILE_ID / "pet-config.json"
PROFILES_INDEX = APP_DATA / "profiles.json"
CANVAS = (480, 480)

FRAMES_PER_ACTION = 30
MAX_DURATION_SEC = 5.0
FRAME_INTERVAL_MS = 165

NAME_RULES: list[tuple[tuple[str, ...], list[str]]] = [
    (("咆哮", "angry", "怒"), ["angry"]),
    (("摸头杀", "摸头"), ["click"]),
    (("打哈欠", "哈欠"), ["sleep"]),
    (("撒娇",), ["idle"]),
    (("摆头",), ["idle", "drag"]),
    (("玩球",), ["happy"]),
    (("玩鱼", "吃鱼", "吃饭"), ["eat"]),
    (("跑步", "跑"), ["walk"]),
]


def classify_video(video: Path) -> list[str]:
    name = video.stem
    for keywords, states in NAME_RULES:
        if any(kw in name for kw in keywords):
            return states
    return ["idle"]


def sample_indices(total: int, fps: float, count: int) -> list[int]:
    max_frame = min(total - 1, int(fps * MAX_DURATION_SEC))
    if max_frame <= 0:
        return [0]
    if count >= max_frame:
        return list(range(max_frame + 1))
    step = max_frame / count
    return [min(max_frame, int(i * step)) for i in range(count)]


def _pixel_stats(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    arr = rgb.astype(np.float32)
    lum = arr.mean(axis=2)
    chroma = arr.max(axis=2) - arr.min(axis=2)
    return lum, chroma


def _is_orange_fur_vec(r, g, b):
    return (r > 88) & (g > 38) & (b < 155) & (r >= g - 8) & (g >= b * 0.45)


def estimate_background_color(rgb: np.ndarray) -> np.ndarray:
    """仅从四边「亮且低饱和度」像素估计背景色，避免采到猫毛。"""
    h, w = rgb.shape[:2]
    strips = np.vstack(
        [
            rgb[0:10, :].reshape(-1, 3),
            rgb[h - 10 : h, :].reshape(-1, 3),
            rgb[:, 0:10].reshape(-1, 3),
            rgb[:, w - 10 : w].reshape(-1, 3),
        ]
    ).astype(np.float32)
    lum = strips.mean(axis=1)
    chroma = strips.max(axis=1) - strips.min(axis=1)
    neutral = strips[(lum > 175) & (chroma < 28)]
    if len(neutral) < 20:
        neutral = strips[(lum > 150) & (chroma < 35)]
    if len(neutral) == 0:
        return np.array([240.0, 240.0, 240.0], dtype=np.float32)
    return np.median(neutral, axis=0)


def erase_watermarks(img: Image.Image) -> Image.Image:
    """仅擦除角落水印文字，不碰主体。"""
    arr = np.array(img.convert("RGB"))
    h, w = arr.shape[:2]
    bg = estimate_background_color(arr)
    zones = [
        (0, 0, max(140, int(w * 0.18)), max(48, int(h * 0.045))),
        (int(w * 0.70), int(h * 0.90), w, h),
    ]
    for x0, y0, x1, y1 in zones:
        patch = arr[y0:y1, x0:x1].astype(np.float32)
        r, g, b = patch[:, :, 0], patch[:, :, 1], patch[:, :, 2]
        lum = (r + g + b) / 3.0
        chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
        orange = _is_orange_fur_vec(r, g, b)
        # 只处理高亮/高对比水印，且明确不是猫毛
        watermark = (~orange) & (lum > 165) & (chroma > 22)
        for c in range(3):
            patch[:, :, c] = np.where(watermark, bg[c], patch[:, :, c])
        arr[y0:y1, x0:x1] = patch.astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def _is_background_like(
    rgb: np.ndarray,
    bg: np.ndarray,
    lum: np.ndarray,
    chroma: np.ndarray,
    tol: float = 34.0,
) -> np.ndarray:
    """判断像素是否像背景（亮灰/白，且接近估计背景色）。"""
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    dist = np.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
    near_bg = dist < tol
    bright_neutral = (lum > 198) & (chroma < 30)
    very_white = (lum > 238) & (chroma < 18)
    return near_bg & (bright_neutral | very_white) | very_white


def _flood_background_mask(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """仅从「确认是背景」的边框像素泛洪，不会从猫色角落扩散。"""
    h, w = rgb.shape[:2]
    lum, chroma = _pixel_stats(rgb)
    bg_like = _is_background_like(rgb, bg, lum, chroma)
    mask = np.zeros((h, w), dtype=np.uint8)
    work = rgb.copy()
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    lo = (18, 18, 18)
    hi = (18, 18, 18)

    seeds: list[tuple[int, int]] = []
    for x in range(0, w, max(1, w // 20)):
        seeds.append((0, x))
        seeds.append((h - 1, x))
    for y in range(0, h, max(1, h // 20)):
        seeds.append((y, 0))
        seeds.append((y, w - 1))

    for y, x in seeds:
        if not bg_like[y, x] or mask[y, x]:
            continue
        cv2.floodFill(
            work,
            flood_mask,
            (x, y),
            (0, 0, 0),
            lo,
            hi,
            cv2.FLOODFILL_MASK_ONLY | (255 << 8),
        )
        flooded = flood_mask[1:-1, 1:-1] > 0
        # 泛洪结果不得覆盖猫毛/高饱和度前景
        flooded &= bg_like
        mask |= flooded.astype(np.uint8)
        flood_mask.fill(0)

    return mask > 0


def remove_background(img: Image.Image) -> Image.Image:
    rgb_img = erase_watermarks(img)
    rgb = np.array(rgb_img.convert("RGB"))
    bg = estimate_background_color(rgb)
    lum, chroma = _pixel_stats(rgb)
    r, g, b = rgb[:, :, 0].astype(np.float32), rgb[:, :, 1].astype(np.float32), rgb[:, :, 2].astype(np.float32)

    bg_mask = _flood_background_mask(rgb, bg)
    # 极亮纯白区域（不依赖泛洪）
    bg_mask |= (lum > 242) & (chroma < 16)

    # 永远保留猫毛与饱和前景
    orange = _is_orange_fur_vec(r, g, b)
    foreground = orange | (chroma > 38) | (lum < 145)
    bg_mask &= ~foreground

    alpha = np.where(bg_mask, 0, 255).astype(np.float32)
    # 背景边缘轻微羽化
    fringe = (~bg_mask) & _is_background_like(rgb, bg, lum, chroma, tol=42.0) & ~foreground
    alpha = np.where(fringe, np.minimum(alpha, 120), alpha)
    alpha = np.clip(alpha, 0, 255).astype(np.uint8)

    rgba = np.dstack([rgb, alpha])
    return Image.fromarray(rgba, "RGBA")


def trim_alpha(img: Image.Image, pad: int = 4) -> Image.Image:
    arr = np.array(img)
    if arr.shape[2] < 4:
        return img
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 24)
    if len(xs) == 0:
        return img
    x0, x1 = max(0, xs.min() - pad), min(arr.shape[1], xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(arr.shape[0], ys.max() + pad)
    return img.crop((x0, y0, x1, y1))


def strip_corner_marks(img: Image.Image) -> Image.Image:
    """仅清除角落残留水印 alpha。"""
    arr = np.array(img.convert("RGBA"))
    h, w = arr.shape[:2]
    zones = [
        (0, 0, int(w * 0.20), int(h * 0.06)),
        (int(w * 0.72), int(h * 0.90), w, h),
    ]
    for x0, y0, x1, y1 in zones:
        patch = arr[y0:y1, x0:x1]
        r, g, b, a = patch[:, :, 0], patch[:, :, 1], patch[:, :, 2], patch[:, :, 3]
        orange = _is_orange_fur_vec(r.astype(float), g.astype(float), b.astype(float))
        lum = (r.astype(float) + g.astype(float) + b.astype(float)) / 3.0
        chroma = np.maximum(r, np.maximum(g, b)).astype(float) - np.minimum(r, np.minimum(g, b)).astype(float)
        watermark = (~orange) & (lum > 170) & (chroma > 20)
        patch[:, :, 3] = np.where(watermark, 0, a)
        arr[y0:y1, x0:x1] = patch
    return Image.fromarray(arr, "RGBA")


def fit_canvas(img: Image.Image, canvas: tuple[int, int] = CANVAS) -> Image.Image:
    cw, ch = canvas
    w, h = img.size
    scale = min(cw / w, ch / h) * 0.9
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    out.paste(resized, ((cw - nw) // 2, ch - nh - int(ch * 0.04)), resized)
    return strip_corner_marks(out)


def process_frame(bgr: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    cut = remove_background(Image.fromarray(rgb))
    cut = trim_alpha(cut)
    return fit_canvas(cut)


def extract_video_frames(video: Path, prefix: str, out_dir: Path) -> list[str]:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"无法打开视频: {video}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = sample_indices(total, fps, FRAMES_PER_ACTION)

    out_dir.mkdir(parents=True, exist_ok=True)
    rel_paths: list[str] = []
    for i, idx in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        out_img = process_frame(frame)
        filename = f"{prefix}_{i:02d}.png"
        out_img.save(out_dir / filename, "PNG")
        rel_paths.append(f"images/ai-import/{filename}")
    cap.release()
    return rel_paths


def build_config(frames: dict[str, list[str]]) -> dict:
    return {
        "version": 1,
        "profileId": PROFILE_ID,
        "petName": "橘猫",
        "scale": 1,
        "alwaysOnTop": True,
        "clickThrough": False,
        "followMouse": False,
        "wander": True,
        "speechEnabled": True,
        "autoStart": False,
        "idleSleepSeconds": 180,
        "frameIntervalMs": FRAME_INTERVAL_MS,
        "position": None,
        "frames": frames,
        "cssEffect": "none",
        "animationMode": "states",
        "affection": 50,
        "customPhrases": {
            "click": ["摸头杀~", "好痒呀", "再摸一下嘛", "呼噜呼噜"],
            "happy": ["玩球好开心！", "接着玩~", "耶耶耶~", "球别跑！"],
            "feed": ["鱼儿好香~", "谢谢投喂", "还想再吃一口"],
            "play": ["再来一局！", "球拿来~", "一起玩鱼鱼~"],
            "sleep": ["打哈欠…", "Zzz…", "好困呀", "晚安喵~"],
            "wander": ["跑步咯~", "遛弯时间", "哒哒哒~", "冲呀！"],
            "idle": ["撒娇中~", "看我呀", "摇摇头~", "喵~"],
            "pet": ["舒服~", "蹭蹭~", "主人最好了"],
            "angry": ["嗷呜！", "恶猫咆哮！", "别惹我", "哼！"],
            "wake": ["睡饱啦~", "精神满满！", "早呀喵~"],
        },
        "wanderIntervalMs": 8000,
        "wanderDistance": 100,
        "followSpeed": 12,
        "snapDistance": 48,
        "edgeMargin": 12,
        "ambientShowcase": True,
        "ambientIntervalMs": 45000,
        "syncBubbleWithState": True,
        "syncWallpaperWithState": False,
        "importOptions": {"trimTransparent": False, "chromakey": None},
    }


def write_outputs(frames: dict[str, list[str]]) -> None:
    cfg = build_config(frames)

    BUNDLED_DIR.mkdir(parents=True, exist_ok=True)
    (BUNDLED_DIR / "profiles.json").write_text(
        json.dumps(
            {"activeId": PROFILE_ID, "profiles": [{"id": PROFILE_ID, "name": "橘猫"}]},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (BUNDLED_DIR / "pet-config.json").write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    APP_DATA.mkdir(parents=True, exist_ok=True)
    PROFILES_INDEX.write_text(
        json.dumps(
            {"activeId": PROFILE_ID, "profiles": [{"id": PROFILE_ID, "name": "橘猫"}]},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    videos = sorted(VIDEO_DIR.glob("*.mp4"))
    if not videos:
        print(f"未找到视频：{VIDEO_DIR}")
        return 1

    if BUNDLED_IMAGES.exists():
        shutil.rmtree(BUNDLED_IMAGES)
    if APP_IMAGES.exists():
        shutil.rmtree(APP_IMAGES)

    frames: dict[str, list[str]] = {
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

    print(f"找到 {len(videos)} 个视频，开始处理…")
    for vi, video in enumerate(videos):
        states = classify_video(video)
        prefix = f"vid{vi:02d}"
        print(f"  [{vi + 1}/{len(videos)}] {video.name} -> {states}")
        paths = extract_video_frames(video, prefix, BUNDLED_IMAGES)
        for st in states:
            frames[st].extend(paths)

    if APP_IMAGES.exists():
        shutil.rmtree(APP_IMAGES)
    shutil.copytree(BUNDLED_IMAGES, APP_IMAGES)

    for st in frames:
        seen: set[str] = set()
        uniq: list[str] = []
        for p in frames[st]:
            if p not in seen:
                seen.add(p)
                uniq.append(p)
        frames[st] = uniq

    write_outputs(frames)

    summary = " · ".join(f"{k}×{len(v)}" for k, v in frames.items() if v)
    print("\n完成！")
    print(f"  bundled: {BUNDLED_DIR}")
    print(f"  本机配置: {CONFIG_PATH}")
    print(f"  动作: {summary}")
    print(f"  帧间隔: {FRAME_INTERVAL_MS}ms（约 5 秒一轮）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
