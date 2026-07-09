#!/usr/bin/env python3
"""
从 video/ 目录导入 AI 动图：去背景、去水印、写入配置 + bundled 内置资源。
"""

from __future__ import annotations

import json
import os
import shutil
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

try:
    from rembg import remove as rembg_remove

    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False
    rembg_remove = None

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
MOTION_POOL_MULTIPLIER = 1  # 动态筛选后再均匀取 30 帧
MIN_CUTOUT_QUALITY = 0.30
MIN_MOTION_PERCENTILE = 48  # 低于此活动度的帧视为「非动态」

# 精确匹配（长关键词优先）→ 动作；比模糊 NAME_RULES 优先
VIDEO_EXACT_RULES: list[tuple[str, list[str]]] = [
    ("哄睡觉2", ["sleep"]),
    ("哄睡觉", ["sleep"]),
    ("哄睡", ["sleep"]),
    ("陪玩3", ["happy"]),
    ("陪玩2", ["happy"]),
    ("陪玩", ["happy"]),
    ("猫咪撒娇", ["idle"]),
    ("摸头杀", ["click"]),
    ("恶猫咆哮", ["angry"]),
    ("玩球1", ["special"]),
    ("玩球", ["special"]),
    ("aikun", ["special"]),
    ("艾坤", ["special"]),
    ("喂食", ["eat"]),
    ("玩鱼", ["eat"]),
    ("打哈欠", ["sleep"]),
    ("豆包", ["sleep"]),
    ("摆头", ["idle", "drag"]),
    ("跑步1", ["walk"]),
    ("跑步", ["walk"]),
]

NAME_RULES: list[tuple[tuple[str, ...], list[str]]] = [
    (("咆哮", "angry", "怒"), ["angry"]),
    (("摸头",), ["click"]),
    (("哈欠",), ["sleep"]),
    (("撒娇",), ["idle"]),
    (("投喂", "吃饭"), ["eat"]),
    (("跑",), ["walk"]),
]

# 个别视频跳过片头；完全排除低质量/重复源
VIDEO_OVERRIDES: dict[str, dict] = {
    "aikun": {"skip_sec": 0.35},
    "豆包": {"skip_sec": 1.2},
}

VIDEO_EXCLUDE: tuple[str, ...] = (
    "猫咪打哈欠",  # 实景背景 + 拉伸丑帧，用户要求移除
)


def classify_video(video: Path) -> list[str]:
    stem = video.stem
    for key, states in VIDEO_EXACT_RULES:
        if key in stem:
            return list(states)
    name = stem.lower()
    for key, override in VIDEO_OVERRIDES.items():
        if key in name and "states" in override:
            return list(override["states"])
    for keywords, states in NAME_RULES:
        if any(kw in stem for kw in keywords):
            return states
    return ["idle"]


def video_skip_sec(video: Path) -> float:
    name = video.stem.lower()
    for key, override in VIDEO_OVERRIDES.items():
        if key in name:
            return float(override.get("skip_sec", 0.0))
    return 0.0


def is_video_excluded(video: Path) -> bool:
    stem = video.stem
    return any(kw in stem for kw in VIDEO_EXCLUDE)


def read_frames_sequential(cap: cv2.VideoCapture, start: int, end: int) -> dict[int, np.ndarray]:
    """顺序读帧（避免 mp4 seek 失效导致 30 张重复图）。"""
    frames: dict[int, np.ndarray] = {}
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    idx = 0
    while idx <= end:
        ok, bgr = cap.read()
        if not ok:
            break
        if idx >= start:
            frames[idx] = bgr.copy()
        idx += 1
    return frames


def compute_frame_activity_from_dict(frames: dict[int, np.ndarray]) -> dict[int, float]:
    activity: dict[int, float] = {}
    sorted_idx = sorted(frames.keys())
    prev_gray: np.ndarray | None = None
    for idx in sorted_idx:
        gray = _center_gray(frames[idx])
        if prev_gray is not None:
            diff = float(cv2.absdiff(prev_gray, gray).mean())
            activity[idx - 1] = activity.get(idx - 1, 0.0) + diff * 0.5
            activity[idx] = activity.get(idx, 0.0) + diff * 0.5
        prev_gray = gray
    return activity


def _img_hash(img: Image.Image) -> str:
    import hashlib

    return hashlib.md5(img.tobytes()).hexdigest()


def sample_indices(total: int, fps: float, count: int, skip_sec: float = 0.0) -> list[int]:
    start = min(total - 1, max(0, int(fps * skip_sec)))
    max_frame = min(total - 1, int(fps * MAX_DURATION_SEC))
    if max_frame <= start:
        return [start]
    span = max_frame - start
    if count >= span:
        return list(range(start, max_frame + 1))
    step = span / count
    return [min(max_frame, start + int(i * step)) for i in range(count)]


def _center_gray(bgr: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    y0, y1 = int(h * 0.08), int(h * 0.92)
    x0, x1 = int(w * 0.08), int(w * 0.92)
    return cv2.cvtColor(bgr[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)


def compute_frame_activity(cap: cv2.VideoCapture, start: int, end: int) -> dict[int, float]:
    """逐帧活动度：相邻帧差分，用于剔除静态定格。"""
    activity: dict[int, float] = {}
    prev_gray: np.ndarray | None = None
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    for idx in range(start, end + 1):
        ok, bgr = cap.read()
        if not ok:
            break
        gray = _center_gray(bgr)
        if prev_gray is not None:
            diff = float(cv2.absdiff(prev_gray, gray).mean())
            activity[idx - 1] = activity.get(idx - 1, 0.0) + diff * 0.5
            activity[idx] = activity.get(idx, 0.0) + diff * 0.5
        prev_gray = gray
    return activity


def select_dynamic_indices(
    total: int,
    fps: float,
    count: int,
    activity: dict[int, float],
    skip_sec: float = 0.0,
) -> list[int]:
    start = min(total - 1, max(0, int(fps * skip_sec)))
    end = min(total - 1, int(fps * MAX_DURATION_SEC))
    if end <= start:
        return [start]

    scores = [(idx, activity.get(idx, 0.0)) for idx in range(start, end + 1)]
    if not scores:
        return sample_indices(total, fps, count, skip_sec)

    vals = np.array([s for _, s in scores], dtype=np.float32)
    threshold = max(1.4, float(np.percentile(vals, MIN_MOTION_PERCENTILE)))
    dynamic = [idx for idx, s in scores if s >= threshold]
    if len(dynamic) < max(8, count // 2):
        ranked = sorted(scores, key=lambda x: x[1], reverse=True)
        dynamic = sorted({idx for idx, _ in ranked[: max(count * 2, 40)]})

    dynamic.sort()
    if len(dynamic) <= count:
        return dynamic
    step = len(dynamic) / count
    return [dynamic[min(len(dynamic) - 1, int(i * step))] for i in range(count)]


def score_cutout_quality(rgba: np.ndarray) -> float:
    """抠图质量：前景占比、主连通域、碎片化、包围盒。"""
    if rgba.shape[2] < 4:
        return 0.0
    alpha = rgba[:, :, 3]
    fg = (alpha > 96).astype(np.uint8)
    ratio = float(fg.mean())
    if ratio < 0.07 or ratio > 0.78:
        return 0.0

    n, _labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    if n <= 1:
        return 0.0
    areas = stats[1:, cv2.CC_STAT_AREA]
    main_ratio = float(areas.max() / max(areas.sum(), 1))
    if main_ratio < 0.72:
        return 0.0

    ys, xs = np.where(fg)
    h_span = int(ys.max() - ys.min())
    w_span = int(xs.max() - xs.min())
    h, w = rgba.shape[:2]
    if min(h_span, w_span) < min(h, w) * 0.22:
        return 0.0

    size_score = 1.0 - abs(ratio - 0.28) / 0.28
    return max(0.0, min(1.0, main_ratio * 0.55 + size_score * 0.45))


def pick_frame_with_quality_from_bgr(
    bgr: np.ndarray,
    cap: cv2.VideoCapture | None,
    idx: int,
    start: int,
    end: int,
    activity: dict[int, float],
    frame_map: dict[int, np.ndarray],
) -> tuple[Image.Image, float]:
    out = process_frame(bgr)
    q = score_cutout_quality(np.array(out)) + min(activity.get(idx, 0.0), 12.0) * 0.015
    if q >= MIN_CUTOUT_QUALITY:
        return out, q

    best_img = out
    best_q = q
    for delta in (-1, 1, -2, 2, -3, 3):
        alt = idx + delta
        if alt < start or alt > end or alt not in frame_map:
            continue
        alt_out = process_frame(frame_map[alt])
        alt_q = score_cutout_quality(np.array(alt_out)) + min(activity.get(alt, 0.0), 12.0) * 0.015
        if alt_q > best_q:
            best_q = alt_q
            best_img = alt_out
    return best_img, best_q


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


def refine_alpha(rgba: np.ndarray) -> np.ndarray:
    """形态学清理 + 保留主连通域及邻近部件（尾巴等）+ 去色溢 + 边缘羽化。"""
    if rgba.shape[2] < 4:
        return rgba
    alpha = rgba[:, :, 3]
    fg = (alpha > 96).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, kernel, iterations=2)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel, iterations=1)

    n, labels, stats, centroids = cv2.connectedComponentsWithStats(fg, connectivity=8)
    if n > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        main_idx = 1 + int(np.argmax(areas))
        main_area = int(stats[main_idx, cv2.CC_STAT_AREA])
        x, y, w, h = stats[main_idx, :4]
        pad = max(24, int(max(w, h) * 0.08))
        box = (x - pad, y - pad, x + w + pad, y + h + pad)
        keep_mask = labels == main_idx
        for idx in range(1, n):
            if idx == main_idx:
                continue
            area = int(stats[idx, cv2.CC_STAT_AREA])
            if area < max(80, main_area // 40):
                continue
            cx, cy = centroids[idx]
            if box[0] <= cx <= box[2] and box[1] <= cy <= box[3]:
                keep_mask |= labels == idx
        fg = keep_mask.astype(np.uint8)

    alpha = (fg * 255).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    out = rgba.copy()
    out[:, :, 3] = alpha
    return out


def remove_background_rembg(img: Image.Image) -> Image.Image:
    cleaned = erase_watermarks(img)
    out = rembg_remove(cleaned)
    if isinstance(out, bytes):
        out = Image.open(BytesIO(out))
    arr = refine_alpha(np.array(out.convert("RGBA")))
    return strip_corner_marks(Image.fromarray(arr, "RGBA"))


def remove_background_classic(img: Image.Image) -> Image.Image:
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

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    arr = refine_alpha(np.dstack([rgb, alpha]))
    return strip_corner_marks(Image.fromarray(arr, "RGBA"))


def remove_background(img: Image.Image) -> Image.Image:
    if HAS_REMBG:
        try:
            return remove_background_rembg(img)
        except Exception as exc:
            print(f"    rembg 失败，回退经典抠图: {exc}")
    return remove_background_classic(img)


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
        (0, 0, int(w * 0.22), int(h * 0.08)),
        (int(w * 0.68), int(h * 0.88), w, h),
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
    skip = video_skip_sec(video)
    start = min(total - 1, max(0, int(fps * skip)))
    end = min(total - 1, int(fps * MAX_DURATION_SEC))

    frame_map = read_frames_sequential(cap, start, end)
    cap.release()
    if not frame_map:
        print("      警告: 无有效帧，跳过")
        return []

    activity = compute_frame_activity_from_dict(frame_map)
    indices = select_dynamic_indices(total, fps, FRAMES_PER_ACTION, activity, skip_sec=skip)
    indices = [i for i in indices if i in frame_map]

    out_dir.mkdir(parents=True, exist_ok=True)
    rel_paths: list[str] = []
    seen_hashes: set[str] = set()
    for idx in indices:
        out_img, quality = pick_frame_with_quality_from_bgr(
            frame_map[idx], None, idx, start, end, activity, frame_map
        )
        ih = _img_hash(out_img)
        if ih in seen_hashes:
            continue
        if quality < MIN_CUTOUT_QUALITY * 0.85:
            continue
        seen_hashes.add(ih)
        filename = f"{prefix}_{len(rel_paths):02d}.png"
        out_img.save(out_dir / filename, "PNG")
        rel_paths.append(f"images/ai-import/{filename}")

    if len(rel_paths) < FRAMES_PER_ACTION:
        ranked = sorted(
            ((i, activity.get(i, 0.0)) for i in frame_map),
            key=lambda x: x[1],
            reverse=True,
        )
        for idx, _act in ranked:
            if len(rel_paths) >= FRAMES_PER_ACTION:
                break
            out_img, _q = pick_frame_with_quality_from_bgr(
                frame_map[idx], None, idx, start, end, activity, frame_map
            )
            ih = _img_hash(out_img)
            if ih in seen_hashes:
                continue
            seen_hashes.add(ih)
            filename = f"{prefix}_{len(rel_paths):02d}.png"
            out_img.save(out_dir / filename, "PNG")
            rel_paths.append(f"images/ai-import/{filename}")

    unique = len(seen_hashes)
    print(f"      动态帧: {len(rel_paths)}/{FRAMES_PER_ACTION} 保留，去重后 {unique} 种")
    if unique < 8:
        print(f"      警告: {video.name} 有效帧过少（{unique}），建议检查源视频")
    return rel_paths[:FRAMES_PER_ACTION]


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
        "renderMode": "flipbook",
        "animationMode": "states",
        "shimejiMode": False,
        "bongoMode": False,
        "affection": 50,
        "customPhrases": {
            "click": ["摸头杀~", "好痒呀", "再摸一下嘛", "呼噜呼噜"],
            "happy": ["陪玩好开心！", "再来一局~", "耶耶耶~", "一起玩！"],
            "feed": ["鱼儿好香~", "谢谢投喂", "还想再吃一口", "好吃好吃！"],
            "play": ["接球！", "来玩呀~", "球别跑！", "冲冲冲！"],
            "sleep": ["打哈欠…", "Zzz…", "好困呀", "晚安喵~"],
            "wander": ["跑步咯~", "遛弯时间", "哒哒哒~", "冲呀！"],
            "idle": ["撒娇中~", "看我呀", "摇摇头~", "喵~"],
            "pet": ["舒服~", "蹭蹭~", "主人最好了"],
            "angry": ["嗷呜！", "恶猫咆哮！", "别惹我", "哼！"],
            "wake": ["睡饱啦~", "精神满满！", "早呀喵~"],
            "special": ["运球喵~", "坤坤附体！", "球来~", "隐藏技能！"],
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
    if CONFIG_PATH.exists():
        try:
            old = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            for key in ("position", "positionsByDisplay", "scale", "affection", "wander", "customPhrases"):
                if key in old:
                    cfg[key] = old[key]
        except Exception:
            pass

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
        "special": [],
    }

    print(f"找到 {len(videos)} 个视频，开始处理…")
    print(f"  抠图引擎: {'rembg (AI)' if HAS_REMBG else '经典色度键'}")
    for vi, video in enumerate(videos):
        if is_video_excluded(video):
            print(f"  [跳过] {video.name}（已排除）")
            continue
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
