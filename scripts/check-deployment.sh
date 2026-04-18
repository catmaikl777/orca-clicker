#!/bin/bash
# Скрипт для проверки готовности к деплойменту

echo "🔍 Проверка готовности к деплойменту..."
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Счетчики
pass=0
fail=0

# Функция для проверки
check() {
  local name=$1
  local cmd=$2
  
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} $name"
    ((pass++))
  else
    echo -e "${RED}❌${NC} $name"
    ((fail++))
  fi
}

echo "📋 Проверка зависимостей..."
check "Node.js" "node --version"
check "npm" "npm --version"
check "git" "git --version"

echo ""
echo "📂 Проверка файлов..."
check "package.json" "test -f package.json"
check "websocket-server.js" "test -f websocket-server.js"
check "server.js" "test -f server.js"
check "client.js" "test -f client.js"
check "index.html" "test -f index.html"
check "auth.js" "test -f auth.js"
check ".gitignore" "test -f .gitignore"

echo ""
echo "🔧 Проверка конфигурации..."
check "vercel.json" "test -f vercel.json"
check "render.yaml" "test -f render.yaml"
check ".env.example" "test -f .env.example"

echo ""
echo "💾 Проверка node_modules..."
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✅${NC} node_modules установлен"
  ((pass++))
else
  echo -e "${YELLOW}⚠️${NC} node_modules не найден (запустите: npm install)"
  ((fail++))
fi

echo ""
echo "✨ Проверка синтаксиса..."
check "websocket-server.js синтаксис" "node -c websocket-server.js"
check "server.js синтаксис" "node -c server.js"
check "client.js синтаксис" "node -c client.js"

echo ""
echo "🔗 Проверка Git..."
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC} Git репозиторий инициализирован"
  ((pass++))
  
  # Проверка удаленного репозитория
  if git config --get remote.origin.url > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} Удаленный репозиторий настроен"
    ((pass++))
  else
    echo -e "${YELLOW}⚠️${NC} Удаленный репозиторий не настроен"
    ((fail++))
  fi
else
  echo -e "${YELLOW}⚠️${NC} Git репозиторий не инициализирован"
  echo "   Решение: git init && git add . && git commit -m 'Initial'"
  ((fail++))
fi

echo ""
echo "════════════════════════════════════════"
echo "📊 РЕЗУЛЬТАТЫ:"
echo -e "   ${GREEN}✅ Успешно:${NC} $pass"
echo -e "   ${RED}❌ Ошибок:${NC} $fail"
echo "════════════════════════════════════════"

if [ $fail -eq 0 ]; then
  echo -e "${GREEN}🎉 Все готово к деплойменту!${NC}"
  echo ""
  echo "📖 Следующие шаги:"
  echo "   1. Загрузьте код на GitHub"
  echo "   2. Откройте DEPLOY_5MIN.md для быстрого деплоймента"
  echo "   3. Или DEPLOYMENT_FULL_GUIDE.md для подробного гайда"
  exit 0
else
  echo -e "${RED}❌ Есть проблемы. Исправьте их перед деплоймент${NC}"
  exit 1
fi
