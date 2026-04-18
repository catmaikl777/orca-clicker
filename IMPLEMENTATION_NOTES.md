# 📋 Заметки по реализации системы аккаунтов

## 🎯 Выполненные задачи

### 1. ✅ Интеграция WebSocket сервера с аутентификацией
- **Файл:** `websocket-server.js`
- **Изменения:**
  - Импорт функций из `auth.js`: `handleRegister`, `createDefaultPlayer`, `generateId`
  - Инициализация поля `accounts` в БД при загрузке
  - Добавлена обработка сообщений типа:
    - `authRequest` - вход/регистрация с учетными данными
    - `savePlayerData` - сохранение прогресса игрока
    - `restoreSession` - восстановление сессии при переподключении

### 2. ✅ Обработчики на сервере

#### `handleAuthRequest(ws, data)`
- Принимает `username` и `password` из клиента
- Вызывает функцию `handleRegister()` из `auth.js`
- Обрабатывает как регистрацию, так и вход
- Отправляет клиенту `authSuccess` с данными аккаунта или `authError`

#### `handleSavePlayerData(ws, data)`
- Принимает `accountId` и `gameData` от клиента
- Обновляет данные игрока в `db.players`
- Сохраняет в БД каждые 30 секунд + при выходе
- Отправляет подтверждение `dataSaved` клиенту

#### `handleRestoreSession(ws, data)`
- Восстанавливает сессию при переподключении к WebSocket
- Используется когда пользователь перезагружает страницу
- Не требует повторного ввода пароля (уже в localStorage)
- Загружает сохраненные данные игрока

### 3. ✅ Обновления клиента

**Файл:** `client.js`
- Обновлена функция `connectWebSocket()`:
  - Если `currentUser` существует, отправляет `restoreSession`
  - Если режим гостя, отправляет обычный `register`
  - Иначе регистрируется как анонимный гость
  
- Обновлена функция `handleServerMessage()`:
  - Обработка `authSuccess` - сохранение аккаунта, загрузка данных
  - Обработка `authError` - показ ошибки пользователю
  - Синхронизация `playerId` с `accountId`

### 4. ✅ Система авторизации клиента

**Файл:** `auth-client.js` (уже готов от предыдущей реализации)
- `handleLogin()` - отправка `authRequest` на сервер
- `handleAuthResponse()` - обработка ответа сервера
- `saveGameData()` - автосохранение каждые 30 сек
- `logout()` - сохранение прогресса перед выходом
- `playAsGuest()` - режим без регистрации
- Автоматическое восстановление сессии при загрузке страницы

### 5. ✅ Структура данных

**БД структура (`database.json`):**
```json
{
  "accounts": {
    "accountId123": {
      "id": "accountId123",
      "username": "player_name",
      "passwordHash": "base64_encrypted_password",
      "createdAt": 1234567890,
      "lastLogin": 1234567890
    }
  },
  "players": {
    "accountId123": {
      "id": "accountId123",
      "name": "player_name",
      "coins": 1000,
      "totalCoins": 5000,
      "perClick": 1,
      "perSecond": 0,
      "clicks": 0,
      "level": 1,
      "skills": {},
      "achievements": [],
      "skins": {},
      "currentSkin": "normal",
      "multiplier": 1,
      "pendingBoxes": []
    }
  }
}
```

## 🔄 Поток авторизации

### Регистрация/Вход
```
1. Пользователь вводит username + password в форме
2. auth-client.js отправляет authRequest на сервер
3. websocket-server.js вызывает handleRegister() из auth.js
4. auth.js проверяет/создает аккаунт, хеширует пароль
5. Сервер отправляет authSuccess с accountId и gameData
6. Клиент сохраняет сессию в localStorage
7. Игровые данные загружаются в игру
8. Экран переключается на игровой
```

### Переподключение (reload страницы)
```
1. auth-client.js восстанавливает сессию из localStorage
2. client.js при connectWebSocket() видит currentUser
3. Отправляет restoreSession с accountId
4. Сервер восстанавливает данные игрока из БД
5. Отправляет authSuccess с актуальными данными
6. Игра продолжается с сохраненным прогрессом
```

### Сохранение прогресса
```
1. Каждые 30 сек: auth-client.js вызывает saveGameData()
2. Отправляет savePlayerData с accountId и gameData
3. websocket-server.js обновляет db.players[accountId]
4. Вызывает saveDB() для записи в файл
5. Отправляет dataSaved подтверждение (опционально)
```

## 🧪 Тестирование

### Сценарий 1: Регистрация нового аккаунта
- [ ] Открыть игру, перейти в "Регистрация"
- [ ] Ввести username и пароль (мин. 4 символа)
- [ ] Подтвердить пароль
- [ ] Нажать "Зарегистрироваться"
- [ ] ✅ Должен появиться экран игры с именем пользователя

### Сценарий 2: Вход с существующим аккаунтом
- [ ] Открыть игру, перейти в "Вход"
- [ ] Ввести свой username и пароль
- [ ] Нажать "Войти"
- [ ] ✅ Должны загрузиться сохраненные данные

### Сценарий 3: Сохранение прогресса
- [ ] Войти в аккаунт
- [ ] Поиграть (нажать на косатку) - накопить монеты
- [ ] Подождать 30 сек или закрыть вкладку
- [ ] Перезагрузить страницу
- [ ] ✅ Прогресс должен сохраниться

### Сценарий 4: Режим гостя
- [ ] Нажать "Играть без учета"
- [ ] Поиграть
- [ ] Перезагрузить страницу
- [ ] ✅ Игра должна вернуться на экран входа (данные не сохраняются)

### Сценарий 5: Выход из аккаунта
- [ ] Войти в аккаунт, поиграть
- [ ] Нажать кнопку "Выход"
- [ ] Подтвердить выход
- [ ] ✅ Данные сохранены, вернулись на экран входа

## 📝 WebSocket сообщения

### Клиент → Сервер

**authRequest**
```json
{
  "type": "authRequest",
  "username": "player_name",
  "password": "password123"
}
```

**savePlayerData**
```json
{
  "type": "savePlayerData",
  "accountId": "xyz789",
  "gameData": {
    "coins": 1000,
    "totalCoins": 5000,
    "multiplier": 1,
    ...
  }
}
```

**restoreSession**
```json
{
  "type": "restoreSession",
  "accountId": "xyz789",
  "username": "player_name"
}
```

### Сервер → Клиент

**authSuccess**
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

**authError**
```json
{
  "type": "authError",
  "message": "Неверный пароль"
}
```

**dataSaved**
```json
{
  "type": "dataSaved",
  "success": true,
  "timestamp": 1234567890
}
```

## ⚙️ Технические детали

### Хеширование пароля
- Используется простой алгоритм: `Base64(password + salt)`
- Salt: `'orca_clicker_salt_2024'`
- ⚠️ **Для продакшена:** использовать `bcrypt` или другой надежный алгоритм

### Хранилище сессии
- **Клиент:** `localStorage.userSession` (JSON объект с id и username)
- **Сервер:** В памяти Map `players` и в БД `database.json`

### Автосохранение
- Интервал: каждые 30 сек (`setInterval(saveGameData, 30000)`)
- Событие: перед выходом (`beforeunload`)
- При выходе из аккаунта

## 🚀 Что дальше?

1. **Улучшения безопасности:**
   - [ ] Использовать bcrypt для хеширования пароля
   - [ ] Добавить валидацию email
   - [ ] Реализовать восстановление пароля
   - [ ] HTTPS для production

2. **Функции аккаунта:**
   - [ ] Профиль пользователя
   - [ ] Статистика (время игры, рекорды)
   - [ ] Смена пароля
   - [ ] Удаление аккаунта

3. **Мультиплеер:**
   - [ ] Синхронизация данных между вкладками
   - [ ] Обновление рейтинга в реальном времени
   - [ ] Система уведомлений

4. **Мониторинг:**
   - [ ] Логирование ошибок аутентификации
   - [ ] Статистика активности пользователей
   - [ ] Резервное копирование БД

## 🔗 Связи между файлами

```
client.js
├─ connectWebSocket() → обработка authSuccess/authError
├─ handleServerMessage() → парсинг сообщений
└─ exports: game object, updateUI()

auth-client.js
├─ handleLogin() → отправка authRequest
├─ saveGameData() → отправка savePlayerData
├─ logout() → очистка сессии
└─ updateAccountDisplay() → обновление UI

websocket-server.js
├─ handleAuthRequest() → вызов auth.js:handleRegister()
├─ handleSavePlayerData() → обновление БД
├─ handleRestoreSession() → восстановление сессии
└─ imports: auth.js

auth.js (уже существует)
├─ handleRegister() → обработка login/register
├─ createDefaultPlayer() → новый игрок
├─ generateId() → уникальный ID
└─ hashPassword() → хеширование

index.html
├─ script: auth-client.js (первый)
└─ script: client.js (второй)
```

## 📊 Статус

- ✅ Регистрация и вход
- ✅ Сохранение прогресса
- ✅ Восстановление сессии
- ✅ Автосохранение каждые 30 сек
- ✅ WebSocket интеграция
- ⏳ Требует тестирования
- ⏳ Потребуется улучшение безопасности для продакшена

## 📚 Комментарии в коде

Все функции содержат детальные комментарии на русском языке. Основные функции:
- Рус: `handleAuthRequest()` - аутентификация
- Рус: `handleRestoreSession()` - восстановление
- Рус: `handleSavePlayerData()` - сохранение
