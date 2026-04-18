# 📇 ШПАРГАЛКА: ДЕПЛОЙМЕНТ НА 1 СТРАНИЦЕ

## 🎯 ЭТАП 1: GitHub (1 мин)

```bash
git init
git add .
git commit -m "Initial"
# Загрузьте на GitHub
```

**Результат:** GitHub репо с вашим кодом

---

## 🎯 ЭТАП 2: Render (2 мин)

### Откройте: https://render.com

```
1. Sign Up → GitHub
2. New → Web Service
3. Select your repo
4. Name: orca-clicker-api
5. Build: npm install
6. Start: node websocket-server.js
7. Env:
   - NODE_ENV=production
   - PORT=3001
8. Deploy
```

**Результат:** `https://orca-clicker-api.onrender.com`

---

## 🎯 ЭТАП 3: Vercel (2 мин)

### Откройте: https://vercel.com

```
1. Sign Up → GitHub
2. Add New → Project
3. Select your repo
4. Deploy
5. After Deploy → Settings → Environment Variables
6. Add: VITE_WS_URL = wss://orca-clicker-api.onrender.com
7. Redeploy
```

**Результат:** `https://orca-clicker.vercel.app`

---

## 🎯 ЭТАП 4: Финиш (1 мин)

### Вернитесь на Render

```
Settings → Environment Variables
Add: FRONTEND_URL = https://orca-clicker.vercel.app
```

---

## ✅ ТЕСТ

```
1. Откройте https://orca-clicker.vercel.app
2. Создайте аккаунт
3. Поиграйте
4. F5 - обновите страницу
5. Войдите и проверьте прогресс ✅
```

---

## 🎉 ГОТОВО!

Ваша игра теперь в интернете! 🚀

---

## ⚠️ ВАЖНО

- Render спит после 15 мин (upgrade для continuous)
- При `git push` → автоматический деплоймент
- Все бесплатно (Render Free + Vercel Free)
- Первый запрос может быть медленным

---

## 🆘 ПРОБЛЕМЫ?

| Проблема | Решение |
|----------|---------|
| "Не подключается" | Проверьте VITE_WS_URL в Vercel |
| "WebSocket failed" | Используйте `wss://` (не `ws://`) |
| "Данные не сохраняются" | Проверьте логи Render |
| "Первый запрос медленный" | Это нормально (Render спит) |

---

## 📞 ДОКУМЕНТАЦИЯ

- 🏃 5 мин: **DEPLOY_5MIN.md**
- 📖 30 мин: **DEPLOYMENT_FULL_GUIDE.md**
- 📚 Индекс: **DEPLOYMENT_INDEX.md**

---

**Распечатайте эту страницу!** 📋
