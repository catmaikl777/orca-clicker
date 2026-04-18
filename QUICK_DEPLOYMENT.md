# 🚀 БЫСТРЫЙ DEPLOYMENT (15 МИНУТ)

## Вариант 1: Без базы данных (JSON - самый быстрый)

### ⚡ БЭКЕНД НА RENDER (5 мин)

**Шаг 1: Подготовить проект**
```bash
# В корневой папке создать .env
echo "NODE_ENV=production" > .env
echo "PORT=3001" >> .env
```

**Шаг 2: Запушить на GitHub**
```bash
git init
git add .
git commit -m "Ready for deployment"
git push -u origin main
```

**Шаг 3: На Render.com**
1. Sign up → GitHub
2. New Web Service
3. Выбрать репозиторий
4. **Start Command:** `node websocket-server.js`
5. **Build Command:** `npm install`
6. Deploy

✅ **Получили URL:** `https://orca-clicker-api.onrender.com`

---

### ⚡ ФРОНТЕНД НА VERCEL (3 мин)

**Шаг 1: Обновить client.js**

Найти строку ~91 с WS_SERVER_URL и заменить:

```javascript
// БЫЛО:
const WS_SERVER_URL = window.location.hostname === 'localhost' 
  ? `ws://localhost:3001`
  : `wss://${window.location.host}`;

// СТАЛО:
const WS_SERVER_URL = window.location.hostname === 'localhost' 
  ? `ws://localhost:3001`
  : `wss://orca-clicker-api.onrender.com`; // ← ВАША ССЫЛКА ИЗ RENDER
```

**Шаг 2: Запушить изменения**
```bash
git add client.js
git commit -m "Update WebSocket URL for production"
git push
```

**Шаг 3: На Vercel.com**
1. Sign up → GitHub
2. Import Project
3. Выбрать репозиторий
4. Deploy

✅ **Получили URL:** `https://orca-clicker.vercel.app`

---

### ✅ ПРОВЕРКА

Откройте: https://orca-clicker.vercel.app

1. Создайте аккаунт
2. Поиграйте
3. Нажмите F5
4. Войдите заново
5. **Монеты остались?** ✅ РАБОТАЕТ!

---

## Вариант 2: С PostgreSQL базой данных (для продакшена)

### 🗄️ СОЗДАТЬ БАЗУ ДАННЫХ НА RENDER

1. Render dashboard → PostgreSQL
2. Create New
3. Получить DATABASE_URL

Выглядит так:
```
postgresql://username:password@hostname.renderdb.internal/dbname
```

### 📦 УСТАНОВИТЬ POSTGRESQL ДРАЙВЕР

```bash
npm install pg
```

### 📝 ОБНОВИТЬ websocket-server.js

Заменить часть загрузки БД:

```javascript
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/orca_clicker'
});

async function loadDB() {
  try {
    await client.connect();
    const result = await client.query('SELECT data FROM game_data LIMIT 1');
    if (result.rows.length > 0) {
      return JSON.parse(result.rows[0].data);
    }
  } catch (e) {
    console.error('Ошибка БД:', e.message);
  }
  return { accounts: {}, players: {}, ... };
}

async function saveDB() {
  try {
    await client.query(
      'INSERT INTO game_data (data) VALUES ($1) ON CONFLICT (id) DO UPDATE SET data = $1',
      [JSON.stringify(db)]
    );
  } catch (e) {
    console.error('Ошибка сохранения:', e.message);
  }
}
```

### 🔑 ДОБАВИТЬ ПЕРЕМЕННУЮ НА RENDER

1. Web Service Settings → Environment
2. Добавить:
   ```
   DATABASE_URL=postgresql://username:password@hostname/dbname
   ```

---

## 🔓 БЕЗОПАСНОСТЬ - КРИТИЧНО ДЛЯ ПРОДАКШЕНА

### 1️⃣ ОБНОВИТЬ BCRYPT В auth.js

**Вместо:**
```javascript
function hashPassword(password) {
  return Buffer.from(password + 'orca_clicker_salt_2024').toString('base64');
}
```

**Написать:**
```javascript
const bcrypt = require('bcryptjs');

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}
```

### 2️⃣ УСТАНОВИТЬ BCRYPT

```bash
npm install bcryptjs
```

### 3️⃣ ДОБАВИТЬ CORS

**В websocket-server.js:**
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'https://orca-clicker.vercel.app',
  credentials: true
}));
```

### 4️⃣ RATE LIMITING

```bash
npm install express-rate-limit
```

---

## 📊 МОНИТОРИНГ

### На Render

**Logs:** Web Service → Logs
- Видны все ошибки и логи сервера

**Metrics:** Web Service → Metrics
- CPU, память, запросы

### На Vercel

**Deployments:** Project → Deployments
- История развертываний
- Откаты если нужно

---

## 🆘 ЕСЛИ НИЧЕГО НЕ РАБОТАЕТ

### Проблема: "WebSocket не подключается"

```bash
# Проверить Render логи
# Должны видеть: "WebSocket сервер запущен на порту 3001"

# Если ошибка - в терминале Render:
node -c websocket-server.js
```

### Проблема: "Аутентификация не работает"

```bash
# Проверить что bcrypt установлен
npm list bcryptjs

# Перезагрузить сервер на Render
```

### Проблема: "База не сохраняется"

```bash
# На Render Free сервер останавливается через 15 мин
# Решение: обновить на Starter ($7/мес)
# Или использовать PostgreSQL
```

---

## 💰 СТОИМОСТЬ

| Сервис | План | Цена | Ограничения |
|--------|------|------|-----------|
| Vercel | Free | $0 | ∞ запросов |
| Render | Free | $0 | ❌ Останавливается |
| Render | Starter | $7/мес | ✅ Всегда включен |
| Total | | **$7/мес** | |

**Экономный вариант:**
- Vercel Free ($0)
- Render Starter ($7/мес)
- PostgreSQL (бесплатный на Render)

**Итого: $7 в месяц для полного production сервера!** 🎉

---

## ✅ FINAL CHECKLIST

### Перед deployment:
- [ ] `npm install` (все зависимости установлены)
- [ ] `.env` файл создан (локально)
- [ ] `package.json` обновлен
- [ ] `client.js` обновлен с правильным WebSocket URL
- [ ] `.gitignore` содержит `node_modules` и `.env`

### После создания сервера Render:
- [ ] Скопирован URL (вида `https://xxx.onrender.com`)
- [ ] Обновлен URL в `client.js`
- [ ] Запушены изменения в GitHub

### После создания проекта Vercel:
- [ ] Фронтенд успешно развернут
- [ ] Получен URL (вида `https://xxx.vercel.app`)

### Финальная проверка:
- [ ] Открыт сайт - видна игра ✅
- [ ] Создан тестовый аккаунт ✅
- [ ] Данные сохраняются после F5 ✅

---

## 🎉 ВСЕ ГОТОВО!

Ваша игра теперь в сети и доступна 24/7! 🚀

**Фронтенд:** https://orca-clicker.vercel.app  
**Бэкенд:** https://orca-clicker-api.onrender.com  
**Стоимость:** $7/мес (только Render Starter)

**Делитесь ссылкой с друзьями!** 👫👫👫
