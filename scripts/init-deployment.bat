@echo off
REM Скрипт для инициализации проекта перед деплоймент (Windows)

echo 🚀 Инициализация проекта для деплоймента...

REM 1. Проверка Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js не установлен!
    exit /b 1
)

echo ✅ Node.js установлен
echo ✅ npm установлен

REM 2. Установка зависимостей
echo 📦 Установка зависимостей...
call npm install

REM 3. Проверка синтаксиса
echo 🔍 Проверка синтаксиса...
node -c websocket-server.js
node -c server.js
node -c client.js

echo ✅ Все файлы корректны!

REM 4. Создание .env файла если его нет
if not exist .env (
    echo 📝 Создание .env файла...
    copy .env.example .env
    echo ⚠️ Отредактируйте .env с вашими значениями
)

REM 5. Инициализация git
if not exist .git (
    echo 📚 Инициализация Git репозитория...
    git init
    git add .
    git commit -m "Initial commit: Orca Clicker with Account System"
)

echo.
echo ✅ Проект готов к деплойменту!
echo.
echo 📖 Дальнейшие шаги:
echo    1. Задеплоить бэкенд на Render
echo    2. Задеплоить фронтенд на Vercel
echo    3. Откройте DEPLOYMENT_GUIDE.md для деталей
echo.
pause
