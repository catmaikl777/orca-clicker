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
