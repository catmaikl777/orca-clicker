@echo off
REM Скрипт для проверки готовности к деплойменту (Windows)

echo 🔍 Проверка готовности к деплойменту...
echo.

REM Счетчики
setlocal enabledelayedexpansion
set pass=0
set fail=0

echo 📋 Проверка зависимостей...

REM Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Node.js
    set /a pass+=1
) else (
    echo ❌ Node.js
    set /a fail+=1
)

REM npm
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ npm
    set /a pass+=1
) else (
    echo ❌ npm
    set /a fail+=1
)

REM git
where git >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ git
    set /a pass+=1
) else (
    echo ❌ git
    set /a fail+=1
)

echo.
echo 📂 Проверка файлов...

REM Файлы
if exist package.json (echo ✅ package.json && set /a pass+=1) else (echo ❌ package.json && set /a fail+=1)
if exist websocket-server.js (echo ✅ websocket-server.js && set /a pass+=1) else (echo ❌ websocket-server.js && set /a fail+=1)
if exist server.js (echo ✅ server.js && set /a pass+=1) else (echo ❌ server.js && set /a fail+=1)
if exist client.js (echo ✅ client.js && set /a pass+=1) else (echo ❌ client.js && set /a fail+=1)
if exist index.html (echo ✅ index.html && set /a pass+=1) else (echo ❌ index.html && set /a fail+=1)
if exist auth.js (echo ✅ auth.js && set /a pass+=1) else (echo ❌ auth.js && set /a fail+=1)
if exist .gitignore (echo ✅ .gitignore && set /a pass+=1) else (echo ❌ .gitignore && set /a fail+=1)

echo.
echo 🔧 Проверка конфигурации...

if exist vercel.json (echo ✅ vercel.json && set /a pass+=1) else (echo ❌ vercel.json && set /a fail+=1)
if exist render.yaml (echo ✅ render.yaml && set /a pass+=1) else (echo ❌ render.yaml && set /a fail+=1)
if exist .env.example (echo ✅ .env.example && set /a pass+=1) else (echo ❌ .env.example && set /a fail+=1)

echo.
echo 💾 Проверка node_modules...

if exist node_modules (
    echo ✅ node_modules
    set /a pass+=1
) else (
    echo ⚠️ node_modules не найден (запустите: npm install)
    set /a fail+=1
)

echo.
echo ✨ Проверка синтаксиса...

node -c websocket-server.js >nul 2>nul
if %ERRORLEVEL% EQU 0 (echo ✅ websocket-server.js && set /a pass+=1) else (echo ❌ websocket-server.js && set /a fail+=1)

node -c server.js >nul 2>nul
if %ERRORLEVEL% EQU 0 (echo ✅ server.js && set /a pass+=1) else (echo ❌ server.js && set /a fail+=1)

node -c client.js >nul 2>nul
if %ERRORLEVEL% EQU 0 (echo ✅ client.js && set /a pass+=1) else (echo ❌ client.js && set /a fail+=1)

echo.
echo 🔗 Проверка Git...

git rev-parse --git-dir >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Git репозиторий
    set /a pass+=1
    
    git config --get remote.origin.url >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Удаленный репозиторий
        set /a pass+=1
    ) else (
        echo ⚠️ Удаленный репозиторий не настроен
        set /a fail+=1
    )
) else (
    echo ⚠️ Git репозиторий не инициализирован
    set /a fail+=1
)

echo.
echo ════════════════════════════════════════
echo 📊 РЕЗУЛЬТАТЫ:
echo    ✅ Успешно: !pass!
echo    ❌ Ошибок: !fail!
echo ════════════════════════════════════════
echo.

if !fail! EQU 0 (
    echo 🎉 Все готово к деплойменту!
    echo.
    echo 📖 Следующие шаги:
    echo    1. Загрузьте код на GitHub
    echo    2. Откройте DEPLOY_5MIN.md для быстрого деплоймента
    echo    3. Или DEPLOYMENT_FULL_GUIDE.md для подробного гайда
) else (
    echo ❌ Есть проблемы. Исправьте их перед деплоймент
)

echo.
pause
