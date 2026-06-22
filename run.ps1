param(
  [switch]$Setup,
  [switch]$Build,
  [switch]$Dist,
  [switch]$Fix
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"

if ($Fix) {
  & "$PSScriptRoot\scripts\fix-electron.ps1"
  exit $LASTEXITCODE
}

function Test-ElectronReady {
  try {
    $p = node -e "process.stdout.write(require('electron'))" 2>$null
    return ($LASTEXITCODE -eq 0) -and ($p -like "*electron.exe*")
  } catch { return $false }
}

if (-not (Test-ElectronReady)) {
  Write-Host "Electron 未正确安装。正在尝试修复..." -ForegroundColor Yellow
  if ($Setup -or -not (Test-Path "node_modules")) {
    npm install
  }
  if (-not (Test-ElectronReady)) {
    Write-Host @"

Electron 二进制缺失（通常是网络中断导致）。
请按以下步骤操作：
  1. 任务管理器 → 结束所有「Electron」进程
  2. 以管理员身份运行: .\run.ps1 -Fix
  或手动:
     Remove-Item -Recurse -Force node_modules
     `$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
     npm install
     npm run dev

"@ -ForegroundColor Red
    exit 1
  }
}

if ($Setup -and (Test-Path "node_modules")) {
  npm install
}

if ($Dist) {
  npm run dist
  exit $LASTEXITCODE
}

if ($Build) {
  npm run build
  exit $LASTEXITCODE
}

npm run dev
