# 📸 ПОШАГОВЫЙ ГАЙД С КАРТИНКАМИ

## ЧАСТЬ 1: RENDER (Бэкенд)

### Шаг 1: Регистрация на Render

**Адрес:** https://render.com

1. Нажать **"Get Started"** (или "Sign Up")
2. Выбрать **"Continue with GitHub"**
3. Авторизоваться в GitHub
4. Разрешить доступ к репозиториям

```
┌─────────────────────────────┐
│  RENDER.COM                 │
├─────────────────────────────┤
│ 🔘 Continue with GitHub     │
│ 🔘 Email                    │
└─────────────────────────────┘
```

### Шаг 2: Создать Web Service

1. На главной странице нажать **"New +"**
2. Выбрать **"Web Service"**

```
┌─────────────────────────────┐
│ New +                       │
├─────────────────────────────┤
│ 📱 Static Site              │
│ 🔧 Web Service       ← ЗДЕСЬ│
│ 🗄️ PostgreSQL              │
│ 📧 Email Service            │
└─────────────────────────────┘
```

### Шаг 3: Выбрать репозиторий

1. Нажать **"Connect account"** если нужно
2. Найти репозиторий `orca-clicker`
3. Нажать **"Connect"**

```
Поиск: orca-clicker
┌──────────────────────────────┐
│ ✓ orca-clicker               │
│   YOUR_USERNAME/orca-clicker │
│   [Connect]                  │
└──────────────────────────────┘
```

### Шаг 4: Заполнить информацию о сервисе

| Поле | Введите |
|------|---------|
| **Name** | `orca-clicker-api` |
| **Root Directory** | `./` (оставить как есть) |
| **Runtime** | `Node` |
| **Branch** | `main` |
| **Build Command** | `npm install` |
| **Start Command** | `node websocket-server.js` |

```
┌────────────────────────────────┐
│ Name: orca-clicker-api         │
│ Root Directory: ./             │
│ Runtime: Node ▼               │
│ Branch: main ▼                │
│ Build: npm install             │
│ Start: node websocket-server.js│
└────────────────────────────────┘
```

### Шаг 5: Добавить переменные окружения

1. Прокрутить вниз до **"Advanced"**
2. Нажать **"Add Environment Variable"**
3. Добавить:

```
NODE_ENV = production
PORT = 3001
```

```
┌─────────────────────────────┐
│ Advanced                    │
│                             │
│ Environment Variables:      │
│ ┌───────────────────────┐   │
│ │ NODE_ENV│ production │   │
│ └───────────────────────┘   │
│ [+ Add]                     │
└─────────────────────────────┘
```

### Шаг 6: Выбрать тарифный план

1. Выбрать **"Starter"** ($7/мес) ⭐
   - ИЛИ "Free" если хотите экономить (но сервер будет спать)
2. Нажать **"Deploy"**

```
┌─────────────────┐
│ Free    ✓       │ (спит после 15 мин)
│ Starter ✓✓✓     │ ($7/мес - РЕКОМЕНДУЕТСЯ)
│ Standard ✓✓✓✓   │ ($12/мес)
│                 │
│ [Deploy]        │
└─────────────────┘
```

### ✅ Render развертывается!

**Ждите 2-3 минуты...**

```
📡 Building...
⏳ Installing dependencies...
✅ Build complete!
🚀 Deploying...
✅ Deployment successful!
```

**Получен URL:** 
```
https://orca-clicker-api.onrender.com
```

⚠️ **СКОПИРУЙТЕ ЭТОТ URL!** Он нужен для фронтенда!

---

## ЧАСТЬ 2: VERCEL (Фронтенд)

### Шаг 1: Обновить client.js

**Найти строку ~91:**

```javascript
// БЫЛО:
const WS_SERVER_URL = window.location.hostname === 'localhost' 
  ? `ws://localhost:3001`
  : `wss://${window.location.host}`;

// ИЗМЕНИТЬ НА:
const WS_SERVER_URL = window.location.hostname === 'localhost' 
  ? `ws://localhost:3001`
  : `wss://orca-clicker-api.onrender.com`; // ← ВАШ URL ИЗ RENDER
```

⚠️ **Замените на свой реальный URL от Render!**

### Шаг 2: Запушить изменения в GitHub

```bash
git add client.js
git commit -m "Update WebSocket URL for production"
git push origin main
```

### Шаг 3: Регистрация на Vercel

**Адрес:** https://vercel.com

1. Нажать **"Sign Up"**
2. Выбрать **"Continue with GitHub"**
3. Авторизоваться в GitHub
4. Разрешить доступ

```
┌─────────────────────────────┐
│  VERCEL.COM                 │
├─────────────────────────────┤
│ 🔘 GitHub                   │
│ 🔘 GitLab                   │
│ 🔘 Bitbucket                │
└─────────────────────────────┘
```

### Шаг 4: Создать проект

1. На главной странице нажать **"Add New..."**
2. Выбрать **"Project"**

```
┌──────────────────────┐
│ Add New...           │
├──────────────────────┤
│ 📁 Project           │ ← ЗДЕСЬ
│ 📚 Organization      │
│ 🔀 Team              │
└──────────────────────┘
```

### Шаг 5: Импортировать репозиторий

1. Найти `orca-clicker` в списке
2. Нажать **"Import"**

```
Поиск: orca-clicker
┌──────────────────────────────┐
│ 📦 orca-clicker              │
│    YOUR_USERNAME/orca-clicker│
│    [Import] ← ЗДЕСЬ          │
└──────────────────────────────┘
```

### Шаг 6: Настроить проект

| Поле | Значение |
|------|----------|
| **Project Name** | `orca-clicker` |
| **Framework Preset** | `Other` |
| **Root Directory** | `./` |
| **Build Command** | (оставить пусто) |
| **Output Directory** | (оставить пусто) |

```
┌─────────────────────────────┐
│ Project Name: orca-clicker  │
│ Framework: Other ▼         │
│ Root: ./                    │
│ Build Command: (пусто)      │
│ Output Dir: (пусто)         │
│                             │
│ [Deploy]                    │
└─────────────────────────────┘
```

### Шаг 7: Развернуть

Нажать **"Deploy"** и ждать...

```
🔨 Building...
⏳ Analyzing source code...
✅ Build complete!
🚀 Deploying...
✅ Production Ready!
```

**Получен URL:**
```
https://orca-clicker.vercel.app
```

---

## ✅ ПРОВЕРКА РАБОТЫ

### 1. Открить сайт

```
https://orca-clicker.vercel.app
```

Должны видеть экран входа с логотипом косатки.

### 2. Создать аккаунт

1. Нажать **"Регистрация"**
2. Ввести:
   - Username: `test`
   - Password: `test123`
   - Confirm: `test123`
3. Нажать **"Зарегистрироваться"**

```
┌──────────────────────────┐
│ 🐋 КОСАТКА КЛИК          │
├──────────────────────────┤
│ Username: test           │
│ Password: ****           │
│ Confirm:  ****           │
│                          │
│ [Зарегистрироваться]     │
└──────────────────────────┘
```

### 3. Поиграть

1. Нажать на косатку 5-10 раз
2. Записать количество монет: **500**

```
💰 Coins: 500
⭐ Total: 500
```

### 4. Перезагрузить (F5)

1. Нажать **F5** (или Ctrl+R)
2. Должен попросить пароль
3. Ввести пароль: `test123`
4. Нажать **"Войти"**

```
┌──────────────────────────┐
│ 🐋 КОСАТКА КЛИК          │
├──────────────────────────┤
│ Username: test           │
│ Password: ****           │
│                          │
│ [Войти]                  │
└──────────────────────────┘
```

### 5. ✅ РЕЗУЛЬТАТ

Если видите **500 монет** - ВСЕ РАБОТАЕТ! 🎉

```
💰 Coins: 500      ← Монеты сохранились!
⭐ Total: 500
```

---

## 🔍 ПРОВЕРКА ЛОГОВ

### Если не работает - смотреть логи на Render

1. Перейти на https://render.com
2. Выбрать Web Service
3. Нажать на вкладку **"Logs"**
4. Ищите ошибки типа:
   ```
   ❌ Error: Cannot find module 'ws'
   ❌ TypeError: handleRegister is not a function
   ```

**Решение:** Перезагрузить сервер
```
Web Service → Manual Deploy → Deploy latest commit
```

### Если медленно грузится - Free план

```
⚠️ Render is spinning up this service...
```

**Решение:** Обновить на Starter ($7/мес)

---

## 💡 СОВЕТЫ

### 1. Сделать prettier URL на Render

По умолчанию: `https://orca-clicker-api-abc123.onrender.com`

Хотим: `https://orca-clicker-api.onrender.com`

**Как изменить:**
1. Web Service Settings
2. Изменить "Name" на `orca-clicker-api`
3. Сохранить

⚠️ URL изменится через 1-2 часа!

### 2. Добавить favicon

1. Создать `favicon.ico`
2. Положить в корневую папку
3. Запушить на GitHub
4. Redeploy на Vercel

### 3. Добавить meta tags для SEO

В `index.html`:
```html
<meta name="description" content="🐋 Orca Clicker - Play and earn coins!">
<meta name="og:image" content="https://orca-clicker.vercel.app/icon.png">
```

---

## 🎉 ГОТОВО!

**Ваша игра теперь в интернете!**

📍 **Ссылка для игроков:**
```
https://orca-clicker.vercel.app
```

📲 **Делитесь:**
- ВКонтакте
- Telegram
- Discord
- WhatsApp

**Друзья смогут создавать аккаунты и сохранять прогресс!** 🎮

---

## 🆘 FAQ

**В: Что если я забыл URL Render?**
А: Откройте Render dashboard → Web Service → скопируйте URL

**В: Как изменить WebSocket URL?**
А: Обновить client.js → запушить на GitHub → Vercel переразвернет автоматически

**В: Можно ли использовать Free Render?**
А: Да, но сервер будет спать через 15 мин. За $7/мес сервер всегда включен.

**В: Что если ничего не работает?**
А: Смотреть Render Logs и Vercel Deployments → искать ошибки

**В: Как откатиться?**
А: На Vercel → Deployments → выбрать старую версию → Promote to Production
