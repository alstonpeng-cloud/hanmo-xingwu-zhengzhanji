@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 汉末行伍征战记 - 本地试玩

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Node.js，请先安装 Node.js LTS：https://nodejs.org/
  echo 安装完成后重新双击本文件即可。
  pause
  exit /b 1
)

node tools\serve.mjs
echo.
echo 服务已停止。如果看到上面的报错，把报错内容发给我。
pause
