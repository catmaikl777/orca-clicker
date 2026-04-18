# ⚡ ДЕПЛОЙМЕНТ за 5 МИНУТ

## 🚀 Очень быстро

### Минута 1: GitHub

```bash
git init
git add .
git commit -m "Initial"
# Загрузьте код на GitHub
```

### Минута 2: Render (Бэкенд)

1. https://render.com → Sign up with GitHub
2. New → Web Service
3. Выберите репо
4. Name: `orca-clicker-api`
5. Start: `node websocket-server.js`
6. Add ENV: `NODE_ENV=production`
7. Deploy

**Копируйте URL:** `https://orca-clicker-api.onrender.com`

### Минута 3: Vercel (Фронтенд)

1. https://vercel.com → Sign up with GitHub
2. Add New → Project
3. Выберите репо
4. Deploy
5. После deploy → Settings → Environment Variables
6. Add: `VITE_WS_URL=wss://orca-clicker-api.onrender.com`
7. Redeploy

### Минута 4: Финиш

Вернитесь на Render:
- Settings → Environment Variables
- Add: `FRONTEND_URL=https://orca-clicker.vercel.app`

### Минута 5: Тест

1. Откройте https://orca-clicker.vercel.app
2. Создайте аккаунт
3. Поиграйте (накопите монеты)
4. Нажмите F5
5. ✅ Войдите и проверьте прогресс

---

## 🎯 Готово!

Ваша игра теперь в интернете! 🎉

**Ссылки:**
- 🎮 Игра: https://orca-clicker.vercel.app
- 🔧 Бэкенд: https://orca-clicker-api.onrender.com
- 📊 Управление: Render Dashboard и Vercel Dashboard

---

## ⚠️ Важно!

- Render спит после 15 минут неактивности (первый запрос медленный)
- Оба сервиса автоматически обновляют при push в GitHub
- Убедитесь что .env не в гите (в .gitignore)

---

**Для подробного гайда:** DEPLOYMENT_FULL_GUIDE.md
