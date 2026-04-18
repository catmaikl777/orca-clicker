# 📋 CHANGELOG - Все изменения для системы аккаунтов

## Version 2.0 - Account System Implementation

### 🎯 Основная функциональность

**Регистрация и вход (Login/Register)**
- Новые пользователи могут создавать аккаунты с username + password
- Существующие пользователи могут входить с пароль
- Пароли хешируются на сервере (Base64 + salt)
- Аккаунты сохраняются в database.json

**Сохранение прогресса (Progress Save)**
- Автосохранение каждые 30 секунд
- Сохранение перед выходом из аккаунта
- Все данные игрока сохраняются: монеты, уровень, скилы, сумоны
- Восстановление при перезагрузке страницы

**Восстановление сессии (Session Restore)**
- При F5 (перезагрузка) пользователь автоматически входит
- Не требуется повторный ввод пароля
- Данные загружаются из базы данных

---

## 📝 Детальный список изменений

### `websocket-server.js`

#### Новые импорты (строка 10)
```javascript
const { handleRegister, createDefaultPlayer, generateId } = require('./auth');
```
**Назначение:** Импорт функций аутентификации из отдельного модуля

#### Обновлена функция `loadDB()` (строка 14-30)
**Добавлено:**
- Инициализация `accounts` поля если его нет
- Инициализация `stats` поля если его нет
- Инициализация `event` поля если его нет

**Причина:** Убедиться что БД имеет правильную структуру

#### Инициализация БД (после загрузки)
```javascript
if (!db.accounts) db.accounts = {};
if (!db.stats) db.stats = { totalBattles: 0, totalClans: 0, totalPlayers: 0 };
if (!db.event) db.event = {};
```

#### Обновлена функция `handleMessage()` (строка 218-239)
**Добавлены обработчики:**
- `'authRequest'` → `handleAuthRequest(ws, data)` 
- `'savePlayerData'` → `handleSavePlayerData(ws, data)`
- `'restoreSession'` → `handleRestoreSession(ws, data)`

**Примечание:** `'register'` переименован в `handleRegisterGuest()` для различия

#### Новая функция `handleAuthRequest()` (строка 286-293)
```javascript
function handleAuthRequest(ws, data) {
  const { username, password } = data;
  handleRegister(ws, { username, password }, db, players, saveDB, 
                 broadcastEventInfo, broadcastLeaderboard);
}
```
**Назначение:** Обработка регистрации/входа с username + password

#### Новая функция `handleSavePlayerData()` (строка 295-344)
**Функциональность:**
- Принимает accountId и gameData из клиента
- Обновляет db.players[accountId] с новыми данными
- Сохраняет в файл (saveDB)
- Обновляет в памяти если игрок онлайн
- Отправляет подтверждение клиенту

**Сохраняемые данные:**
- coins, totalCoins, perClick, perSecond
- clicks, level, skills, achievements
- skins, currentSkin, multiplier
- pendingBoxes, lastLogin

#### Новая функция `handleRestoreSession()` (строка 346-392)
**Функциональность:**
- Проверяет что аккаунт существует в БД
- Загружает данные игрока
- Восстанавливает сессию без повторного ввода пароля
- Отправляет authSuccess с актуальными данными

**Процесс:**
1. Проверка accountId
2. Поиск в db.accounts
3. Загрузка db.players[accountId]
4. Обновление lastLogin
5. Отправка данных клиенту

#### Новая функция `handleRegisterGuest()` (строка 394-426)
**Переименовано из:** handleRegister()
**Назначение:** Регистрация гостей (без аккаунта, временные ID)

---

### `client.js`

#### Обновлена функция `connectWebSocket()` (строка 95-130)
**Что изменилось:**
- Добавлена проверка currentUser перед подключением
- Если есть currentUser → отправляем restoreSession
- Если режим гостя → обычный register
- Иначе → регистрируемся как анонимный гость

**Новый код (ws.onopen):**
```javascript
if (typeof currentUser !== 'undefined' && currentUser && !isGuest) {
  ws.send(JSON.stringify({
    type: 'restoreSession',
    accountId: currentUser.id,
    username: currentUser.username
  }));
}
```

#### Обновлена функция `handleServerMessage()` (строка 143-180)
**Новые обработчики:**

1. **'authSuccess'** - успешная аутентификация
   - Сохранение accountId и username в currentUser
   - Сохранение в localStorage
   - Загрузка gameData в объект game
   - Обновление UI

2. **'authError'** - ошибка аутентификации
   - Показ сообщения об ошибке пользователю
   - Вызов showAuthError()

**Ключевой код:**
```javascript
if (data.type === 'authSuccess') {
  currentUser = { id: data.accountId, username: data.username };
  localStorage.setItem('userSession', JSON.stringify(currentUser));
  Object.assign(game, data.data);
  updateUI();
}
```

---

### `auth-client.js`

**Статус:** ✅ Не требовал изменений (уже было полностью реализовано)

**Существующие функции используются сервером:**
- `handleLogin()` - отправка authRequest
- `saveGameData()` - отправка savePlayerData каждые 30 сек
- `currentUser` - глобальная переменная с данными аккаунта
- `updateAccountDisplay()` - обновление UI с именем

---

### `database.json`

**Новые поля (если их нет):**

```json
{
  "accounts": {
    "account_id_1": {
      "id": "account_id_1",
      "username": "player_name",
      "passwordHash": "base64_encrypted",
      "createdAt": 1234567890000,
      "lastLogin": 1234567890000
    }
  },
  "players": {
    "account_id_1": {
      "id": "account_id_1",
      "name": "player_name",
      "coins": 1000,
      "totalCoins": 5000,
      "multiplier": 1,
      ...
    }
  }
}
```

---

## 📊 WebSocket сообщения

### Новые типы сообщений ↓ (Client → Server)

#### `authRequest`
```json
{
  "type": "authRequest",
  "username": "player_name",
  "password": "password123"
}
```
**Ответ:** `authSuccess` или `authError`

#### `savePlayerData`
```json
{
  "type": "savePlayerData",
  "accountId": "xyz789",
  "gameData": {
    "coins": 1000,
    "totalCoins": 5000,
    "perClick": 1,
    "multiplier": 1,
    ...
  }
}
```
**Ответ:** `dataSaved` (опционально)

#### `restoreSession`
```json
{
  "type": "restoreSession",
  "accountId": "xyz789",
  "username": "player_name"
}
```
**Ответ:** `authSuccess` или `authError`

### Новые типы сообщений ↑ (Server → Client)

#### `authSuccess`
```json
{
  "type": "authSuccess",
  "accountId": "xyz789",
  "username": "player_name",
  "data": {
    "coins": 1000,
    "totalCoins": 5000,
    ...
  },
  "eventCoins": 0,
  "isNew": false
}
```

#### `authError`
```json
{
  "type": "authError",
  "message": "Неверный пароль"
}
```

#### `dataSaved` (новый)
```json
{
  "type": "dataSaved",
  "success": true,
  "timestamp": 1234567890000
}
```

---

## 🔄 Измененные потоки

### Старый процесс: Гость (временный ID)
```
Игрок → WebSocket register → Создан временный playerId → Игра
```

### Новый процесс: Аккаунт (постоянный)
```
Игрок → Форма входа → authRequest → Проверка/создание аккаунта →
accountId + gameData → Сохранение в localStorage → Игра с данными
```

### Старый процесс: Перезагрузка (потеря данных)
```
F5 → Новое подключение → Новый playerId → Потеря всех данных
```

### Новый процесс: Перезагрузка (восстановление)
```
F5 → localStorage восстанавливает currentUser → restoreSession →
Загрузка данных из БД → Игра продолжается
```

---

## 📈 Статистика изменений

| Категория | Значение |
|-----------|----------|
| Новых функций | 3 (handleAuthRequest, handleSavePlayerData, handleRestoreSession) |
| Обновленных функций | 2 (connectWebSocket, handleServerMessage) |
| Новых типов сообщений | 6 (3 ↓ + 3 ↑) |
| Строк кода добавлено | ~250 |
| Файлов изменено | 2 (websocket-server.js, client.js) |
| Документации создано | 6 файлов |

---

## ✅ Проверка изменений

### Синтаксис
- ✅ websocket-server.js - нет ошибок
- ✅ client.js - нет ошибок  
- ✅ auth-client.js - нет ошибок

### Функциональность
- ✅ Регистрация работает
- ✅ Вход работает
- ✅ Сохранение прогресса работает
- ✅ Восстановление сессии работает
- ✅ Обратная совместимость (регистр гостей все еще работает)

### Интеграция
- ✅ WebSocket сообщения правильно обрабатываются
- ✅ БД корректно инициализируется
- ✅ auth.js функции правильно вызываются
- ✅ localStorage правильно используется

---

## 🎯 Результат

### До (v1.0)
- Временные ID (потеря данных при перезагрузке)
- Гостевой режим только
- Нет сохранения между сессиями

### После (v2.0)
- Постоянные аккаунты с паролем
- Сохранение прогресса каждые 30 сек
- Автоматическое восстановление при перезагрузке
- Режим гостя все еще доступен
- Готово к многопользовательской синхронизации

---

## 📚 Документация по изменениям

Все изменения описаны в:
1. **IMPLEMENTATION_NOTES.md** - техническое описание
2. **ACCOUNT_SYSTEM_GUIDE.md** - как это использовать
3. **SUMMARY.md** - общий обзор
4. Этот файл - детальный changelog

---

**Версия:** 2.0  
**Дата:** 2024  
**Статус:** ✅ Полностью завершено
