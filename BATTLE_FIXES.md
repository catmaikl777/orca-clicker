# Исправления батлов и магазина

## Дата: 2024

### Исправленные проблемы:

## 1. Клики соперника не отображаются в батлах

**Проблема:** При батле клики соперника не отображались на обоих устройствах (у 1-го 2, у 2-го 1).

**Причина:** В функции `handleBattleClick` использовалась буферизация обновлений через `bufferBattleUpdate`, которая могла задерживать отправку данных сопернику.

**Решение:** 
- Убрана буферизация для батл-обновлений
- Теперь обновления отправляются обоим игрокам сразу и напрямую через WebSocket
- Каждый игрок получает корректные данные: свой счёт как `yourScore`, счёт соперника как `opponentScore`

**Файлы:** `websocket-server.js`

---

## 2. Лобби позволяло подключиться третьему игроку

**Проблема:** Когда двое игроков уже в лобби, третий мог подключиться.

**Причина:** В функции `handleFindBattle` не было ограничения на максимальное количество игроков в очереди ожидания.

**Решение:**
- Добавлена проверка `waitingPlayers.length >= 1` - очередь ограничена 1 игроком
- Добавлена проверка что игрок уже не в очереди (`waitingPlayers.includes(id)`)
- При попытке третьего игрока подключиться возвращается ошибка "Лобби заполнено. Подождите..."

**Файлы:** `websocket-server.js`, `client.js`

---

## 3. Цены в магазине оставались с предыдущего аккаунта

**Проблема:** При входе в новый аккаунт цены в магазине оставались от предыдущего аккаунта.

**Причина:** 
- При загрузке данных аккаунта через `authSuccess`, `shopItems` загружались только если они есть у аккаунта
- Если у нового аккаунта нет `shopItems`, использовались старые значения из localStorage

**Решение:**
- Добавлен сброс цен к дефолтным ПЕРЕД загрузкой данных аккаунта
- Добавлен каталог `SHOP_CATALOG` с базовыми ценами для сброса
- `shopItems` загружаются только если сервер явно передал их
- Для новых аккаунтов добавлено поле `shopItems: []` в `createDefaultPlayer`
- Добавлена инициализация `shopItems` в `handleRestoreSession`

**Файлы:** `client.js`, `auth.js`, `websocket-server.js`

---

## Изменения в коде:

### websocket-server.js

```javascript
// handleFindBattle - ограничение очереди
function handleFindBattle(ws) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player) return;
  
  // Не позволяем одному игроку быть в очереди дважды
  if (waitingPlayers.includes(id)) {
    ws.send(JSON.stringify({ type: 'waitingForBattle' }));
    return;
  }
  
  // Ограничиваем очередь максимум 1 игроком
  if (waitingPlayers.length >= 1) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби заполнено. Подождите...' }));
    return;
  }
  
  if (waitingPlayers.length > 0 && waitingPlayers[0] !== id) {
    startBattle(id, waitingPlayers.shift());
  } else {
    waitingPlayers.push(id);
    ws.send(JSON.stringify({ type: 'waitingForBattle' }));
  }
}

// handleBattleClick - прямая отправка без буферизации
function handleBattleClick(ws, battleId, clicks, cps) {
  const battle = battles.get(battleId);
  if (!battle) return;
  
  const id = ws.accountId || ws.playerId;
  
  // Проверка на бан
  if (isPlayerBanned(id)) {
    return;
  }
  
  // Лимит CPS
  if (cps > 100) {
    return;
  }
  
  const oldScore = battle.scores[id] || 0;
  battle.scores[id] = oldScore + clicks;
  if (cps !== undefined) battle.cps[id] = cps;
  
  // ... расчет eventCoins ...
  
  const opponentId = battle.players.find(pid => pid !== id);
  const opponent = players.get(opponentId);
  const player = players.get(id);
  
  // ОТПРАВКА СРАЗУ обоим игрокам
  if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify({
      type: 'battleUpdate',
      yourScore: battle.scores[id],
      opponentScore: battle.scores[opponentId],
      yourCPS: battle.cps[id] || 0,
      opponentCPS: battle.cps[opponentId] || 0,
      eventCoinsEarned: eventCoinsDiff
    }));
  }
  
  if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
    opponent.ws.send(JSON.stringify({
      type: 'battleUpdate',
      yourScore: battle.scores[opponentId],
      opponentScore: battle.scores[id],
      yourCPS: battle.cps[opponentId] || 0,
      opponentCPS: battle.cps[id] || 0,
      eventCoinsEarned: 0
    }));
  }
}
```

### client.js

```javascript
// Добавлен каталог для сброса цен
const SHOP_CATALOG = [
  { id: 'click1', baseCost: 50 },
  { id: 'click2', baseCost: 250 },
  // ... остальные предметы ...
];

// Сброс цен при authSuccess
if (data.type === 'authSuccess') {
  // СБРОС цен магазина к дефолтным перед загрузкой
  shopItems.forEach(item => {
    const catalogItem = SHOP_CATALOG?.find(i => i.id === item.id);
    if (catalogItem) {
      item.cost = catalogItem.baseCost;
    } else {
      const defaultCosts = { click1: 50, click2: 250, /* ... */ };
      item.cost = defaultCosts[item.id] || item.cost;
    }
  });
  
  // ... остальная загрузка данных ...
  
  // Цены загружаем ТОЛЬКО если есть shopItems от сервера
  if (d.shopItems && Array.isArray(d.shopItems)) {
    d.shopItems.forEach(saved => {
      const item = shopItems.find(i => i.id === saved.id);
      if (item) item.cost = saved.cost;
    });
  } else {
    console.log('🛒 Новый аккаунт - используются дефолтные цены');
  }
}

// Обработка ошибки лобби
case 'error':
  if (data.message && data.message.includes('Лобби')) {
    document.getElementById('battleLobby').classList.remove('hidden');
    document.getElementById('battleStatus').textContent = data.message;
  } else {
    showNotification(`⚠️ ${data.message}`);
  }
  break;
```

### auth.js

```javascript
function createDefaultPlayer(accountId, username) {
  return {
    id: accountId,
    name: username,
    coins: 0,
    // ... остальные поля ...
    shopItems: [], // Цены предметов (пусто = дефолтные цены)
    questProgress: [],
    createdAt: Date.now(),
    lastLogin: Date.now()
  };
}
```

---

## Тестирование:

1. **Батл - клики соперника:**
   - Открыть игру в двух браузерах/устройствах
   - Войти под разными аккаунтами
   - Начать батл
   - Кликайте на обоих устройствах
   - ✅ Оба игрока должны видеть актуальные клики друг друга

2. **Лобби - блокировка третьего:**
   - Два игрока находят батл
   - Третий игрок пытается найти батл
   - ✅ Третий игрок получает сообщение "Лобби заполнено. Подождите..."

3. **Магазин - цены при смене аккаунта:**
   - Войти в аккаунт 1, купить несколько улучшений (цены увеличатся)
   - Выйти из аккаунта
   - Войти в новый аккаунт 2
   - Открыть магазин
   - ✅ Цены должны быть дефолтными (50, 250, 1000, и т.д.)
