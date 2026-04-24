# 🏠 Система Лобби для PvP Батлов

## Обзор
Реализована полноценная система лобби для PvP батлов с возможностью создания, присоединения и управления лобби.

## Функциональность

### 1. Быстрый поиск (⚡ Быстрый)
- Автоматический поиск соперника
- Классическая система очередей
- Мгновенное начало батла при нахождении соперника

### 2. Лобби (🏠 Лобби)
- **Создание лобби**: Игрок создаёт лобби и ждёт соперника
- **Присоединение**: Другие игроки могут вступить в доступные лобби
- **Управление**: Владелец лобби может начать батл или покинуть его
- **Список лобби**: Просмотр всех активных лобби с информацией

## Ключевые особенности

### Для владельца лобби:
- ✅ Создание лобби по кнопке "Создать лобби"
- ✅ Ожидание соперника с отображением статуса
- ✅ Запуск батла кнопкой "Начать батл" (активна только когда есть соперник)
- ✅ Выход из лобби с уведомлением соперника

### Для присоединяющегося:
- ✅ Просмотр списка доступных лобби
- ✅ Информация о владельце лобби
- ✅ Вступление в лобби по кнопке "Вступить"
- ✅ Автоматическое уведомление владельца

### Защита и ограничения:
- 🚫 Нельзя создать лобби если уже в лобби
- 🚫 Нельзя вступить в своё собственное лобби
- 🚫 Нельзя вступить в заполненное лобби
- 🚫 Автоматическое удаление лобби при отключении игрока
- 🚫 Уведомления о всех действиях

## WebSocket Сообщения

### Отправка на сервер:
```javascript
// Создание лобби
ws.send(JSON.stringify({ type: 'createBattleLobby' }));

// Присоединение к лобби
ws.send(JSON.stringify({ type: 'joinBattleLobby', lobbyId: '...' }));

// Выход из лобби
ws.send(JSON.stringify({ type: 'leaveBattleLobby' }));

// Получение списка лобби
ws.send(JSON.stringify({ type: 'getBattleLobbies' }));

// Запуск батла из лобби (только владелец)
ws.send(JSON.stringify({ type: 'startBattleFromLobby', lobbyId: '...' }));
```

### Получение от сервера:
```javascript
// Лобби создано
{ type: 'lobbyCreated', lobbyId: '...', ownerName: '...' }

// Вы вступили в лобби
{ type: 'joinedLobby', lobbyId: '...', ownerName: '...', opponentName: '...' }

// Соперник вступил в ваше лобби
{ type: 'opponentJoined', lobbyId: '...', opponentName: '...' }

// Соперник покинул лобби
{ type: 'opponentLeft', lobbyId: '...' }

// Соперник отключился
{ type: 'opponentDisconnected', lobbyId: '...' }

// Вы покинули лобби
{ type: 'leftLobby', lobbyId: '...' }

// Список лобби (для обновления UI)
{ type: 'battleLobbies', lobbies: [...] }
```

## UI Элементы

### HTML Структура:
```html
<div id="battle" class="modal">
  <!-- Вкладки -->
  <div class="battle-tabs">
    <button class="battle-tab active" onclick="switchBattleTab('quick', this)">⚡ Быстрый</button>
    <button class="battle-tab" onclick="switchBattleTab('lobby', this)">🏠 Лобби</button>
  </div>
  
  <!-- Быстрый поиск -->
  <div id="battleQuickSearch" class="battle-search active">
    <button class="action-btn" onclick="findBattle()">🔍 Найти соперника</button>
    <p id="battleStatus">Нажмите кнопку для поиска соперника</p>
  </div>
  
  <!-- Лобби -->
  <div id="battleLobbyView" class="battle-lobby-view hidden">
    <div class="lobby-controls">
      <button class="action-btn" onclick="createBattleLobby()">🏠 Создать лобби</button>
      <button class="action-btn" onclick="refreshBattleLobbies()">🔄 Обновить</button>
    </div>
    
    <div id="battleLobbyList" class="battle-lobby-list">
      <!-- Список лобби -->
    </div>
    
    <div id="myBattleLobby" class="my-lobby hidden">
      <!-- Информация о моём лобби -->
    </div>
  </div>
</div>
```

## CSS Стили

Основные стили добавлены в `style.css`:
- `.battle-tabs` - вкладки для переключения
- `.battle-lobby-view` - контейнер лобби
- `.lobby-controls` - кнопки управления
- `.battle-lobby-list` - список лобби
- `.lobby-item` - элемент лобби
- `.my-lobby` - информация о моём лобби

## Примеры использования

### Создание и управление лобби:
```javascript
// Игрок создаёт лобби
function createBattleLobby() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  ws.send(JSON.stringify({ type: 'createBattleLobby' }));
}

// Игрок вступает в лобби
function joinBattleLobby(lobbyId) {
  ws.send(JSON.stringify({ type: 'joinBattleLobby', lobbyId }));
}

// Владелец запускает батл
function startBattleFromLobby() {
  if (!currentLobbyId) {
    showNotification('⚠️ Лобби не найдено');
    return;
  }
  ws.send(JSON.stringify({ type: 'startBattleFromLobby', lobbyId: currentLobbyId }));
}
```

## Изменения в коде

### Сервер (websocket-server.js):
1. Добавлены новые переменные для лобби:
   - `battleLobbies` - Map всех активных лобби
   - `lobbyWaitingPlayers` - Map игроков ожидающих вступления

2. Новые обработчики:
   - `handleCreateBattleLobby()` - создание лобби
   - `handleJoinBattleLobby()` - присоединение
   - `handleLeaveBattleLobby()` - выход
   - `handleGetBattleLobbies()` - получение списка
   - `handleStartBattleFromLobby()` - запуск батла

3. Обновлённая функция `startBattle()` - поддержка lobbyId

4. Обработка отключения игроков из лобби

### Клиент (client.js + index.html):
1. Новые функции:
   - `switchBattleTab()` - переключение вкладок
   - `createBattleLobby()` - создание лобби
   - `joinBattleLobby()` - присоединение
   - `leaveMyLobby()` - выход
   - `refreshBattleLobbies()` - обновление списка
   - `startBattleFromLobby()` - запуск батла
   - `updateBattleLobbiesUI()` - обновление UI списка
   - `updateMyLobbyUI()` - обновление UI моего лобби

2. Обновлённые функции:
   - `startBattleUI()` - поддержка lobbyId
   - `endBattleUI()` - корректное скрытие UI
   - `handleServerMessage()` - обработка новых типов сообщений

3. HTML изменения:
   - Добавлены вкладки для переключения
   - Новая структура для лобби view
   - Элементы управления лобби

## Тестирование

### Сценарии тестирования:
1. ✅ Создание лобби и ожидание соперника
2. ✅ Присоединение к лобби из списка
3. ✅ Запуск батла владельцем
4. ✅ Выход из лобби до начала батла
5. ✅ Отключение игрока в лобби
6. ✅ Попытки создать лобби будучи уже в лобби
7. ✅ Попытки вступить в своё лобби
8. ✅ Попытки вступить в заполненное лобби

## Будущие улучшения

- [ ] Пригласить друзей по ссылке
- [ ] Приватные лобби с паролем
- [ ] История батлов
- [ ] Рейтинг лобби
- [ ] Настройки лобби (время батла, правила)
- [ ] Чат в лобби
