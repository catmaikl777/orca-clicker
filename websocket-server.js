// ============================================
// WebSocket сервер для Кошка-косатка Кликер
// Запуск: node websocket-server.js
// Порт: 3001 (или PORT из env)
// ============================================

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { handleRegister: handleAuthRegister, createDefaultPlayer, generateId: generateAuthId } = require('./auth');
const { WebSocketRateLimiter } = require('./middleware/rate-limiter');
const dbAdapter = require('./middleware/database-adapter');

const wsRateLimiter = new WebSocketRateLimiter({ maxConnections: 100, maxMessages: 50, windowMs: 60000 });

// Путь к БД
const DB_PATH = path.join(__dirname, 'database.json');

// Загрузка БД
function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Ошибка загрузки БД:', e.message);
  }
  return {
    players: {},
    clans: {},
    leaderboard: [],
    battles: {},
    stats: { totalBattles: 0, totalClans: 0, totalPlayers: 0 },
    accounts: {},
    event: {}
  };
}

// Сохранение БД
function saveDB() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Ошибка сохранения БД:', e.message);
  }
  // Async sync to PostgreSQL if available
  if (dbAdapter.usePostgreSQL) {
    Object.entries(db.accounts || {}).forEach(([id, acc]) => dbAdapter.saveAccount(acc).catch(() => {}));
    Object.entries(db.players || {}).forEach(([id, p]) => dbAdapter.savePlayer({ ...p, accountId: id }).catch(() => {}));
  }
}

// Инициализация БД
let db = loadDB();

// Инициализация адаптера (PostgreSQL или file-based)
dbAdapter.init().catch(err => console.error('DB adapter init error:', err.message));

// Убедимся что все необходимые поля есть
if (!db.accounts) db.accounts = {};
if (!db.stats) db.stats = { totalBattles: 0, totalClans: 0, totalPlayers: 0 };
if (!db.event) db.event = {};

// ПРИНУДИТЕЛЬНО создаём новый ивент на 2 недели
const now = Date.now();
db.event = {
  active: true,
  startDate: now,
  endDate: now + 14 * 24 * 60 * 60 * 1000, // 2 недели
  eventCoins: db.event?.eventCoins || {},
  season: (db.event?.season || 0) + 1
};

console.log('База данных загружена');
console.log(`🎉 Ивент активен! До конца: ${Math.ceil((db.event.endDate - now) / 60000)} мин.`);
saveDB();

// Хранилище в памяти
const players = new Map();
const battles = new Map();
const waitingPlayers = [];

// Автосохранение
setInterval(() => { saveDB(); }, 30000);

// Проверка оконч
// ания ивента (каждые 5 минут)
setInterval(() => {
  if (db.event.active && Date.now() > db.event.endDate) {
    distributeEventRewards();
  }
}, 300000);

// Распределение наград ивента
function distributeEventRewards() {
  console.log('🏆 Распределение наград ивента...');
  console.log(`📊 eventCoins:`, db.event.eventCoins);
  
  // Топ-3 игроков по eventCoins
  const playerEventCoins = Object.entries(db.event.eventCoins || {})
    .map(([id, coins]) => ({ id, coins, name: db.players[id]?.name || 'Unknown' }))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 3);
  
  console.log('🎮 Топ игроков:', playerEventCoins);
  
  // Топ-3 кланов по totalCoins
  const topClans = Object.values(db.clans)
    .sort((a, b) => b.totalCoins - a.totalCoins)
    .slice(0, 3);
  
  const rewards = [50000, 25000, 10000]; // Награды за 1, 2, 3 места
  
  let totalGiven = 0;
  
  // Награды игрокам
  if (playerEventCoins.length === 0) {
    console.log('⚠️ Нет игроков с билетами');
  }
  
  playerEventCoins.forEach((player, index) => {
    if (player.coins > 0 && db.players[player.id]) {
      const reward = rewards[index];
      db.players[player.id].coins += reward;
      db.players[player.id].eventRewards = (db.players[player.id].eventRewards || 0) + reward;
      console.log(`🥇 ${index + 1} место игроку ${player.name}: +${reward} (всего: ${db.players[player.id].coins})`);
      totalGiven += reward;
    }
  });
  
  // Награды кланам (всем участникам)
  topClans.forEach((clan, index) => {
    const reward = rewards[index];
    clan.members.forEach(memberId => {
      if (db.players[memberId]) {
        db.players[memberId].coins += reward;
        db.players[memberId].eventRewards = (db.players[memberId].eventRewards || 0) + reward;
        console.log(`  🏰 Участнику ${db.players[memberId].name}: +${reward}`);
        totalGiven += reward;
      }
    });
    console.log(`🏰 ${index + 1} место клану ${clan.name}: +${reward} каждому (${clan.members.length} уч.)`);
  });
  
  console.log(`💰 Всего выдано: ${totalGiven}`);
  
  // Сохраняем старые данные для лога
  const oldSeason = db.event.season;
  const oldEventCoins = {...db.event.eventCoins};
  
  // Сброс ивента и запуск нового
  db.event.season++;
  db.event.startDate = Date.now();
  db.event.endDate = Date.now() + 14 * 24 * 60 * 60 * 1000; // 2 недели
  db.event.eventCoins = {};
  
  saveDB();
  broadcastEventInfo();
  console.log(`🎉 Сезон #${oldSeason} завершён! Старт сезона #${db.event.season}`);
  console.log(`📋 Итоги сезона #${oldSeason}:`, oldEventCoins);
  
  // Отправляем обновлённые данные игрокам
  setTimeout(() => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.playerId) {
        const player = db.players[client.playerId];
        if (player) {
          client.send(JSON.stringify({
            type: 'registered',
            playerId: client.playerId,
            name: player.name,
            data: player,
            eventCoins: 0
          }));
        }
      }
    });
  }, 500);
}
  
function broadcastEventInfo() {
  const eventData = JSON.stringify({
    type: 'eventInfo',
    event: db.event
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(eventData);
    }
  });
}

// Генерация ID
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 4);
}

// WebSocket сервер с CORS поддержкой
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Создаем HTTP сервер для health check
const httpServer = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      players: players.size 
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

// WebSocket сервер с CORS
const wss = new WebSocket.Server({ 
  server: httpServer,
  perMessageDeflate: false,
  // CORS для WebSocket
  verifyClient: (info) => {
    const origin = info.origin || info.req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    return !origin || allowedOrigins.includes(origin);
  }
});

// Запуск HTTP сервера
httpServer.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📍 WebSocket: wss://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  
  if (!wsRateLimiter.checkConnection(ip)) {
    ws.close(1008, 'Too many connections');
    return;
  }
  
  const playerId = generateId();
  ws.playerId = playerId;
  ws.ip = ip;
  console.log(`Игрок подключён: ${playerId}`);
  ws.send(JSON.stringify({ type: 'connected', playerId }));
  
  ws.on('message', (message) => {
    if (!wsRateLimiter.checkMessage(ip)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Слишком много запросов' }));
      return;
    }
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (e) {
      console.error('Ошибка парсинга:', e);
    }
  });
  
  ws.on('close', () => {
    console.log(`Игрок отключён: ${playerId}`);
    wsRateLimiter.cleanup(ip);
    players.delete(playerId);
    for (const [battleId, battle] of battles) {
      if (battle.players.includes(playerId)) endBattle(battleId, playerId);
    }
    const idx = waitingPlayers.indexOf(playerId);
    if (idx > -1) waitingPlayers.splice(idx, 1);
  });
});

function handleMessage(ws, data) {
  switch (data.type) {
    case 'authRequest': handleAuthRequest(ws, data); break;
    case 'savePlayerData': handleSavePlayerData(ws, data); break;
    case 'restoreSession': handleRestoreSession(ws, data); break;
    case 'register': handleRegisterGuest(ws, data.name); break;
    case 'updateScore': handleUpdateScore(ws, data.coins, data.perClick, data.perSecond); break;
    case 'addEventCoins': addEventCoins(ws.playerId, data.amount); break;
    case 'getEventInfo': sendEventInfo(ws); break;
    case 'findBattle': handleFindBattle(ws); break;
    case 'battleClick': handleBattleClick(ws, data.battleId, data.clicks, data.cps); break;
    case 'getLeaderboard': sendLeaderboard(ws); break;
    case 'createClan': handleCreateClan(ws, data.name); break;
    case 'joinClan': handleJoinClan(ws, data.clanId); break;
    case 'leaveClan': handleLeaveClan(ws); break;
    case 'getClans': sendClans(ws); break;
    case 'getClanMembers': getClanMembers(ws); break;
    case 'buySkill': handleBuySkill(ws, data.skillId); break;
    case 'buyBox': handleBuyBox(ws); break;
    case 'openBox': handleOpenBox(ws, data.boxId); break;
    case 'saveGame': handleSaveGame(ws, data.data); break;
  }
}

function handleSaveGame(ws, data) {
  const player = players.get(ws.playerId);
  if (!player) return;
  
  // Сохраняем данные игрока на сервере
  db.players[ws.playerId].coins = data.coins || player.coins;
  db.players[ws.playerId].totalCoins = data.totalCoins || player.totalCoins;
  db.players[ws.playerId].perClick = data.perClick || player.perClick;
  db.players[ws.playerId].perSecond = data.perSecond || player.perSecond;
  db.players[ws.playerId].clicks = data.clicks || player.clicks;
  db.players[ws.playerId].skills = data.skills || player.skills;
  db.players[ws.playerId].skins = data.skins || player.skins;
  db.players[ws.playerId].currentSkin = data.currentSkin || player.currentSkin;
  db.players[ws.playerId].achievements = data.achievements || player.achievements;
  db.players[ws.playerId].pendingBoxes = data.pendingBoxes || player.pendingBoxes || [];
  db.players[ws.playerId].lastLogin = Date.now();
  
  saveDB();
  console.log('💾 Автосохранение:', ws.playerId);
}
  
function sendEventInfo(ws) {
  ws.send(JSON.stringify({ 
    type: 'eventInfo',
    event: {
      active: db.event.active,
      endDate: db.event.endDate,
      season: db.event.season,
      eventCoins: db.event.eventCoins[ws.playerId] || 0,
      topPlayers: Object.entries(db.event.eventCoins || {})
        .map(([id, coins]) => ({ id, name: db.players[id]?.name || 'Unknown', coins }))
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 10)
    }
  }));
}

// ==================== Аутентификация (системе аккаунтов) ====================

// Обработчик аутентификации (login/register с аккаунтом)
function handleAuthRequest(ws, data) {
  const { username, password } = data;
  
  // Используем функцию из auth.js
  handleAuthRegister(ws, { username, password }, db, players, saveDB, broadcastEventInfo, broadcastLeaderboard);
}

// Обработчик сохранения данных игрока
function handleSavePlayerData(ws, data) {
  const { accountId, gameData } = data;
  
  if (!accountId || !gameData) {
    console.error('❌ Неполные данные для сохранения');
    return;
  }
  
  // Обновляем данные в БД
  if (!db.players[accountId]) {
    db.players[accountId] = createDefaultPlayer(accountId, 'Player');
  }
  
  const playerData = db.players[accountId];
  
  // Обновляем поля игрока
  playerData.coins = gameData.coins !== undefined ? gameData.coins : playerData.coins;
  playerData.totalCoins = gameData.totalCoins !== undefined ? gameData.totalCoins : playerData.totalCoins;
  playerData.perClick = gameData.perClick !== undefined ? gameData.perClick : playerData.perClick;
  playerData.perSecond = gameData.perSecond !== undefined ? gameData.perSecond : playerData.perSecond;
  playerData.clicks = gameData.clicks !== undefined ? gameData.clicks : playerData.clicks;
  playerData.level = gameData.level !== undefined ? gameData.level : playerData.level;
  playerData.skills = gameData.skills || playerData.skills;
  playerData.skins = gameData.skins || playerData.skins;
  playerData.currentSkin = gameData.currentSkin || playerData.currentSkin;
  playerData.achievements = gameData.achievements || playerData.achievements;
  playerData.pendingBoxes = gameData.pendingBoxes || playerData.pendingBoxes;
  playerData.multiplier = gameData.multiplier || 1;
  playerData.lastLogin = Date.now();
  
  // Обновляем в памяти если игрок онлайн
  if (players.has(accountId)) {
    const onlinePlayer = players.get(accountId);
    Object.assign(onlinePlayer, playerData);
  }
  
  saveDB();
  console.log(`💾 Данные сохранены: ${accountId}`);
  
  // Отправляем подтверждение
  ws.send(JSON.stringify({ 
    type: 'dataSaved',
    success: true,
    timestamp: Date.now()
  }));
}

// Восстановление сессии при переподключении
function handleRestoreSession(ws, data) {
  const { accountId, username } = data;
  
  if (!accountId) {
    ws.send(JSON.stringify({ 
      type: 'authError',
      message: 'Неверные данные сессии'
    }));
    return;
  }
  
  // Проверяем что аккаунт существует
  if (!db.accounts || !db.accounts[accountId]) {
    ws.send(JSON.stringify({ 
      type: 'authError',
      message: 'Аккаунт не найден'
    }));
    return;
  }
  
  // Получаем данные игрока
  let playerData = db.players[accountId];
  if (!playerData) {
    playerData = createDefaultPlayer(accountId, username || 'Player');
    db.players[accountId] = playerData;
  }
  
  // Обновляем последний вход
  playerData.lastLogin = Date.now();
  db.accounts[accountId].lastLogin = Date.now();
  
  ws.authenticated = true;
  ws.accountId = accountId;
  
  // Добавляем в памяти
  players.set(accountId, { ...playerData, ws });
  
  // Отправляем успешное восстановление
  ws.send(JSON.stringify({ 
    type: 'authSuccess',
    accountId,
    username: username || playerData.name,
    data: playerData,
    eventCoins: db.event.eventCoins[accountId] || 0
  }));
  
  console.log(`🔄 Сессия восстановлена: ${username} (${accountId})`);
  broadcastLeaderboard();
  broadcastEventInfo();
  saveDB();
}

// ==================== Регистрация гостя ====================

function handleRegisterGuest(ws, name) {
  const playerId = ws.playerId;
  let playerData = db.players[playerId];
  
  if (!playerData) {
    playerData = {
      id: playerId,
      name: name || `Player_${playerId.substr(0, 4)}`,
      coins: 0, totalCoins: 0, perClick: 1, perSecond: 0,
      clicks: 0, level: 1, skills: {}, achievements: [],
      skins: { normal: true }, currentSkin: 'normal', clan: null,
      createdAt: Date.now(), lastLogin: Date.now(),
      eventRewards: 0, pendingBoxes: []
    };
    db.players[playerId] = playerData;
    db.stats.totalPlayers++;
  } else {
    playerData.name = name || playerData.name;
    playerData.lastLogin = Date.now();
  }
  
  players.set(playerId, { ...playerData, ws });
  ws.send(JSON.stringify({ 
    type: 'registered', 
    playerId, 
    name: playerData.name, 
    data: playerData,
    eventCoins: db.event.eventCoins[playerId] || 0
  }));
  broadcastLeaderboard();
  broadcastEventInfo();
  saveDB();
}

function handleUpdateScore(ws, coins, perClick, perSecond) {
  const player = players.get(ws.playerId);
  if (!player) return;
  player.coins = coins;
  if (perClick) player.perClick = perClick;
  if (perSecond) player.perSecond = perSecond;
  db.players[ws.playerId].coins = coins;
  db.players[ws.playerId].totalCoins = Math.max(db.players[ws.playerId].totalCoins || 0, coins);
  updateLeaderboard(player);
}
  
// Добавление eventCoins
function addEventCoins(playerId, amount) {
  if (!db.event.eventCoins[playerId]) {
    db.event.eventCoins[playerId] = 0;
  }
  db.event.eventCoins[playerId] += amount;
  saveDB();
}
  
function handleFindBattle(ws) {
  const player = players.get(ws.playerId);
  if (!player) return;
  if (waitingPlayers.length > 0 && waitingPlayers[0] !== ws.playerId) {
    startBattle(ws.playerId, waitingPlayers.shift());
  } else {
    waitingPlayers.push(ws.playerId);
    ws.send(JSON.stringify({ type: 'waitingForBattle' }));
  }
}
  
function startBattle(player1Id, player2Id) {
  const player1 = players.get(player1Id);
  const player2 = players.get(player2Id);
  if (!player1 || !player2) return;
  
  const battleId = generateId();
  battles.set(battleId, {
    id: battleId,
    players: [player1Id, player2Id],
    scores: { [player1Id]: 0, [player2Id]: 0 },
    cps: { [player1Id]: player1.perSecond || 0, [player2Id]: player2.perSecond || 0 },
    startTime: Date.now(),
    duration: 30000
  });
  
  const battleData = {
    type: 'battleStart', battleId,
    opponent: player2.name,
    yourPerSecond: player1.perSecond || 0,
    opponentPerSecond: player2.perSecond || 0,
    duration: 30000
  };
  
  player1.ws.send(JSON.stringify(battleData));
  battleData.opponent = player1.name;
  battleData.yourPerSecond = player2.perSecond || 0;
  battleData.opponentPerSecond = player1.perSecond || 0;
  player2.ws.send(JSON.stringify(battleData));
  
  setTimeout(() => endBattle(battleId), 30000);
}

function handleBattleClick(ws, battleId, clicks, cps) {
  const battle = battles.get(battleId);
  if (!battle) return;
  
  battle.scores[ws.playerId] = (battle.scores[ws.playerId] || 0) + clicks;
  if (cps !== undefined) battle.cps[ws.playerId] = cps;
  
  // Начисляем eventCoins за клики в битве (1 coin за 10 кликов)
  const eventCoinsEarned = Math.floor(clicks / 10);
  if (eventCoinsEarned > 0) {
    addEventCoins(ws.playerId, eventCoinsEarned);
  }
  
  const opponentId = battle.players.find(id => id !== ws.playerId);
  const opponent = players.get(opponentId);
  
  if (opponent) {
    ws.send(JSON.stringify({
      type: 'battleUpdate',
      yourScore: battle.scores[ws.playerId],
      opponentScore: battle.scores[opponentId],
      yourCPS: battle.cps[ws.playerId] || 0,
      opponentCPS: battle.cps[opponentId] || 0,
      eventCoinsEarned: eventCoinsEarned
    }));
    opponent.ws.send(JSON.stringify({
      type: 'battleUpdate',
      yourScore: battle.scores[opponentId],
      opponentScore: battle.scores[ws.playerId],
      yourCPS: battle.cps[opponentId] || 0,
      opponentCPS: battle.cps[ws.playerId] || 0
    }));
  }
}

function endBattle(battleId, disconnectedPlayer = null) {
  const battle = battles.get(battleId);
  if (!battle) return;
  
  const [p1, p2] = battle.players;
  const player1 = players.get(p1);
  const player2 = players.get(p2);
  
  let winner = null, prize = 0;
  if (disconnectedPlayer) {
    winner = disconnectedPlayer === p1 ? p2 : p1;
    prize = 50;
  } else if (battle.scores[p1] > battle.scores[p2]) {
    winner = p1; prize = 100;
  } else if (battle.scores[p2] > battle.scores[p1]) {
    winner = p2; prize = 100;
  }
  
  const winnerName = winner ? players.get(winner)?.name : 'Ничья';
  const isDraw = !winner;
  
  if (player1) {
    const reward = isDraw ? 25 : (p1 === winner ? prize : 10);
    player1.coins += reward;
    db.players[p1].coins = player1.coins;
  }
  if (player2) {
    const reward = isDraw ? 25 : (p2 === winner ? prize : 10);
    player2.coins += reward;
    db.players[p2].coins = player2.coins;
  }
  
  db.stats.totalBattles++;
  saveDB();
  
  const result = { type: 'battleEnd', winner: winnerName, isDraw, prize: isDraw ? 25 : (winner ? prize : 10) };
  
  if (player1) {
    result.yourScore = battle.scores[p1];
    result.opponentScore = battle.scores[p2];
    result.yourCPS = battle.cps[p1] || 0;
    result.opponentCPS = battle.cps[p2] || 0;
    player1.ws.send(JSON.stringify(result));
  }
  if (player2) {
    result.yourScore = battle.scores[p2];
    result.opponentScore = battle.scores[p1];
    result.yourCPS = battle.cps[p2] || 0;
    result.opponentCPS = battle.cps[p1] || 0;
    player2.ws.send(JSON.stringify(result));
  }
  
  battles.delete(battleId);
}

function updateLeaderboard(player) {
  const idx = db.leaderboard.findIndex(p => p.id === player.id);
  const entry = { id: player.id, name: player.name, coins: player.coins, perSecond: player.perSecond, level: player.level };
  if (idx >= 0) db.leaderboard[idx] = entry;
  else db.leaderboard.push(entry);
  db.leaderboard.sort((a, b) => b.coins - a.coins);
  if (db.leaderboard.length > 100) db.leaderboard.length = 100;
  saveDB();
}

function broadcastLeaderboard() {
  const data = JSON.stringify({ type: 'leaderboard', data: db.leaderboard.slice(0, 100) });
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(data); });
}

function sendLeaderboard(ws) {
  ws.send(JSON.stringify({ type: 'leaderboard', data: db.leaderboard.slice(0, 100) }));
}

function handleCreateClan(ws, clanName) {
  const player = players.get(ws.playerId);
  if (!player || player.clan) return;
  
  const clanId = generateId();
  db.clans[clanId] = {
    id: clanId, name: clanName, owner: ws.playerId, ownerName: player.name,
    members: [ws.playerId], memberNames: [player.name],
    totalCoins: 0, createdAt: Date.now(), description: ''
  };
  player.clan = clanId;
  db.players[ws.playerId].clan = clanId;
  db.stats.totalClans++;
  ws.send(JSON.stringify({ type: 'clanCreated', clanId, name: clanName }));
  sendClans(ws);
  saveDB();
}

function handleJoinClan(ws, clanId) {
  const clan = db.clans[clanId];
  const player = players.get(ws.playerId);
  if (!clan || !player || player.clan) return;
  if (clan.members.includes(ws.playerId)) return;
  
  clan.members.push(ws.playerId);
  clan.memberNames.push(player.name);
  player.clan = clanId;
  db.players[ws.playerId].clan = clanId;
  ws.send(JSON.stringify({ type: 'joinedClan', clanId, name: clan.name }));
  sendClans(ws);
  sendClanMembers(clanId);
  saveDB();
}

function handleLeaveClan(ws) {
  const player = players.get(ws.playerId);
  if (!player || !player.clan) return;
  
  const clan = db.clans[player.clan];
  if (!clan) { player.clan = null; return; }
  
  if (clan.owner === ws.playerId) {
    if (clan.members.length > 1) {
      const newOwner = clan.members.find(id => id !== ws.playerId);
      clan.owner = newOwner;
      clan.ownerName = players.get(newOwner)?.name || clan.memberNames[1] || 'Unknown';
    } else {
      delete db.clans[player.clan];
      db.stats.totalClans--;
    }
  }
  
  clan.members = clan.members.filter(id => id !== ws.playerId);
  clan.memberNames = clan.memberNames.filter(name => name !== player.name);
  player.clan = null;
  db.players[ws.playerId].clan = null;
  ws.send(JSON.stringify({ type: 'leftClan', clanId: clan.id }));
  sendClans(ws);
  sendClanMembers(clan.id);
  saveDB();
}

function sendClanMembers(clanId) {
  const clan = db.clans[clanId];
  if (!clan) return;
  const membersData = clan.members.map(id => ({
    id, name: db.players[id]?.name || 'Unknown',
    coins: db.players[id]?.coins || 0, isOwner: id === clan.owner
  }));
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      const p = players.get(c.playerId);
      if (p && p.clan === clanId) c.send(JSON.stringify({ type: 'clanMembers', clanId, members: membersData }));
    }
  });
}

function getClanMembers(ws) {
  const player = players.get(ws.playerId);
  if (player && player.clan) sendClanMembers(player.clan);
}

function sendClans(ws) {
  const list = Object.values(db.clans).map(c => ({
    id: c.id, name: c.name, ownerName: c.ownerName,
    memberCount: c.members.length, totalCoins: c.totalCoins
  }));
  ws.send(JSON.stringify({ type: 'clans', data: list }));
}

function handleBuySkill(ws, skillId) {
  const player = players.get(ws.playerId);
  if (!player) return;
  
  const skills = {
    's1': { name: 'Двойной клик', cost: 1000 },
    's2': { name: 'Критический удар', cost: 5000 },
    's3': { name: 'Авто-эффективность', cost: 3000 },
    's4': { name: 'Золотая лихорадка', cost: 2000 },
    's5': { name: 'Мастер клика', cost: 10000 },
    's6': { name: 'Бизнес-косатка', cost: 15000 }
  };
  
  const skill = skills[skillId];
  if (!skill || player.skills[skillId]) return;
  if (player.coins < skill.cost) {
    ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно монет' }));
    return;
  }
  
  player.coins -= skill.cost;
  player.skills[skillId] = true;
  db.players[ws.playerId].coins = player.coins;
  db.players[ws.playerId].skills = player.skills;
  ws.send(JSON.stringify({ type: 'skillBought', skillId, skillName: skill.name }));
  saveDB();
}

// Боксы
const boxPrice = 1700;
const boxRewards = {
  skins: [
    { id: 'chillcat', weight: 15, name: 'Чилл' },
    { id: 'hiding', weight: 20, name: 'Прячущаяся' },
    { id: 'beauty', weight: 12, name: 'Красавица' },
    { id: 'wild', weight: 10, name: 'Дикая' },
    { id: 'cyberpunk', weight: 5, name: 'Киберпанк' },
    { id: 'interesting', weight: 8, name: 'Интересная' }
  ],
  coins: [
    { amount: 500, weight: 40 },
    { amount: 1000, weight: 25 },
    { amount: 2500, weight: 15 },
    { amount: 5000, weight: 8 },
    { amount: 10000, weight: 3 }
  ]
};

function handleBuyBox(ws) {
  const player = players.get(ws.playerId);
  if (!player) return;
  
  if (player.coins < boxPrice) {
    ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно косаток' }));
    return;
  }
  
  player.coins -= boxPrice;
  db.players[ws.playerId].coins = player.coins;
  saveDB();
  
  const boxId = generateId();
  db.players[ws.playerId].pendingBoxes = db.players[ws.playerId].pendingBoxes || [];
  db.players[ws.playerId].pendingBoxes.push(boxId);
  saveDB();
  
  ws.send(JSON.stringify({ type: 'boxBought', boxId }));
}

function handleOpenBox(ws, boxId) {
  const player = players.get(ws.playerId);
  if (!player) return;
  
  const pendingBoxes = db.players[ws.playerId].pendingBoxes || [];
  const boxIndex = pendingBoxes.indexOf(boxId);
  
  if (boxIndex === -1) {
    ws.send(JSON.stringify({ type: 'error', message: 'Бокс не найден' }));
    return;
  }
  
  pendingBoxes.splice(boxIndex, 1);
  db.players[ws.playerId].pendingBoxes = pendingBoxes;
  
  // Определяем тип награды (70% скин, 30% монеты)
  const isSkin = Math.random() < 0.7;
  let reward = {};
  
  if (isSkin) {
    // Выбираем скин по весу
    const totalWeight = boxRewards.skins.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedSkin = boxRewards.skins[0];
    
    for (const skin of boxRewards.skins) {
      random -= skin.weight;
      if (random <= 0) {
        selectedSkin = skin;
        break;
      }
    }
    
    reward = {
      type: 'skin',
      skinId: selectedSkin.id,
      skinName: selectedSkin.name,
      rarity: selectedSkin.weight <= 5 ? 'legendary' : selectedSkin.weight <= 10 ? 'epic' : 'rare'
    };
    
    // Добавляем скин игроку
    db.players[ws.playerId].skins = db.players[ws.playerId].skins || {};
    db.players[ws.playerId].skins[selectedSkin.id] = true;
  } else {
    // Выбираем монеты по весу
    const totalWeight = boxRewards.coins.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedCoins = boxRewards.coins[0];
    
    for (const coin of boxRewards.coins) {
      random -= coin.weight;
      if (random <= 0) {
        selectedCoins = coin;
        break;
      }
    }
    
    reward = {
      type: 'coins',
      amount: selectedCoins.amount,
      rarity: selectedCoins.weight <= 5 ? 'legendary' : selectedCoins.weight <= 10 ? 'epic' : 'rare'
    };
    
    // Добавляем монеты
    db.players[ws.playerId].coins += selectedCoins.amount;
  }
  
  saveDB();
  ws.send(JSON.stringify({ type: 'boxOpened', reward }));
}

process.on('SIGINT', () => {
  saveDB();
  wss.close(() => process.exit(0));
});
