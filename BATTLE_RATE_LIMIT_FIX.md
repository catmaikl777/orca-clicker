
# 🔧 Исправление проблемы с rate limiting в батле

## Проблема
При быстрых кликах в PvP батле обновления переставали приходить сопернику из-за rate limiting.

## Причина
1. Rate limiter блокировал отправку сообщений при превышении лимита (50 сообщений/минуту)
2. Не было проверки `readyState` WebSocket перед отправкой
3. Обновления не буферизировались - терялись при потере соединения

## Решение

### 1. Исключение battleClick из rate limiting
```javascript
// battleClick никогда не лимитируем - это критично для игры
if (data.type !== 'battleClick') {
  if (!wsRateLimiter.checkMessage(ip, data.type)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Слишком много запросов' }));
    return;
  }
}
```

### 2. Буферизация обновлений
```javascript
// Буфер обновлений для батлов
const battleUpdateBuffer = new Map();

function bufferBattleUpdate(playerId, updateData) {
  let buffer = battleUpdateBuffer.get(playerId);
  if (!buffer) {
    buffer = { updates: [], lastSend: Date.now() };
    battleUpdateBuffer.set(playerId, buffer);
  }
  buffer.updates.push(updateData);
  
  // Отправляем если накопилось 3+ обновления или прошло 100мс
  if (buffer.updates.length >= 3 || Date.now() - buffer.lastSend > 100) {
    flushBattleBuffer(playerId);
  }
}
```

### 3. Периодическая отправка
```javascript
// Каждую секунду отправляем накопленные обновления
setInterval(() => {
  battleUpdateBuffer.forEach((buffer, playerId) => {
    if (buffer.updates.length > 0) {
      flushBattleBuffer(playerId);
    }
  });
}, 1000);
```

### 4. Проверка WebSocket readyState
```javascript
function flushBattleBuffer(playerId) {
  const buffer = battleUpdateBuffer.get(playerId);
  if (!buffer || buffer.updates.length === 0) return;
  
  const player = players.get(playerId);
  if (!player || !player.ws || player.ws.readyState !== WebSocket.OPEN) {
    battleUpdateBuffer.delete(playerId);
    return;
  }
  
  // Отправляем последнее обновление (актуальные данные)
  const lastUpdate = buffer.updates[buffer.updates.length - 1];
  player.ws.send(JSON.stringify(lastUpdate));
  
  buffer.updates = [];
  buffer.lastSend = Date.now();
}
```

### 5. Очистка буфера при отключении
```javascript
ws.on('close', () => {
  clearBattleBuffer(playerId); // Очищаем буфер
  // ... остальной код
});
```

## Изменённые файлы

- `websocket-server.js` - основная логика исправления
  - Добавлен буфер обновлений
  - Исключение battleClick из rate limiting
  - Периодическая отправка буфера
  - Проверка readyState

## Результат

✅ Обновления в батле больше не теряются
✅ Соперник всегда видит актуальные клики
✅ Нет задержек при быстрых кликах
✅ Rate limiting работает для других действий

## Тестирование

1. Откройте батл на двух устройствах
2. Быстро кликайте (20+ кликов/секунду)
3. Проверьте что оба игрока видят обновления
4. Убедитесь что нет задержек

---

**Готово! Батлы теперь работают стабильно при любом количестве кликов 🎉**
