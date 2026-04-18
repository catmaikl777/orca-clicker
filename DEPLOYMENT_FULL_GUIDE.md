# 🚀 ПОЛНЫЙ ГАЙД ПО ДЕПЛОЙМЕНТУ НА VERCEL И RENDER

## 📌 Общая архитектура

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│      VERCEL                 │         │      RENDER              │
│   (Фронтенд)                │  WSS    │   (Бэкенд)               │
│                             │◄───────►│                          │
│ • index.html                │         │ • WebSocket Server       │
│ • auth-client.js            │         │ • API routes             │
│ • client.js                 │         │ • Database (JSON)        │
│ • style.css                 │         │                          │
│ • Изображения и звуки       │         │ wss://render-app.com     │
│                             │         │                          │
│ https://vercel-app.app      │         │ Porт: 3001               │
└─────────────────────────────┘         └──────────────────────────┘
```

---

## ⚡ Быстрый старт (5 минут)

### Шаг 1: Инициализация (1 минута)

**На Windows:**
```bash
scripts\init-deployment.bat
```

**На Mac/Linux:**
```bash
chmod +x scripts/init-deployment.sh
./scripts/init-deployment.sh
```

### Шаг 2: Деплоймент на Render (2 минуты)

Откройте: https://render.com → New → Web Service

```
Name:              orca-clicker-api
Environment:       Node
Region:            любой
Build Command:     npm install
Start Command:     node websocket-server.js
Instance Type:     Free (бесплатно)

Environment Variables:
  NODE_ENV = production
  FRONTEND_URL = (добавьте позже)
```

**Результат:** `https://orca-clicker-api.onrender.com`

### Шаг 3: Деплоймент на Vercel (2 минуты)

Откройте: https://vercel.com → Add New Project → Import Git Repo

```
Framework:         Other
Root Directory:     ./

Environment Variables:
  VITE_WS_URL = wss://orca-clicker-api.onrender.com
```

**Результат:** `https://orca-clicker.vercel.app`

---

## 📖 ПОЛНЫЙ ГАЙД

### ШАГ 1: Подготовка проекта

#### 1.1 Установите Git

**Windows:**
```bash
# Скачайте с https://git-scm.com
# Или через Chocolatey:
choco install git
```

**Mac:**
```bash
brew install git
```

**Linux:**
```bash
sudo apt install git
```

#### 1.2 Инициализируйте репозиторий

```bash
cd "c:\Users\kotma\OneDrive\Рабочий стол\Новая папка (4)"

git init


git config user.email "your@email.com"
git add .
git commit -m "Initial commit: Orca Clicker with Account System"
```

#### 1.3 Создайте аккаунт на GitHub

1. Откройте https://github.com/signup
2. Создайте аккаунт (если нет)
3. Создайте новый репозиторий (названи: `orca-clicker`)
4. Следуйте инструкциям для загрузки локального кода

```bash
git remote add origin https://github.com/YOUR_USERNAME/orca-clicker.git
git branch -M main
git push -u origin main
```

---

### ШАГ 2: Деплоймент БЭКЭНДа на Render

#### 2.1 Создайте аккаунт на Render

1. Откройте https://render.com
2. Нажмите "Sign Up"
3. Выберите "GitHub" для быстрой регистрации
4. Авторизуйте доступ к вашему GitHub

#### 2.2 Создайте Web Service

```
Render Dashboard → New → Web Service
```

**Настройки:**

| Параметр | Значение |
|----------|----------|
| **Repository** | Выберите `orca-clicker` |
| **Branch** | `main` |
| **Name** | `orca-clicker-api` |
| **Environment** | `Node` |
| **Region** | `Singapore` (или ближайший) |
| **Build Command** | `npm install` |
| **Start Command** | `node websocket-server.js` |
| **Instance Type** | `Free` |

#### 2.3 Добавьте переменные окружения

```
Environment → Add Environment Variable
```

```
NODE_ENV = production
PORT = 3001
FRONTEND_URL = (добавим после деплоймента Vercel)
```

#### 2.4 Нажмите "Create Web Service"

⏳ **Ожидание деплоймента: 1-2 минуты**

**Проверка работы:**
```bash
# Проверьте в браузере:
https://orca-clicker-api.onrender.com/health
```

Ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "players": 0
}
```

---

### ШАГ 3: Деплоймент ФРОНТЭНДа на Vercel

#### 3.1 Создайте аккаунт на Vercel

1. Откройте https://vercel.com
2. Нажмите "Sign Up"
3. Выберите "Continue with GitHub"
4. Авторизуйте доступ

#### 3.2 Импортируйте проект

```
Dashboard → Add New → Project
```

**Выберите:** `orca-clicker` репозиторий

#### 3.3 Настройте проект

```
Project Name:       orca-clicker
Framework Preset:   Other
Root Directory:     ./
Build Command:      (оставьте пусто)
Output Directory:   (оставьте пусто)
Install Command:    npm install
```

**Важно:** Environment переменные устанавливаются в следующем шаге в dashboard, не в vercel.json!

#### 3.4 Добавьте переменные окружения

```
Environment Variables → Add New
```

```
VITE_WS_URL = wss://orca-clicker-api.onrender.com
```

(Замените `orca-clicker-api` на ваше имя сервиса с Render)

#### 3.5 Нажмите "Deploy"

⏳ **Ожидание деплоймента: 2-3 минуты**

---

### ШАГ 4: Финальная настройка

#### 4.1 Обновите FRONTEND_URL на Render

1. Откройте Render Dashboard
2. Выберите `orca-clicker-api`
3. Перейдите в "Environment"
4. Обновите:

```
FRONTEND_URL = https://orca-clicker.vercel.app
```

(Замените на ваш URL с Vercel)

#### 4.2 Проверьте работу

```
https://orca-clicker.vercel.app
```

1. ✅ Откроется ваша игра
2. ✅ Создайте новый аккаунт
3. ✅ Поиграйте (накопите монеты)
4. ✅ Обновите страницу (F5)
5. ✅ Вход и проверьте что прогресс сохранился

---

## 🔧 Переменные окружения

### На Render (.env)

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://orca-clicker.vercel.app
```

### На Vercel

```
VITE_WS_URL=wss://orca-clicker-api.onrender.com
```

---

## ⚙️ Обновление после деплоймента

### Для обновления кода

1. **Внесите изменения** в локальный код
2. **Commit и push:**
   ```bash
   git add .
   git commit -m "Описание изменений"
   git push origin main
   ```
3. **Автоматический деплоймент:** Render и Vercel автоматически пересоберут проект

---

## 🔒 Безопасность и оптимизация

### Для production потребуется:

- [ ] **bcrypt вместо Base64** (для пароля)
- [ ] **HTTPS сертификаты** (автоматически на Render/Vercel)
- [ ] **Database.json → PostgreSQL** (бесплатно на Render)
- [ ] **Rate limiting** (защита от DDoS)
- [ ] **Backup стратегия** (автоматические бэкапы)
- [ ] **Monitoring** (Render предоставляет)

### Быстрая оптимизация:

```javascript
// В websocket-server.js - добавить rate limiting
const RateLimit = require('express-rate-limit');

const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // лимит 100 запросов за период
});
```

---

## 🆘 Решение проблем

### "Connection refused" / "Не подключается к серверу"

**Решение:**
1. Проверьте что Render сервис работает:
   ```bash
   https://orca-clicker-api.onrender.com/health
   ```
2. Проверьте VITE_WS_URL в Vercel переменных
3. Проверьте FRONTEND_URL в Render переменных

### "WebSocket connection failed"

**Решение:**
1. Убедитесь что используется `wss://` (не `ws://`)
2. Проверьте что домен правильный
3. Очистите кэш браузера (Ctrl+Shift+Delete)

### "Данные не сохраняются"

**Решение:**
1. Проверьте что сохраняется на Render (logs)
2. Убедитесь что database.json записывается
3. Проверьте права доступа файлов

### Render сервис "спит" (first request slow)

**Это нормально!** Render бесплатный сервис спит после 15 минут неактивности.

Решение: Используйте платный план ($7/месяц) для continuous running.

---

## 📊 Мониторинг

### Render Dashboard

```
Logs → Посмотрите логи вашего приложения
Metrics → Здоровье приложения
```

### Vercel Dashboard

```
Deployments → История деплоймента
Analytics → Статистика использования
```

---

## 🎯 Финальный чек-лист

- [ ] Git репозиторий создан и code pushed
- [ ] Render аккаунт создан
- [ ] Render Web Service создан
- [ ] WebSocket сервер работает (health check OK)
- [ ] Vercel аккаунт создан
- [ ] Vercel проект создан
- [ ] Фронтенд вкладывается без ошибок
- [ ] VITE_WS_URL переменная установлена
- [ ] Игра доступна по URL
- [ ] Регистрация работает
- [ ] Прогресс сохраняется и восстанавливается
- [ ] Обновление страницы (F5) не теряет данные

---

## 💡 Советы

1. **Используйте Render + Vercel комбинацию:**
   - Vercel отличен для статических файлов и фронтенда
   - Render отличен для WebSocket и бэкенда

2. **Для продакшена:**
   - Upgrade на платные планы для лучшей production
   - Добавьте PostgreSQL на Render
   - Включите мониторинг и алерты

3. **Автоматизация:**
   - Используйте GitHub Actions для CI/CD
   - Автоматические тесты перед деплоймент
   - Автоматические бэкапы database.json

---

## 📞 Полезные ссылки

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **WebSocket:** https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **Environment Variables:** https://12factor.net/config

---

**Статус:** ✅ Готово к деплойменту  
**Дата:** April 18, 2026  
**Версия:** 2.0
