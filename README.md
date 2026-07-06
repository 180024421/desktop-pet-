# Desktop Pet 🐾

上传多张图片，**自动生成**透明悬浮桌面宠物（小红书同款风格）。

**当前版本：v1.3.0**

![Windows](https://img.shields.io/badge/Windows-10%2F11-blue)
![Electron](https://img.shields.io/badge/Electron-33-47848F)

## 功能一览

### 图片工坊
- 一次选择**多张 PNG/JPG/WebP/GIF**
- **GIF / 视频拆帧**导入（视频需系统已安装 ffmpeg）
- 按**文件名关键词**自动识别动作（支持中英文）
- 连续帧模式：**拖拽排序**、↑↓ 调序、**单帧删除**
- **动效预览**（保存前按帧间隔循环播放）
- **色度键抠图** + **自动裁切透明边**（非 AI，基于像素规则）
- **多宠物档案**切换、**ZIP 导入/导出**
- **自定义台词**（点击/开心/喂食等气泡文案）

### 桌面互动
| 互动 | 说明 |
|------|------|
| 拖拽 | 按住宠物拖到任意位置，松手**贴边吸附**，多显示器**位置记忆** |
| 单击 / 双击 | 点击动画 + 说话气泡 + 好感度（**持久保存**，解锁动效档位） |
| 悬停 | 微微放大 |
| 滚轮 | 缩放宠物（窗口随比例自适应） |
| 右键 | 快捷菜单：喂食、陪玩、导出贴纸、日记卡片、分享码等 |
| 穿透模式 | 开启后显示 **⠿ 拖拽手柄**，不影响穿透 |
| 漫游 | 定时在桌面溜达（**边界限制** + 可调间隔/距离） |
| 跟随鼠标 | 靠近 walk / 远离 idle（可调速度） |
| 显示模式 | 完整 / 仅宠物 / **番茄钟挂件** |
| 日程气泡 | 早/午/晚/夜定时台词 |
| 活跃度联动 | 根据系统空闲自动说话或打盹 |
| 天气台词 | wttr.in 定时播报（可选） |
| Office Buddy | 读取打工人模拟器统计台词（可选） |
| 多宠同屏 | 最多 2 只副档案同时悬浮 |
| 全局快捷键 | `Ctrl+Shift+P` 显隐 · `F` 喂食 · `H` 摸一摸 · `E` 工坊 |
| 托盘 | 显示/隐藏、档案切换、快捷互动 |

### 导出与分享（v1.2+）
- **透明贴纸包** ZIP（各动作一帧 PNG）
- **透明 GIF / WebP 动图** 导出
- **今日日记 / 周报卡片** PNG（含 Office 统计、周互动曲线）
- **分享码** 创建 / 导入宠物档案
- **设置 JSON** 备份与恢复
- **帧缺口清单** + 文件名/台词建议 + **批量重命名建议**
- 工坊内 **色度键实时预览**（预览图点击吸管取色）
- **连续帧时间轴** + 循环区间编辑

### 体验增强（v1.3）
- **互动音效**、气泡样式（圆角/像素/漫画）
- **甩动抛掷**、**随机彩蛋**、**多宠碰一碰**
- **全屏场景**自动隐藏/缩小
- **喝水/休息提醒**、**LM Studio 本地台词**（可选）
- **Office Buddy 双向联动**（读统计 + 写撸猫计数）
- **插件目录**（`%APPDATA%/desktop-pet/plugins/`）
- **陪伴统计面板**、累计/周互动记录
- **内置素材包**导入、启动检查更新（GitHub Release）

### 性能
- 图片通过 **`pet://` 本地协议**加载 + **帧 URL LRU 缓存**

## 快速开始

```powershell
cd E:\xiangmu\desktop-pet-
.\run.ps1
```

或：

```powershell
npm install
npm run dev
```

调试 DevTools：`$env:DESKTOP_PET_DEVTOOLS='1'; npm run dev`

## 打包 exe

```powershell
npm run dist
```

输出目录：`release/`

## 数据存储

```
%APPDATA%/desktop-pet/profiles/<档案ID>/pet-config.json
%APPDATA%/desktop-pet/profiles/<档案ID>/images/
%APPDATA%/desktop-pet/profiles.json
```

旧版 `%APPDATA%/desktop-pet/pet-config.json` 会在首次启动时自动迁移到 `profiles/default/`。

## 仓库

https://github.com/180024421/desktop-pet-

## License

MIT
