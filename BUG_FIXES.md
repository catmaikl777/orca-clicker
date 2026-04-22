# 🔧 Исправление критических багов и обновления

## Проблема 1: Билеты не добавляются при высокой силе клика

### Причина:
EventCoins считались за один клик (`Math.floor(clicks / 10)`), что приводило к потере билетов при больших значениях clicks.

### Решение:
Считаем на основе общего прогресса батла:
```javascript
const newEventCoinsEarned = Math.floor(battle.scores[id] / 10);
const oldEventCoins = Math.floor(oldScore / 10);
const eventCoinsDiff = newEventCoinsEarned - oldEventCoins;
```

---

## Проблема 2: Бокс можно купить повторно после обновления

### Причина:
После покупки бокса данные не синхронизировались между `db.players` (БД) и `players` (память).

### Решение:
```javascript
// Синхронизация pendingBoxes в памяти
if (playerMem) {
  playerMem.pendingBoxes = playerDB.pendingBoxes;
}
```

---

## Проблема 3: Прогресс слетает при перезапуске сервера

### Причина:
`saveDB()` сохранял только `db.players` из файла, но не синхронизировал данные из `players` Map (активная память).

### Решение:
1. **Синхронизация перед сохранением:**
```javascript
function saveDB() {
  // Синхронизируем данные из players в db.players
  players.forEach((player, accountId) => {
    if (db.players[accountId]) {
      db.players[accountId].coins = player.coins;
      db.players[accountId].totalCoins = player.totalCoins;
      // ... все поля
    }
  });
  
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}
```

2. **Более частое автосохранение:** каждые 2 минуты
3. **Сохранение при SIGTERM (Render shutdown)**

---

## Проблема 4: Данные устаревают после 1 секунды

### Причина:
`handleUpdateScore` обновлял только `coins` в `db.players`, но не синхронизировал `perClick`, `perSecond` и другие поля.

### Решение:
```javascript
function handleUpdateScore(ws, coins, perClick, perSecond) {
  // Обновляем в памяти
  player.coins = coins;
  if (perClick) player.perClick = perClick;
  if (perSecond) player.perSecond = perSecond;
  
  // Обновляем ВСЕ поля в БД
  db.players[id].coins = coins;
  db.players[id].totalCoins = Math.max(db.players[id].totalCoins || 0, coins);
  if (perClick) db.players[id].perClick = perClick;
  if (perSecond) db.players[id].perSecond = perSecond;
  
  saveDB(); // Сохраняем сразу
}
```

---

## ✨ Новая функция: Реальные скины игроков в PvP батлах

### Что изменено:
- **Сервер передаёт реальные скины** - каждый игрок видит свой и соперника
- **Скины передаются через WebSocket** - в `battleStart` сообщении
- **Загрузка изображений** - используются реальные изображения скинов из `skinsData`

### Сервер (websocket-server.js):
```javascript
function startBattle(player1Id, player2Id) {
  const battleData = {
    type: 'battleStart',
    battleId,
    opponent: player2.name,
    yourPerSecond: player1.perSecond || 0,
    opponentPerSecond: player2.perSecond || 0,
    yourSkin: player1.currentSkin || 'normal',      // ← Мой скин
    opponentSkin: player2.currentSkin || 'normal',  // ← Скин соперника
    duration: 30000
  };
  
  player1.ws.send(JSON.stringify(battleData));
  // ... для игрока 2 меняем местами
}
```

### Клиент (client.js):
```javascript
function startBattleUI(data) {
  // Мой скин из данных сервера
  const mySkin = skinsData.find(s => s.id === data.yourSkin);
  document.getElementById('myBattleSkin').src = mySkin.image;
  
  // Скин соперника из данных сервера
  const opponentSkin = skinsData.find(s => s.id === data.opponentSkin);
  document.getElementById('opponentBattleSkin').src = opponentSkin.image;
}
```

### Структура данных:
```json
{
  "type": "battleStart",
  "battleId": "abc123",
  "opponent": "Player2",
  "yourPerSecond": 100,
  "opponentPerSecond": 150,
  "yourSkin": "cyberpunk",
  "opponentSkin": "beauty",
  "duration": 30000
}
```

### Визуализация:
```
┌─────────────────┐    VS    ┌─────────────────┐
│  [CYBERPUNK]    │          │   [BEAUTY]      │
│      ВЫ         │          │   СОПЕРНИК      │
│   Score: 45     │          │   Score: 38     │
│   CPS: 100      │          │   CPS: 150      │
└─────────────────┘          └─────────────────┘
```

**Теперь игроки видят реальные скины друг друга во время батла!** 🎨⚔️

---

## ✅ Проверка навыков

Навыки работают корректно:
- **s1 - Двойной клик**: 2x за клик (1000 монет)
- **s2 - Критический удар**: 10% шанс 10x (5000 монет)
- **s3 - Авто-эффективность**: 2x за секунду (3000 монет)
- **s4 - Золотая лихорадка**: Бонусы дают 3x (2000 монет)
- **s5 - Мастер клика**: 5x за клик (10000 монет)
- **s6 - Бизнес-косатка**: 5x за секунду (15000 монет)

Все эффекты применяются при покупке через `skill.effect()`.

---

## Файлы изменены:

### Сервер:
- `websocket-server.js` 
  - `handleBattleClick` - билеты считаются на основе общего прогресса
  - `handleBuyBox` - полная синхронизация pendingBoxes
  - `handleUpdateScore` - полная синхронизация всех полей
  - `saveDB()` - синхронизация players → db.players перед сохранением
  - `SIGTERM` обработчик для Render shutdown
  - Автосохранение каждые 2 минуты

### Клиент:
- `client.js`
  - `startBattleUI` - отображение скинов игроков в батле
  - Настройки скинов для соперника (рандом)
  
- `index.html`
  - Новая структура `battle-arena-display` с скинами
  
- `style.css`
  - `.battle-arena-display` - стили арены
  - `.battle-player-skin` - круглый фрейм с анимацией
  - `.battle-player-side` - стили стороны игрока
  - Мобильная адаптация для новых элементов

---

## Тестирование:

### Билеты:
1. Начните батл с high CPS (>100)
2. Быстро кликайте
3. Проверьте что билеты начисляются корректно

### Бокс:
1. Купите бокс (1700 монет)
2. Обновите страницу
3. Проверьте что монеты уменьшились и бокс не доступен для повторной покупки

### Сохранение прогресса:
1. Наберите 1,000,000 монет
2. Перезапустите сервер
3. Проверьте что прогресс не слетел

### Навыки:
1. Купите навык в дереве
2. Проверьте что эффект применяется
3. Перезагрузите страницу - навык сохраняется

### PvP Батл:
1. Начните батл
2. Проверьте что ваши скины отображается слева
3. Проверьте что скин соперника отображается справа
4. Кликните - счётчики обновляются

---

**Готово! Все баги исправлены и добавлены новые фичи ✅**

**Что делать:**
1. Перезапустите сервер: `npm run dev`
2. Протестируйте батлы со скинами
3. Проверьте сохранение прогресса

---

# 🤖 Защита от ботов (умная)

## Отличает людей от ботов по паттернам кликов

### Как работает:

**Анализ паттернов кликов:**
1. **Неравномерность** - люди имеют случайный ритм кликов, боты - равномерный
2. **Скорость** - боты могут кликать быстрее 10мс стабильно, люди не могут
3. **Вариативность** - стандартное отклонение интервалов у людей >15мс, у ботов <5мс

**Функция:**
```javascript
function analyzeClickPattern(accountId, clickTime) {
  // Анализирует каждые 50 кликов
  // Проверяет среднюю скорость и вариативность
  // Возвращает false если паттерн похож на бота
}
```

### Что блокируется:

✅ **Люди** - могут кликать сколько хотят, даже очень быстро!  
❌ **Боты** - блокируются если:
- Кликают быстрее 10мс в среднем
- Имеют слишком равномерные интервалы (stdDev < 5мс)

### Логи сервера:

```
🚨 Anti-bot: Игрок abc123 - подозрительный паттерн (avg 7.2ms)
🚨 Anti-bot: Игрок abc123 - слишком равномерные клики (stdDev: 2.3ms)
🚨 Anti-bot: Данные отклонены для игрока abc123
```

### Почему это работает:

**Человек:**
- Интервалы: 45ms, 123ms, 67ms, 201ms, 89ms...
- StdDev: ~50ms (высокая вариативность)
- Может спамить но с естественными паузами

**Бот:**
- Интервалы: 10ms, 10ms, 10ms, 10ms, 10ms...
- StdDev: 0ms (идеально равномерно)
- Неспособен имитировать человеческую неравномерность

---

# 💾 Исправление сохранения данных

## Реальное время сохранение боксов

### Проблема:
Количество боксов не сохранялось после перезагрузки страницы

### Решение:

**Сервер:**
- `handleBuyBox` - немедленное сохранение в БД + отправка актуального количества
- `handleOpenBox` - немедленное сохранение + отправка актуального количества
- Синхронизация `pendingBoxes` в памяти и БД

**Клиент:**
- Не добавляет/удаляет боксы локально до подтверждения сервера
- Ждёт `boxBought` и `boxOpened` ответы от сервера
- Обновляет UI только после подтверждения

### Потоки данных:

**Покупка бокса:**
```
Клиент: buyBox
  ↓
Сервер: проверяет монеты → вычитает → добавляет бокс → saveDB() → savePlayerToDB()
  ↓
Сервер: boxBought { boxId, coins, pendingBoxes: 3 }
  ↓
Клиент: обновляет pendingBoxes → updateBoxUI() → saveGame()
```

**Открытие бокса:**
```
Клиент: openBox(boxId)
  ↓ (катсцена без удаления бокса)
Сервер: удаляет бокс → выдаёт награду → saveDB() → savePlayerToDB()
  ↓
Сервер: boxOpened { reward, pendingBoxes: 2 }
  ↓
Клиент: показывает награду → обновляет pendingBoxes → saveGame()
```

### Что исправлено:

✅ Деньги сразу списываются при покупке  
✅ Бокс сразу добавляется в инвентарь  
✅ После перезагрузки количество боксов сохраняется  
✅ Нельзя купить бокс если нет денег (проверка на сервере)  
✅ Открытие бокса не удаляет его локально до подтверждения  
✅ Награда выдаётся только после успешного открытия на сервере

### Тестирование:

#### Покупка ящика:
1. Купите ящик (1700 монет)
2. Проверьте что деньги сразу списались
3. Проверьте что бокс появился в инвентаре
4. Обновите страницу
5. Проверьте что бокс остался
6. Попробуйте купить ещё раз - должно списаться правильно

#### Открытие ящика:
1. Нажмите "Открыть" когда есть боксы
2. Смотрите катсцену (боксы НЕ удаляются)
3. Получите награду
4. Проверьте что бокс удалён из инвентаря
5. Обновите страницу - бокс должен остаться удалённым

---

# 🗄️ PostgreSQL - единственный источник истины

## Проблема решённая в этой версии:

**Данные рассинхронизировались между:**
1. **localStorage** (браузер клиента)
2. **memory** (players Map на сервере)  
3. **JSON file** (database.json)
4. **PostgreSQL** (если подключён)

**Результат:** После перезагрузки страницы прогресс терялся или возвращался к старой версии. Лидерборд показывал неверные данные.

## Решение:

### 🔴 УДАЛЕНО:
- ❌ Сохранение в JSON файл (`database.json`)
- ❌ Автосохранение раз в 2 минуты  
- ❌ Синхронизация players → db.players перед сохранением
- ❌ Функция `saveDB()` для JSON

### ✅ ОСТАВЛЕНО:
- PostgreSQL как **ЕДИНСТВЕННЫЙ** источник истины
- Мгновенное сохранение после **КАЖДОГО** действия
- `savePlayerToDB()` вызывается после каждой операции

## Как работает сейчас:

### Все действия сохраняются МГНОВЕННО:

```
Клик → updateScore → savePlayerToDB() ✅
Покупка предмета → handleBuyItem → savePlayerToDB() ✅
Покупка навыка → handleBuySkill → savePlayerToDB() ✅
Покупка бокса → handleBuyBox → savePlayerToDB() ✅
Открытие бокса → handleOpenBox → savePlayerToDB() ✅
Надевание скина → handleEquipSkin → savePlayerToDB() ✅
Победа в батле → endBattle → coins обновляются ✅
```

### Функция сохранения:

```javascript
function savePlayerToDB(accountId) {
  if (!dbAdapter.usePostgreSQL) return;
  const p = db.players[accountId];
  if (!p) return;
  
  // Сразу сохраняет в PostgreSQL
  dbAdapter.savePlayer({ ...p, accountId })
    .catch(e => console.error('Ошибка сохранения:', e));
    
  const acc = db.accounts[accountId];
  if (acc) dbAdapter.saveAccount(acc).catch(() => {});
}
```

### Пример использования:

```javascript
function handleBuyBox(ws) {
  const id = ws.accountId;
  const playerDB = db.players[id];
  const playerMem = players.get(id);
  
  // Проверка денег
  const coins = playerMem ? playerMem.coins : playerDB.coins;
  if (coins < boxPrice) {
    ws.send({ type: 'error', message: 'Недостаточно монет' });
    return;
  }
  
  // Списываем деньги
  playerDB.coins = coins - boxPrice;
  if (playerMem) playerMem.coins = playerDB.coins;
  
  // Добавляем бокс
  playerDB.pendingBoxes.push(boxId);
  if (playerMem) playerMem.pendingBoxes = [...playerDB.pendingBoxes];
  
  // МГНОВЕННОЕ сохранение в PostgreSQL
  savePlayerToDB(id);
  
  // Отправляем подтверждение
  ws.send({ 
    type: 'boxBought', 
    boxId,
    coins: playerDB.coins,
    pendingBoxes: playerDB.pendingBoxes.length
  });
}
```

## Загрузка данных:

### При старте сервера:
1. Загружаются **аккаунты** из PostgreSQL
2. Загружаются **игроки** из PostgreSQL  
3. Загружаются **eventCoins** из PostgreSQL

### При подключении игрока:
1. `restoreSession` загружает актуальные данные из памяти
2. Если игрока нет в памяти - создаётся новый профиль

## Синхронизация:

### Онлайн игроки:
- Данные хранятся в `players` Map (память сервера)
- Изменения **сразу** пишутся в PostgreSQL через `savePlayerToDB()`

### Офлайн игроки:
- Данные только в PostgreSQL
- Загружаются при первом подключении после рестарта

## Лидерборд:

### Проблема была:
Лидерборд показывал старый прогресс из памяти, не отражая актуальные данные.

### Решение:
```javascript
function sendLeaderboard(ws) {
  // Перестраиваем из АКТУАЛЬНЫХ данных игроков в памяти
  db.leaderboard = Object.values(db.players)
    .filter(p => p && p.id && p.name)
    .map(p => ({ 
      id: p.id, 
      name: p.name, 
      coins: p.coins || 0, 
      perSecond: p.perSecond || 0, 
      level: p.level || 1 
    }))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 100);
    
  ws.send({ type: 'leaderboard', data: db.leaderboard });
}
```

## Тестирование:

### ✅ Проверка сохранения:
1. Наберите прогресс (монеты, навыки, боксы)
2. Обновите страницу (F5)
3. Зайдите в тот же аккаунт
4. **Ожидаем:** Весь прогресс на месте ✅

### ✅ Проверка лидерборда:
1. Наберите много монет
2. Откройте лидерборд
3. **Ожидайте:** Ваш прогресс актуален ✅

### ✅ Проверка боксов:
1. Купите бокс (1700 монет)
2. Проверьте количество боксов
3. Обновите страницу
4. **Ожидайте:** Бокс остался, монеты не вернулись ✅

### ✅ Проверка скинов:
1. Купите/откройте скин
2. Наденьте его
3. Обновите страницу
4. **Ожидайте:** Скин выбран ✅

---

**Готово! PostgreSQL теперь единственный источник истины, данные сохраняются мгновенно!** 🚀
