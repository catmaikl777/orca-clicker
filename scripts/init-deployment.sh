#!/bin/bash
# Скрипт для инициализации проекта перед деплоймент

echo "🚀 Инициализация проекта для деплоймента..."

# 1. Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"

# 2. Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

# 3. Проверка синтаксиса
echo "🔍 Проверка синтаксиса..."
node -c websocket-server.js
node -c server.js
node -c client.js

echo "✅ Все файлы корректны!"

# 4. Создание .env файла если его нет
if [ ! -f .env ]; then
    echo "📝 Создание .env файла..."
    cp .env.example .env
    echo "⚠️ Отредактируйте .env с вашими значениями"
fi

# 5. Инициализация git
if [ ! -d .git ]; then
    echo "📚 Инициализация Git репозитория..."
    git init
    git add .
    git commit -m "Initial commit: Orca Clicker with Account System"
fi

echo "✅ Проект готов к деплойменту!"
echo ""
echo "📖 Дальнейшие шаги:"
echo "   1. Задеплоить бэкенд на Render: ./scripts/deploy-render.sh"
echo "   2. Задеплоить фронтенд на Vercel: ./scripts/deploy-vercel.sh"
