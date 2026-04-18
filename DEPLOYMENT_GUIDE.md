# 🚀 Деплоймент на Vercel и Render

## 🎯 Общая схема

```
┌─────────────────────┐          ┌─────────────────────┐
│   VERCEL            │          │   RENDER            │
│ (Фронтенд)          │  WSS     │ (Бэкенд)            │
│                     │◄────────►│                     │
│ - index.html        │          │ - websocket-server  │
│ - client.js         │          │ - server.js         │
│ - auth-client.js    │          │ - database.json     │
│ - style.css         │          │                     │
│ - ассеты            │          │ PostgreSQL (опция)  │
└─────────────────────┘          └─────────────────────┘
```

## 📋 Что нужно сделать

### Шаг 1️⃣: Подготовить проект
- [ ] Добавить .gitignore
- [ ] Обновить package.json
- [ ] Добавить переменные окружения (.env)
- [ ] Обновить WebSocket URL для продакшена

### Шаг 2️⃣: Задеплоить бэкенд на Render
- [ ] Создать аккаунт на Render.com
- [ ] Создать Web Service
- [ ] Привязать GitHub репозиторий
- [ ] Настроить переменные окружения

### Шаг 3️⃣: Задеплоить фронтенд на Vercel
- [ ] Создать аккаунт на Vercel.com
- [ ] Создать проект из GitHub
- [ ] Добавить переменные окружения (WebSocket URL)
- [ ] Развернуть

---

## 📦 ШАГ 1: Подготовить проект

### 1.1 Создать .gitignore

```bash
echo "node_modules/" > .gitignore
echo "*.env" >> .gitignore
echo "*.env.local" >> .gitignore
echo ".DS_Store" >> .gitignore
echo "database.json.bak" >> .gitignore
```

**Содержание .gitignore:**
```
node_modules/
.env
.env.local
.env.*.local
dist/
build/
*.log
.DS_Store
database.json.bak
```

### 1.2 Обновить package.json

**Текущее содержимое должно быть примерно так:**

```json
{
  "name": "orca-clicker",
  "version": "2.0.0",
  "description": "Orca clicker game with accounts",
  "main": "websocket-server.js",
  "scripts": {
    "start": "node websocket-server.js",
    "server": "node server.js",
    "dev": "node websocket-server.js & node server.js",
    "test": "node -c *.js"
  },
  "dependencies": {
    "ws": "^8.13.0",
    "bcryptjs": "^2.4.3"
  },
  "engines": {
    "node": "18.x"
  }
}
```

### 1.3 Создать .env файл (локально)

**Создайте файл .env в корневой папке:**

```bash
# Локальная разработка
NODE_ENV=development
WS_PORT=3001
HTTP_PORT=3000
DATABASE_URL=./database.json
```

### 1.4 Создать .env.production файл

**Для продакшена на Render:**

```bash
# Render.com production
NODE_ENV=production
WS_PORT=3001
HTTP_PORT=3001
DATABASE_URL=/tmp/database.json
```

### 1.5 Обновить websocket-server.js для переменных окружения

**Найти и обновить начало файла:**

```javascript
// ============================================
// WebSocket сервер для Кошка-косатка Кликер
// ============================================

require('dotenv').config();

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { handleRegister, createDefaultPlayer, generateId } = require('./auth');

// Конфигурация
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || process.env.WS_PORT || 3001;
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'database.json');

console.log(`🌍 Окружение: ${NODE_ENV}`);
console.log(`📁 База данных: ${DB_PATH}`);
```

### 1.6 Установить dotenv

```bash
npm install dotenv bcryptjs
```

### 1.7 Обновить password hashing в auth.js

**Вместо Base64 используем bcrypt:**

```javascript
const bcrypt = require('bcryptjs');

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}
```

---

## 🟣 ШАГ 2: Задеплоить бэкенд на Render

### 2.1 Создать GitHub репозиторий

```bash
git init
git add .
git commit -m "Initial commit: Account system ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/orca-clicker.git
git push -u origin main
```

### 2.2 Регистрация на Render

1. Перейти на https://render.com
2. Нажать "Sign up"
3. Зарегистрироваться через GitHub (рекомендуется)

### 2.3 Создать Web Service

1. На Render dashboard → "New +" → "Web Service"
2. Выбрать GitHub репозиторий
3. Заполнить настройки:

**Настройки Web Service:**

| Поле | Значение |
|------|----------|
| Name | `orca-clicker-api` |
| Runtime | `Node` |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `node websocket-server.js` |
| Plan | `Free` (или `Starter` за $7/мес) |

### 2.4 Добавить переменные окружения

1. В Web Service → "Environment"
2. Добавить переменные:

```
NODE_ENV=production
DATABASE_URL=/tmp/database.json
```

### 2.5 Развернуть

1. Нажать "Deploy"
2. Ждать ~2-3 минуты
3. Получить URL типа: `https://orca-clicker-api.onrender.com`

**Важно!** Скопируйте этот URL - он нужен для фронтенда.

---

## 🔵 ШАГ 3: Задеплоить фронтенд на Vercel

### 3.1 Подготовить фронтенд

Нужно обновить WebSocket URL в client.js для Vercel:

**В client.js (около строки 91):**

```javascript
const WS_SERVER_URL = window.location.hostname === 'localhost' 
  ? `ws://localhost:3001`
  : `wss://orca-clicker-api.onrender.com`;
```

⚠️ **Замените `orca-clicker-api.onrender.com` на ваш реальный URL от Render!**

### 3.2 Создать vercel.json

Добавьте файл `vercel.json` в корневую папку:

```json
{
  "buildCommand": "",
  "outputDirectory": "",
  "framework": "static",
  "public": true
}
```

**Или더 простой вариант (просто скопируйте все в public):**

```json
{
  "version": 2,
  "static": {
    "public": {
      "headers": [
        {
          "source": "/(.*)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=3600"
            }
          ]
        }
      ]
    }
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

### 3.3 Регистрация на Vercel

1. Перейти на https://vercel.com
2. Нажать "Sign Up"
3. Зарегистрироваться через GitHub

### 3.4 Импортировать проект

1. На Vercel dashboard → "New Project"
2. Выбрать GitHub репозиторий
3. Нажать "Import"

### 3.5 Настроить проект

| Поле | Значение |
|------|----------|
| Project Name | `orca-clicker` |
| Framework Preset | `Other` |
| Root Directory | `./` |
| Build Command | (оставить пусто) |
| Output Directory | (оставить пусто) |
| Install Command | (оставить пусто) |

### 3.6 Добавить переменные окружения

В Vercel project settings → "Environment Variables":

```
NEXT_PUBLIC_WS_URL=wss://orca-clicker-api.onrender.com
```

⚠️ **Замените URL на ваш реальный URL от Render!**

### 3.7 Развернуть

1. Нажать "Deploy"
2. Ждать ~1-2 минуты
3. Получить URL: `https://orca-clicker.vercel.app`

---

## ✅ ПРОВЕРКА РАБОТЫ

### Проверить фронтенд
```
https://orca-clicker.vercel.app
```
Должны видеть игру с экраном входа.

### Проверить WebSocket подключение
1. Открыть DevTools (F12)
2. Перейти на вкладку Network → WS
3. Попытаться создать аккаунт
4. Должно появиться WebSocket соединение типа:
   ```
   wss://orca-clicker-api.onrender.com
   ```

### Проверить логи на Render
1. Render dashboard → Web Service → Logs
2. Должны видеть логи типа:
   ```
   ✅ Аутентификация успешна: username
   💾 Данные сохранены: accountId
   ```

---

## 🔒 БЕЗОПАСНОСТЬ ДЛЯ ПРОДАКШЕНА

### 1. Использовать HTTPS/WSS ✅ (автоматически на Vercel и Render)

### 2. Обновить bcrypt для хеширования ✅ (уже добавили)

### 3. Добавить CORS

**В websocket-server.js:**

```javascript
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://orca-clicker.vercel.app',
  credentials: true
}));
```

### 4. Добавить Rate Limiting

```bash
npm install express-rate-limit
```

**В server.js:**

```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток
  message: 'Слишком много попыток входа, попробуйте позже'
});

app.post('/login', loginLimiter, (req, res) => {
  // ...
});
```

### 5. Добавить переменные окружения

**На Render:**
```
NODE_ENV=production
JWT_SECRET=your-super-secret-key-here
DATABASE_PASSWORD=your-db-password
```

**На Vercel:**
```
NEXT_PUBLIC_WS_URL=wss://your-render-url
```

---

## 📊 БАЗОВАЯ ИНФОРМАЦИЯ ПО ЦЕНАМ

### Vercel (фронтенд)
- **Free:** ∞ запросов, 100 GB в месяц - ОТЛИЧНО ДЛЯ НАЧАЛА
- **Pro:** $20/мес, 1TB в месяц

### Render (бэкенд)
- **Free:** Останавливается через 15 мин неактивности 😴
- **Starter:** $7/мес, всегда включен ⭐ РЕКОМЕНДУЕТСЯ
- **Standard:** $12/мес, более мощный

⭐ **Совет:** Используйте Render Starter (~$7/мес), чтобы сервер всегда был включен.

---

## 🚨 ТИПИЧНЫЕ ПРОБЛЕМЫ

### ❌ "WebSocket соединение не работает"

**Причина:** Неправильный URL в client.js

**Решение:**
```javascript
// Проверить что это именно wss:// (secure), не ws://
const WS_SERVER_URL = `wss://orca-clicker-api.onrender.com`;
```

### ❌ "CORS ошибка"

**Причина:** Разные домены

**Решение:**
```javascript
// Добавить в websocket-server.js
app.use(cors({
  origin: 'https://orca-clicker.vercel.app'
}));
```

### ❌ "База данных потеряется"

**Причина:** /tmp папка очищается на Render

**Решение:** Использовать PostgreSQL (см. ниже)

### ❌ "Сервер медленный на Free плане"

**Причина:** Render Free останавливает сервер через 15 мин

**Решение:** Обновить на Starter ($7/мес)

---

## 🗄️ UPGRADE: Использовать PostgreSQL вместо JSON

### Для Render:

1. Создать PostgreSQL базу в Render
2. Добавить переменную:
   ```
   DATABASE_URL=postgresql://user:password@hostname/dbname
   ```
3. Установить пакет:
   ```bash
   npm install pg
   ```

---

## 📋 ЧЕКЛИСТ РАЗВЕРТЫВАНИЯ

- [ ] Создан GitHub репозиторий
- [ ] Добавлены переменные окружения
- [ ] Обновлен package.json
- [ ] Установлен bcrypt
- [ ] Обновлен WebSocket URL для продакшена
- [ ] Развернут бэкенд на Render
- [ ] Получен URL бэкенда
- [ ] Обновлен URL в client.js
- [ ] Развернут фронтенд на Vercel
- [ ] Получен URL фронтенда
- [ ] Проверено подключение
- [ ] Создан тестовый аккаунт
- [ ] Сохранение работает

---

## 🎉 ИТОГО

**Быстрый deployment:**
1. Запушить на GitHub
2. Создать Web Service на Render (5 мин)
3. Создать проект на Vercel (3 мин)
4. Обновить URL в коде (2 мин)

**Время:** ~20 минут ⏱️

**Стоимость:** 
- Vercel: БЕСПЛАТНО 🎉
- Render: $7/мес (Starter)

**Готово к боевому использованию! 🚀**
