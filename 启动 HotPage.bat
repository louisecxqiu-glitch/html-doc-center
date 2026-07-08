@echo off
chcp 65001 >nul
REM ============================================================
REM  HotPage 启动脚本（Windows）
REM  双击此文件即可启动 HotPage，无需命令行
REM ============================================================

cd /d "%~dp0"

echo ═══════════════════════════════════════════
echo   HotPage 启动中...
echo ═══════════════════════════════════════════
echo.

REM ── 1. 找 Python 3 ──
set PYTHON=
for %%c in (python py python3) do (
  where %%c >nul 2>&1 && (
    set PYTHON=%%c
    goto found
  )
)
:found

if "%PYTHON%"=="" (
  echo ❌ 未找到 Python 3，正在打开下载页...
  start https://www.python.org/downloads/
  echo.
  echo 安装 Python 后，重新双击此文件即可。
  echo.
  pause
  exit /b 1
)

echo ✅ Python 检测到：%PYTHON%

REM ── 2. 检查 aiohttp ──
%PYTHON% -c "import aiohttp" 2>nul
if errorlevel 1 (
  echo 📦 正在安装依赖 aiohttp...
  %PYTHON% -m pip install aiohttp -q
  %PYTHON% -c "import aiohttp" 2>nul
  if errorlevel 1 (
    echo ❌ aiohttp 安装失败，请手动执行：
    echo    %PYTHON% -m pip install aiohttp
    echo.
    pause
    exit /b 1
  )
  echo ✅ aiohttp 已安装
) else (
  echo ✅ aiohttp 已就绪
)

echo.

REM ── 3. 询问是否设为开机自启 ──
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
if not exist "%STARTUP_DIR%\HotPage.lnk" (
  echo 是否设为开机自启？(y/n)
  set /p answer=
  if /i "%answer%"=="y" (
    echo Set oShell = CreateObject("WScript.Shell") > "%TEMP%\hp_shortcut.vbs"
    echo Set oShortcut = oShell.CreateShortcut("%STARTUP_DIR%\HotPage.lnk") >> "%TEMP%\hp_shortcut.vbs"
    echo oShortcut.TargetPath = "%~dpnx0" >> "%TEMP%\hp_shortcut.vbs"
    echo oShortcut.WorkingDirectory = "%~dp0" >> "%TEMP%\hp_shortcut.vbs"
    echo oShortcut.WindowStyle = 7 >> "%TEMP%\hp_shortcut.vbs"
    echo oShortcut.Save >> "%TEMP%\hp_shortcut.vbs"
    cscript //nologo "%TEMP%\hp_shortcut.vbs"
    del "%TEMP%\hp_shortcut.vbs"
    echo ✅ 已设为开机自启（Windows 开机后自动启动 HotPage）
  ) else (
    echo 跳过，如需后续设置可重新双击此文件
  )
  echo.
)

REM ── 4. 检查端口 ──
netstat -ano | findstr ":9901 " | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo ⚠️  HotPage 已在运行（端口 9901 被占用）
  echo    直接打开浏览器访问：http://localhost:9901
  start http://localhost:9901
  echo.
  echo 如需重启，先关闭旧进程再双击此文件。
  pause
  exit /b 0
)

REM ── 5. 启动服务 + 打开浏览器 ──
echo 🚀 启动服务中...
echo    地址：http://localhost:9901
echo    按 Ctrl+C 停止服务
echo.

start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:9901"

%PYTHON% server.py
