# 🎮 Админка для Игры

Веб-интерфейс для управления данными игры в PostgreSQL.

## 🌐 Vercel Deployment

Админка доступна по URL:
```
https://orca-clicker.vercel.app/admin.html
```

## 🔧 Настройка

### 1. Добавьте переменные окружения в Vercel:

```
ADMIN_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://user:password@host:5432/database
```

### 2. Задеплойте проект

После деплоя откройте: `https://your-domain.vercel.app/admin.html`

## 💻 Локальная разработка

### Запуск обоих серверов:
```bash
npm run start-all
```

### Или отдельно:
```bash
# Игра на порту 3000
npm start

# Админка на порту 3002
npm run admin
```

### Локальный доступ:
```
Игра: http://localhost:3000
Админка: http://localhost:3002/admin.html
```

## 🔑 Пароль

По умолчанию: `admin123`

Обязательно смените в Production!

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/admin/players` | Список игроков |
| GET | `/api/admin/players/:id` | Данные игрока |
| PUT | `/api/admin/players/:id` | Обновить игрока |
| DELETE | `/api/admin/players/:id` | Удалить игрока |
| POST | `/api/admin/ban/:id` | Забанить |
| POST | `/api/admin/unban/:id` | Разбанить |
| GET | `/api/admin/stats` | Статистика |

## 📁 Структура файлов

```
├── admin-api.js          # API сервер админки
├── public/
│   └── admin.html        # Веб-интерфейс
└── middleware/
    └── database-adapter.js  # (уже есть) PostgreSQL адаптер
```

## 💡 Советы

- Регулярно делайте бэкапы БД перед массовыми правками
- Используйте поиск чтобы быстро найти игрока
- Массовые операции удобны для корректировки баланса
- Баньте с указанием причины для отладки
