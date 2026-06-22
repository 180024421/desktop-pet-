# Desktop Pet 🐾

上传多张图片，**自动生成**透明悬浮桌面宠物（小红书同款风格）。

![Windows](https://img.shields.io/badge/Windows-10%2F11-blue)
![Electron](https://img.shields.io/badge/Electron-33-47848F)

## 功能一览

### 图片工坊
- 一次选择**多张 PNG/JPG/WebP/GIF**
- 按**文件名关键词**自动识别动作（支持中英文）
- 可手动调整每张图对应的动作状态
- 单张图时自动加**呼吸 / 弹跳 / 摇摆** CSS 动效
- 多帧图自动组成**待机动画循环**

### 桌面互动（尽可能多）
| 互动 | 说明 |
|------|------|
| 拖拽 | 按住宠物拖到任意位置，记忆坐标 |
| 单击 | 点击动画 + 说话气泡 + 好感度 |
| 双击 | 开心动画 + 跳跃 |
| 悬停 | 微微放大 |
| 滚轮 | 缩放宠物大小 |
| 漫游 | 定时在桌面随机溜达 |
| 跟随鼠标 | 宠物会朝光标缓慢移动 |
| 自动睡觉 | 长时间无操作进入睡眠 |
| 托盘喂食 | 进食动画 |
| 托盘陪玩 | 开心玩耍 |
| 托盘摸一摸 | 好感度上升 |
| 哄睡觉 / 叫醒 | 切换睡眠状态 |
| 鼠标穿透 | 不挡后面窗口操作 |
| 始终置顶 | 悬浮在最上层 |
| 系统托盘 | 显示/隐藏、快捷互动 |

### 文件名自动识别示例

| 文件名 | 识别为 |
|--------|--------|
| `cat_idle_01.png` | 待机 |
| `点击反应.png` | 点击 |
| `walk_1.png` / `走路.gif` | 行走 |
| `sleep.png` / `睡觉.png` | 睡觉 |
| `happy_smile.png` | 开心 |
| `eat_apple.png` | 进食 |

未匹配的图片会归入**待机**帧序列。

## 快速开始

```powershell
cd E:\xiangmu\desktop-pet-
.\run.ps1
```

或手动：

```powershell
npm install
npm run dev
```

首次启动会打开**工坊窗口** → 选择图片 → 保存并生成 → 宠物出现在桌面右下角。

## 打包 exe

```powershell
npm run dist
```

安装包输出在 `release/` 目录。

## 数据存储

配置与图片保存在：

```
%APPDATA%/desktop-pet/images/
%APPDATA%/desktop-pet/pet-config.json
```

托盘 → **打开图片目录** 可快速查看。

## 技术栈

- Electron + TypeScript
- 透明无边框窗口
- 文件名规则引擎自动分类

## 仓库

https://github.com/180024421/desktop-pet-

## License

MIT
