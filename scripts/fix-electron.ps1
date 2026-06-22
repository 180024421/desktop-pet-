# 修复 Electron 安装失败（二进制未下载完整）
# 用法：以管理员 PowerShell 运行 .\scripts\fix-electron.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ">> 1. 结束 Electron 相关进程（请在任务管理器中确认已全部关闭）" -ForegroundColor Yellow
Get-Process electron -ErrorAction SilentlyContinue | ForEach-Object {
  try { Stop-Process -Id $_.Id -Force -ErrorAction Stop; Write-Host "   已结束 PID $($_.Id)" }
  catch { Write-Host "   无法结束 PID $($_.Id)，请手动在任务管理器结束「Electron」" -ForegroundColor Red }
}
Start-Sleep -Seconds 2

Write-Host ">> 2. 删除 node_modules" -ForegroundColor Cyan
if (Test-Path node_modules) {
  Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
  if (Test-Path node_modules) {
    Write-Host "   删除失败：文件夹仍被占用。请关闭 Cursor/终端后重试，或重启电脑。" -ForegroundColor Red
    exit 1
  }
}
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

Write-Host ">> 3. 重新安装依赖（使用国内镜像）" -ForegroundColor Cyan
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm install

Write-Host ">> 4. 验证 Electron" -ForegroundColor Cyan
node -e "console.log('electron path:', require('electron'))"

Write-Host ">> 5. 编译项目" -ForegroundColor Cyan
npm run build

Write-Host "`n修复完成！运行: npm run dev" -ForegroundColor Green
