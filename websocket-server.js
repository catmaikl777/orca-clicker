
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

const wsRateLimiter = new WebSocketRateLimiter({ 
  maxConnections: 200, 
  maxMessages: 100, 
  windowMs: 60000,
  bypassTypes: ['click', 'updateScore', 'battleClick'] // Игровые действия не лимитируем строго
});

// ==================== Anti-autoclicker (бан по игроку) ====================
const AUTCLICK = {
  // жесткий порог "человеческого" CPS на длительном отрезке
  maxSustainedCps: 35,
  // если за это окно CPS выше maxSustainedCps — баним
  sustainedWindowMs: 1500,
  // бан после детекта
  banMs: 7 * 24 * 60 * 60 * 1000 // 7 дней
};

function getAntiCheatState(player) {
  if (!player.antiCheat) player.antiCheat = {};
  return player.antiCheat;
}

function isPlayerBanned(playerId) {
  const p = db.players[playerId];
  if (!p) return false;
  const ac = getAntiCheatState(p);
  return typeof ac.bannedUntil === 'number' && ac.bannedUntil > Date.now();
}

function banPlayer(playerId, reason) {
  if (!db.players[playerId]) return;
  const ac = getAntiCheatState(db.players[playerId]);
  ac.bannedUntil = Date.now() + AUTCLICK.banMs;
  ac.banReason = reason || 'autoclicker';
  ac.bannedAt = Date.now();
  saveDB();
  savePlayerToDB(playerId);
}

// Каталог предметов магазина (цены хранятся пер-игрока в db.players[id].shopItems)
const SHOP_CATALOG = [
  { id: 'click1', name: 'Острые зубы', baseCost: 50, type: 'click', value: 1 },
  { id: 'click2', name: 'Акулий хвост', baseCost: 250, type: 'click', value: 5 },
  { id: 'click3', name: 'Китовая сила', baseCost: 1000, type: 'click', value: 25 },
  { id: 'auto1', name: 'Маленькая рыбка', baseCost: 100, type: 'auto', value: 1 },
  { id: 'auto2', name: 'Стая рыб', baseCost: 500, type: 'auto', value: 5 },
  { id: 'auto3', name: 'Косяк тунца', baseCost: 2500, type: 'auto', value: 25 },
  { id: 'auto4', name: 'Океан богатств', baseCost: 10000, type: 'auto', value: 100 },
  { id: 'click4', name: 'Легенда океана', baseCost: 50000, type: 'click', value: 100 },
  { id: 'auto5', name: 'Царство косаток', baseCost: 100000, type: 'auto', value: 500 }
];

function getPlayerShopState(player) {
  if (!player.shopItems || !Array.isArray(player.shopItems)) player.shopItems = [];
  return player.shopItems;
}

function getPlayerItemCost(player, itemId) {
  const catalog = SHOP_CATALOG.find(i => i.id === itemId);
  if (!catalog) return null;
  const state = getPlayerShopState(player);
  const saved = state.find(s => s.id === itemId);
  return saved?.cost ?? catalog.baseCost;
}

function setPlayerItemCost(player, itemId, cost) {
  const state = getPlayerShopState(player);
  const saved = state.find(s => s.id === itemId);
  if (saved) saved.cost = cost;
  else state.push({ id: itemId, cost });
}

// Снимки для проверки "невозможного" CPS по saveGame
const saveSnapshots = new Map(); // playerId -> { t, clicks }

// Трек кликов для CPS по реальным кликам
const clickTrack = new Map(); // playerId -> { times: number[] }
const CLICK_TRACK_WINDOW_MS = 3000;

// Проверка интервалов между кликами (быстрая реакция)
const clickIntervals = new Map(); // playerId -> { lastAt: number, intervals: number[] }
const INTERVAL_WINDOW = 20; // сколько последних интервалов держим
const MIN_HUMAN_INTERVAL_MS = 25; // <25мс сериями — почти всегда автокликер
const MIN_INTERVAL_STREAK = 8; // сколько подряд "слишком быстрых" интервалов для бана
const LOW_VARIANCE_THRESHOLD_MS = 2.5; // слишком ровно = подозрительно

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
let dbSaveTimer = null;
let dbSavePending = false;
let dbSaveLastAt = 0;
const DB_SAVE_DEBOUNCE_MS = 150; // "реальное время" без убийства диска
const DB_SAVE_MAX_WAIT_MS = 1500; // гарантируем сброс даже при спаме

function syncPlayersToDb() {
  // Синхронизируем данные из players в db.players перед сохранением
  players.forEach((player, accountId) => {
    if (db.players[accountId]) {
      db.players[accountId].coins = player.coins;
      db.players[accountId].totalCoins = player.totalCoins;
      db.players[accountId].perClick = player.perClick;
      db.players[accountId].perSecond = player.perSecond;
      db.players[accountId].clicks = player.clicks;
      db.players[accountId].level = player.level;
      db.players[accountId].skills = player.skills;
      db.players[accountId].skins = player.skins;
      db.players[accountId].currentSkin = player.currentSkin;
      db.players[accountId].achievements = player.achievements;
      db.players[accountId].pendingBoxes = player.pendingBoxes;
      db.players[accountId].lastLogin = Date.now();
    }
  });
}

function saveDBNow() {
  try {
    syncPlayersToDb();

    const tmpPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
    try {
      fs.renameSync(tmpPath, DB_PATH); // атомарнее на большинстве FS
    } catch (e) {
      // Windows часто не перезаписывает существующий файл через rename
      try { if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); } catch (_) {}
      fs.renameSync(tmpPath, DB_PATH);
    }
    dbSaveLastAt = Date.now();
    dbSavePending = false;
    console.log('💾 БД сохранена');
  } catch (e) {
    dbSavePending = false;
    console.error('Ошибка сохранения БД:', e.message);
  }
}

// Сохранение "почти в реальном времени": склеиваем частые вызовы в 1 запись
function saveDB() {
  dbSavePending = true;

  const now = Date.now();
  const timeSinceLast = now - dbSaveLastAt;

  // Если давно не сохраняли — пишем сразу
  if (!dbSaveTimer && timeSinceLast >= DB_SAVE_MAX_WAIT_MS) {
    saveDBNow();
    return;
  }

  if (dbSaveTimer) return;

  dbSaveTimer = setTimeout(() => {
    dbSaveTimer = null;
    if (dbSavePending) saveDBNow();
  }, DB_SAVE_DEBOUNCE_MS);
}

// Сохранение одного игрока в PostgreSQL
function savePlayerToDB(accountId) {
  if (!dbAdapter.usePostgreSQL) return;
  const p = db.players[accountId];
  if (!p) return;
  dbAdapter.savePlayer({ ...p, accountId }).catch(e => console.error('Ошибка сохранения игрока:', e.message));
  const acc = db.accounts[accountId];
  if (acc) dbAdapter.saveAccount(acc).catch(() => {});
}

// Инициализация БД
let db = loadDB();

// Инициализация адаптера (PostgreSQL или file-based)
dbAdapter.init().then(async () => {
  console.log('✅ DB адаптер готов');
  if (dbAdapter.usePostgreSQL) {
    // Загружаем аккаунты и игроков из PostgreSQL в память
    try {
      const accounts = await dbAdapter.getAccounts();
      const rows = await dbAdapter.pool.query('SELECT * FROM players');
      db.accounts = {};
      rows.rows.forEach(row => {
        db.accounts[row.account_id] = {
          id: row.account_id,
          username: accounts[row.account_id]?.username || row.name,
          passwordHash: accounts[row.account_id]?.password_hash,
          createdAt: accounts[row.account_id]?.created_at || Date.now(),
          lastLogin: accounts[row.account_id]?.last_login || Date.now()
        };
        db.players[row.id] = {
          id: row.id,
          name: row.name,
          coins: row.coins,
          totalCoins: row.total_coins,
          perClick: row.per_click,
          perSecond: row.per_second,
          clicks: row.clicks,
          level: row.level,
          skills: row.skills || {},
          achievements: row.achievements || [],
          skins: row.skins || { normal: true },
          currentSkin: row.current_skin,
          clan: row.clan,
          eventRewards: row.event_rewards,
          pendingBoxes: row.pending_boxes || [],
          createdAt: row.created_at || Date.now(),
          lastLogin: row.last_login || Date.now()
        };
        updateLeaderboard(db.players[row.id]);
      });
      // Загружаем аккаунты отдельно (у кого нет игрока)
      Object.entries(accounts).forEach(([id, acc]) => {
        db.accounts[id] = {
          id,
          username: acc.username,
          passwordHash: acc.password_hash,
          createdAt: acc.created_at,
          lastLogin: acc.last_login
        };
      });
      // Загружаем eventCoins из PostgreSQL
      const ecRows = await dbAdapter.pool.query('SELECT account_id, coins FROM event_coins');
      ecRows.rows.forEach(row => {
        db.event.eventCoins[row.account_id] = row.coins;
      });
      console.log(`📦 Загружено из PostgreSQL: ${Object.keys(db.accounts).length} аккаунтов, ${Object.keys(db.players).length} игроков, ${ecRows.rows.length} записей ивента`);
    } catch (e) {
      console.error('❌ Ошибка загрузки из PostgreSQL:', e.message);
    }
  }
}).catch(err => console.error('DB adapter init error:', err.message));

// Убедимся что все необходимые поля есть
if (!db.accounts) db.accounts = {};
if (!db.stats) db.stats = { totalBattles: 0, totalClans: 0, totalPlayers: 0 };
if (!db.event) db.event = {};

// Не сбрасываем ивент при каждом рестарте — сохраняем сезон
if (!db.event || !db.event.active) {
  const now = Date.now();
  db.event = {
    active: true,
    startDate: now,
    endDate: now + 14 * 24 * 60 * 60 * 1000,
    eventCoins: {},
    season: 1
  };
} else {
  // Сохраняем существующий ивент
  if (!db.event.eventCoins) db.event.eventCoins = {};
}

console.log('База данных загружена');
console.log(`🎉 Ивент активен! До конца: ${Math.ceil((db.event.endDate - Date.now()) / 60000)} мин.`);

// Хранилище в памяти
const players = new Map();
const battles = new Map();
const waitingPlayers = [];

// Стартовое сохранение после инициализации памяти
saveDB();

// Буфер обновлений для батлов (чтобы не терять обновления при быстрых кликах)
const battleUpdateBuffer = new Map(); // playerId -> { updates: [], lastSend: timestamp }

// Функция добавления обновления в буфер
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

// Функция отправки всех накопленных обновлений
function flushBattleBuffer(playerId) {
  const buffer = battleUpdateBuffer.get(playerId);
  if (!buffer || buffer.updates.length === 0) return;
  
  const player = players.get(playerId);
  if (!player || !player.ws || player.ws.readyState !== WebSocket.OPEN) {
    // Игрок отключился - очищаем буфер
    battleUpdateBuffer.delete(playerId);
    return;
  }
  
  // Отправляем последнее обновление (оно содержит актуальные данные)
  const lastUpdate = buffer.updates[buffer.updates.length - 1];
  player.ws.send(JSON.stringify(lastUpdate));
  
  buffer.updates = [];
  buffer.lastSend = Date.now();
}

// Очистка буфера при отключении
function clearBattleBuffer(playerId) {
  battleUpdateBuffer.delete(playerId);
}

// Автосохранение раз в 2 минуты (только JSON-файл, без PostgreSQL)
setInterval(() => {
  console.log('⏰ Автосохранение...');
  saveDB();
}, 2 * 60 * 1000);

// Периодическая отправка буферов обновлений батла (каждую секунду)
setInterval(() => {
  battleUpdateBuffer.forEach((buffer, playerId) => {
    if (buffer.updates.length > 0) {
      flushBattleBuffer(playerId);
    }
  });
}, 1000);

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
    try {
      const data = JSON.parse(message);
      
      // battleClick никогда не лимитируем - это критично для игры
      if (data.type !== 'battleClick') {
        // Проверяем rate limit только для не-игровых сообщений
        if (!wsRateLimiter.checkMessage(ip, data.type)) {
          // Только логирование для отладки (редко)
          if (Math.random() < 0.01) { // Логировать 1% случаев чтобы не спамить
            console.log(`⚠️ Rate limit для ${data.type} от ${ip}`);
          }
          // Критичные сообщения (auth, save) всё равно обрабатываем
          if (['register', 'authRequest', 'restoreSession', 'saveGame'].includes(data.type)) {
            handleMessage(ws, data);
            return;
          }
          // Для остальных сообщений просто пропускаем без уведомления
          return;
        }
      }
      
      handleMessage(ws, data);
    } catch (e) {
      console.error('Ошибка парсинга:', e);
    }
  });
  
  ws.on('close', () => {
    console.log(`Игрок отключён: ${playerId}`);
    wsRateLimiter.cleanup(ip);
    clearBattleBuffer(playerId); // Очищаем буфер при отключении
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
    case 'click': handleClick(ws, data); break;
    case 'addEventCoins': addEventCoins(ws.accountId || ws.playerId, data.amount); break;
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
    case 'buyItem': handleBuyItem(ws, data.itemId); break;
    case 'buySkin': handleBuySkin(ws, data.skinId); break;
    case 'equipSkin': handleEquipSkin(ws, data.skinId); break;
    case 'buyBox': handleBuyBox(ws); break;
    case 'openBox': handleOpenBox(ws, data.boxId); break;
    case 'saveGame': handleSaveGame(ws, data.data); break;
  }
}

function handleClick(ws, payload) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) return;

  // если уже бан — сразу выкидываем
  if (isPlayerBanned(id)) {
    ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Доступ заблокирован: подозрение на автокликер' }));
    ws.close(1008, 'Autoclicker banned');
    return;
  }

  const now = Date.now();
  const clickTime = typeof payload?.t === 'number' ? payload.t : now;

  // Жёсткие признаки: не-trusted / не в фокусе / вкладка скрыта
  const trusted = payload?.trusted !== undefined ? !!payload.trusted : true;
  const focus = payload?.focus !== undefined ? !!payload.focus : true;
  const vis = typeof payload?.vis === 'string' ? payload.vis : 'visible';
  if (!trusted || !focus || vis !== 'visible') {
    banPlayer(id, `overlay_trusted:${trusted}_focus:${focus}_vis:${vis}`);
    ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Запрещены клики в фоне/через автокликер. Доступ заблокирован.' }));
    ws.close(1008, 'Overlay/autoclicker detected');
    return;
  }

  // 0) Интервалы между кликами
  let it = clickIntervals.get(id);
  if (!it) {
    it = { lastAt: now, intervals: [] };
    clickIntervals.set(id, it);
  } else {
    const dt = now - it.lastAt;
    it.lastAt = now;
    if (dt >= 0 && dt < 60000) { // защита от мусора/паузы
      it.intervals.push(dt);
      if (it.intervals.length > INTERVAL_WINDOW) it.intervals.shift();

      // серия слишком быстрых интервалов
      let fastStreak = 0;
      for (let i = it.intervals.length - 1; i >= 0; i--) {
        if (it.intervals[i] < MIN_HUMAN_INTERVAL_MS) fastStreak++;
        else break;
      }
      if (fastStreak >= MIN_INTERVAL_STREAK) {
        banPlayer(id, `interval_fast_${dt}ms_streak_${fastStreak}`);
        ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Автокликер обнаружен (слишком маленькие интервалы между кликами).' }));
        ws.close(1008, 'Autoclicker interval detected');
        return;
      }

      // слишком ровные интервалы (низкая дисперсия) + достаточно быстрые
      if (it.intervals.length >= 12) {
        const avg = it.intervals.reduce((a, b) => a + b, 0) / it.intervals.length;
        const variance = it.intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / it.intervals.length;
        const stdDev = Math.sqrt(variance);
        if (avg < 60 && stdDev < LOW_VARIANCE_THRESHOLD_MS) {
          banPlayer(id, `interval_uniform_avg_${avg.toFixed(1)}_std_${stdDev.toFixed(1)}`);
          ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Автокликер обнаружен (слишком ровные интервалы кликов).' }));
          ws.close(1008, 'Autoclicker uniform interval detected');
          return;
        }
      }
    }
  }

  // 1) CPS по реальным кликам (скользящее окно)
  let t = clickTrack.get(id);
  if (!t) {
    t = { times: [] };
    clickTrack.set(id, t);
  }
  t.times.push(now);
  // чистим окно
  while (t.times.length && now - t.times[0] > CLICK_TRACK_WINDOW_MS) t.times.shift();
  const cps = (t.times.length * 1000) / CLICK_TRACK_WINDOW_MS;
  // Порог ниже, чтобы автокликер ловился быстро
  const cpsLimit = 18;
  if (cps > cpsLimit) {
    banPlayer(id, `cps_click_${cps.toFixed(1)}`);
    ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Автокликер обнаружен (слишком высокий CPS). Доступ заблокирован.' }));
    ws.close(1008, 'Autoclicker detected');
    return;
  }

  // 2) Паттерны (равномерность/слишком быстрые интервалы)
  if (!analyzeClickPattern(id, clickTime)) {
    banPlayer(id, 'click_pattern');
    ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Автокликер обнаружен. Доступ заблокирован.' }));
    ws.close(1008, 'Autoclicker detected');
  }
}

function handleSaveGame(ws, data) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) return;
  if (isPlayerBanned(id)) {
    ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Доступ заблокирован: подозрение на автокликер' }));
    ws.close(1008, 'Autoclicker banned');
    return;
  }
  const p = db.players[id];
  const mem = players.get(id);
  
  // Проверка "невозможного" CPS по приросту clicks между saveGame
  if (typeof data?.clicks === 'number') {
    const snap = saveSnapshots.get(id);
    const now = Date.now();
    if (snap && typeof snap.clicks === 'number' && typeof snap.t === 'number') {
      const dt = now - snap.t;
      const dClicks = data.clicks - snap.clicks;
      if (dt > 0 && dClicks >= 0) {
        const cps = (dClicks * 1000) / dt;
        if (dt >= AUTCLICK.sustainedWindowMs && cps > AUTCLICK.maxSustainedCps) {
          banPlayer(id, `cps_${cps.toFixed(1)}`);
          ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Автокликер обнаружен (слишком высокий CPS). Доступ заблокирован.' }));
          ws.close(1008, 'Autoclicker detected');
          return;
        }
      }
    }
    saveSnapshots.set(id, { t: Date.now(), clicks: data.clicks });
  }

  p.coins = data.coins ?? p.coins;
  p.totalCoins = data.totalCoins ?? p.totalCoins;
  p.perClick = data.perClick ?? p.perClick;
  p.perSecond = data.perSecond ?? p.perSecond;
  p.clicks = data.clicks ?? p.clicks;
  p.level = data.level ?? p.level;
  p.skills = data.skills || p.skills;
  p.skins = data.skins || p.skins;
  p.currentSkin = data.currentSkin || p.currentSkin;
  p.achievements = data.achievements || p.achievements;
  p.pendingBoxes = data.pendingBoxes || p.pendingBoxes || [];
  p.playTime = data.playTime ?? p.playTime;
  p.shopItems = data.shopItems || p.shopItems;
  p.questProgress = data.questProgress || p.questProgress;
  p.lastLogin = Date.now();
  if (mem) Object.assign(mem, p);
  
  updateLeaderboard(p);
  saveDB();
  savePlayerToDB(id);
  console.log('💾 Автосохранение:', id);
}

function sendEventInfo(ws) {
  const id = ws.accountId || ws.playerId;
  ws.send(JSON.stringify({ 
    type: 'eventInfo',
    event: {
      active: db.event.active,
      endDate: db.event.endDate,
      season: db.event.season,
      eventCoins: db.event.eventCoins[id] || 0,
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
  handleAuthRegister(ws, { username, password }, db, players, saveDB, broadcastEventInfo, broadcastLeaderboard, updateLeaderboard, savePlayerToDB);
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
  savePlayerToDB(accountId);
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
    ws.send(JSON.stringify({ type: 'sessionExpired', message: 'Войдите снова' }));
    return;
  }

  // Бан по античиту — не пускаем в игру
  if (db.players[accountId] && isPlayerBanned(accountId)) {
    ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Доступ заблокирован: автокликер/бот' }));
    ws.close(1008, 'Autoclicker banned');
    return;
  }
  
  // Аккаунт не найден — БД была сброшена (Render), просим перелогиниться
  if (!db.accounts || !db.accounts[accountId]) {
    ws.send(JSON.stringify({ type: 'sessionExpired', message: 'Сессия истекла, войдите снова' }));
    return;
  }
  
  let playerData = db.players[accountId];
  if (!playerData) {
    playerData = createDefaultPlayer(accountId, username || 'Player');
    db.players[accountId] = playerData;
  }
  
  playerData.lastLogin = Date.now();
  db.accounts[accountId].lastLogin = Date.now();
  ws.authenticated = true;
  ws.accountId = accountId;
  players.set(accountId, { ...playerData, ws });
  updateLeaderboard(playerData);
  saveDB();
  savePlayerToDB(accountId);

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
}

// ==================== Регистрация гостя ====================

function handleRegisterGuest(ws, name) {
  const playerId = ws.playerId;
  let playerData = db.players[playerId];

  // если гостевой id уже забанен — не пускаем
  if (playerData && isPlayerBanned(playerId)) {
    ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Доступ заблокирован: автокликер/бот' }));
    ws.close(1008, 'Autoclicker banned');
    return;
  }
  
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
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player || !db.players[id]) return;
  
  // Проверка паттерна кликов (отличает людей от ботов)
  if (!analyzeClickPattern(id, Date.now())) {
    console.log(`🚨 Anti-bot: Данные отклонены для игрока ${id}`);
    return;
  }
  
  // Обновляем в памяти
  player.coins = coins;
  if (perClick) player.perClick = perClick;
  if (perSecond) player.perSecond = perSecond;
  
  // Обновляем в БД (синхронизируем ВСЕ поля)
  db.players[id].coins = coins;
  db.players[id].totalCoins = Math.max(db.players[id].totalCoins || 0, coins);
  if (perClick) db.players[id].perClick = perClick;
  if (perSecond) db.players[id].perSecond = perSecond;
  
  updateLeaderboard(player);
  saveDB(); // Сохраняем сразу
  savePlayerToDB(id);
}

// Добавление eventCoins
function addEventCoins(playerId, amount) {
  if (!db.event.eventCoins[playerId]) db.event.eventCoins[playerId] = 0;
  db.event.eventCoins[playerId] += amount;
  if (dbAdapter.usePostgreSQL) {
    dbAdapter.saveEventCoins(playerId, db.event.eventCoins[playerId]).catch(() => {});
  }
  saveDB();
}

function handleFindBattle(ws) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player) return;
  if (waitingPlayers.length > 0 && waitingPlayers[0] !== id) {
    startBattle(id, waitingPlayers.shift());
  } else {
    waitingPlayers.push(id);
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
    type: 'battleStart', 
    battleId,
    opponent: player2.name,
    yourPerSecond: player1.perSecond || 0,
    opponentPerSecond: player2.perSecond || 0,
    yourSkin: player1.currentSkin || 'normal',
    opponentSkin: player2.currentSkin || 'normal',
    duration: 30000
  };
  
  player1.ws.send(JSON.stringify(battleData));
  battleData.opponent = player1.name;
  battleData.yourPerSecond = player2.perSecond || 0;
  battleData.opponentPerSecond = player1.perSecond || 0;
  battleData.yourSkin = player2.currentSkin || 'normal';
  battleData.opponentSkin = player1.currentSkin || 'normal';
  player2.ws.send(JSON.stringify(battleData));
  
  setTimeout(() => endBattle(battleId), 30000);
}

function handleBattleClick(ws, battleId, clicks, cps) {
  const battle = battles.get(battleId);
  if (!battle) return;
  
  const id = ws.accountId || ws.playerId;
  
  // Проверка на автокликер для батлов
  if (!checkAntiCheat(id)) {
    console.log(`🚨 Anti-cheat: Батл клик отклонен для игрока ${id}`);
    return;
  }
  
  // Лимит CPS для батлов (максимум 100 кликов в секунду)
  if (cps > 100) {
    console.log(`🚨 Anti-cheat: CPS ${cps} слишком высокий для игрока ${id}`);
    return;
  }
  
  const oldScore = battle.scores[id] || 0;
  battle.scores[id] = oldScore + clicks;
  if (cps !== undefined) battle.cps[id] = cps;
  
  // Считаем новые eventCoins на основе общего прогресса (не за один клик)
  const newEventCoinsEarned = Math.floor(battle.scores[id] / 10);
  const oldEventCoins = Math.floor(oldScore / 10);
  const eventCoinsDiff = newEventCoinsEarned - oldEventCoins;
  
  if (eventCoinsDiff > 0) {
    addEventCoins(id, eventCoinsDiff);
  }
  
  const opponentId = battle.players.find(pid => pid !== id);
  const opponent = players.get(opponentId);
  
  // Создаем данные обновления
  const updateData = {
    type: 'battleUpdate',
    yourScore: battle.scores[id],
    opponentScore: battle.scores[opponentId],
    yourCPS: battle.cps[id] || 0,
    opponentCPS: battle.cps[opponentId] || 0,
    eventCoinsEarned: eventCoinsDiff
  };
  
  const opponentUpdateData = {
    type: 'battleUpdate',
    yourScore: battle.scores[opponentId],
    opponentScore: battle.scores[id],
    yourCPS: battle.cps[opponentId] || 0,
    opponentCPS: battle.cps[id] || 0,
    eventCoinsEarned: 0
  };
  
  // Добавляем в буфер для отправки
  bufferBattleUpdate(id, updateData);
  if (opponent) {
    bufferBattleUpdate(opponentId, opponentUpdateData);
  }
}

function endBattle(battleId, disconnectedPlayer = null) {
  const battle = battles.get(battleId);
  if (!battle) return;
  
  // Отправляем все накопленные обновления перед завершением
  battle.players.forEach(pid => flushBattleBuffer(pid));
  
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
  
  // Очищаем буферы после окончания батла
  clearBattleBuffer(p1);
  clearBattleBuffer(p2);
  
  battles.delete(battleId);
}

function updateLeaderboard(player) {
  if (!player || !player.id) return;
  const idx = db.leaderboard.findIndex(p => p.id === player.id);
  const entry = { id: player.id, name: player.name, coins: player.coins || 0, perSecond: player.perSecond || 0, level: player.level || 1 };
  if (idx >= 0) db.leaderboard[idx] = entry;
  else db.leaderboard.push(entry);
  db.leaderboard.sort((a, b) => b.coins - a.coins);
  if (db.leaderboard.length > 100) db.leaderboard.length = 100;
}

function broadcastLeaderboard() {
  const data = JSON.stringify({ type: 'leaderboard', data: db.leaderboard.slice(0, 100) });
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(data); });
}

function sendLeaderboard(ws) {
  // Перестраиваем лидерборд из текущих данных игроков
  db.leaderboard = Object.values(db.players)
    .filter(p => p && p.id && p.name)
    .map(p => ({ id: p.id, name: p.name, coins: p.coins || 0, perSecond: p.perSecond || 0, level: p.level || 1 }))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 100);
  ws.send(JSON.stringify({ type: 'leaderboard', data: db.leaderboard }));
}

function handleCreateClan(ws, clanName) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player || player.clan) return;
  
  const clanId = generateId();
  db.clans[clanId] = {
    id: clanId, name: clanName, owner: id, ownerName: player.name,
    members: [id], memberNames: [player.name],
    totalCoins: 0, createdAt: Date.now(), description: ''
  };
  player.clan = clanId;
  db.players[id].clan = clanId;
  db.stats.totalClans++;
  ws.send(JSON.stringify({ type: 'clanCreated', clanId, name: clanName }));
  sendClans(ws);
  saveDB();
}

function handleJoinClan(ws, clanId) {
  const id = ws.accountId || ws.playerId;
  const clan = db.clans[clanId];
  const player = players.get(id);
  if (!clan || !player || player.clan) return;
  if (clan.members.includes(id)) return;
  
  clan.members.push(id);
  clan.memberNames.push(player.name);
  player.clan = clanId;
  db.players[id].clan = clanId;
  ws.send(JSON.stringify({ type: 'joinedClan', clanId, name: clan.name }));
  sendClans(ws);
  sendClanMembers(clanId);
  saveDB();
}

function handleLeaveClan(ws) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player || !player.clan) return;
  
  const clan = db.clans[player.clan];
  if (!clan) { player.clan = null; return; }
  
  if (clan.owner === id) {
    if (clan.members.length > 1) {
      const newOwner = clan.members.find(mid => mid !== id);
      clan.owner = newOwner;
      clan.ownerName = players.get(newOwner)?.name || 'Unknown';
    } else {
      delete db.clans[player.clan];
      db.stats.totalClans--;
    }
  }
  
  clan.members = clan.members.filter(mid => mid !== id);
  clan.memberNames = clan.memberNames.filter(n => n !== player.name);
  player.clan = null;
  db.players[id].clan = null;
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
      const cid = c.accountId || c.playerId;
      const p = players.get(cid);
      if (p && p.clan === clanId) c.send(JSON.stringify({ type: 'clanMembers', clanId, members: membersData }));
    }
  });
}

function getClanMembers(ws) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
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
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) return;
  const p = db.players[id];
  const mem = players.get(id);
  const coins = mem ? mem.coins : p.coins;
  
  const skills = {
    's1': { name: 'Двойной клик', cost: 1000 },
    's2': { name: 'Критический удар', cost: 5000 },
    's3': { name: 'Авто-эффективность', cost: 3000 },
    's4': { name: 'Золотая лихорадка', cost: 2000 },
    's5': { name: 'Мастер клика', cost: 10000 },
    's6': { name: 'Бизнес-косатка', cost: 15000 }
  };
  
  const skill = skills[skillId];
  if (!skill || p.skills[skillId]) return;
  if (coins < skill.cost) {
    ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно монет' }));
    return;
  }
  
  p.coins = coins - skill.cost;
  p.skills[skillId] = true;
  if (mem) { mem.coins = p.coins; mem.skills = p.skills; }
  
  saveDB();
  savePlayerToDB(id);
  
  ws.send(JSON.stringify({ 
    type: 'skillBought', 
    skillId, 
    skillName: skill.name 
  }));
  
  console.log(`⭐ Игрок ${id} купил навык: ${skill.name}`);
}

// Покупка предмета в магазине
function handleBuyItem(ws, itemId) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) return;
  
  const p = db.players[id];
  const mem = players.get(id);
  const coins = mem ? mem.coins : p.coins;
  
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) return;
  const itemCost = getPlayerItemCost(p, itemId);
  if (itemCost === null) return;
  
  if (coins < itemCost) {
    ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно монет' }));
    return;
  }
  
  // Списываем монеты
  p.coins = coins - itemCost;
  if (mem) mem.coins = p.coins;
  
  // Применяем улучшения
  if (item.type === 'click') p.perClick += item.value;
  if (item.type === 'auto') p.perSecond += item.value;
  
  // Увеличиваем цену (пер-игрока)
  const newCost = Math.floor(itemCost * 1.2);
  setPlayerItemCost(p, itemId, newCost);
  
  saveDB();
  savePlayerToDB(id);
  
  ws.send(JSON.stringify({ 
    type: 'itemBought',
    itemId: item.id,
    itemName: item.name,
    coins: p.coins,
    perClick: p.perClick,
    perSecond: p.perSecond,
    itemCost: newCost
  }));
  
  console.log(`🛒 Игрок ${id} купил предмет: ${item.name}`);
}

// Покупка скина
function handleBuySkin(ws, skinId) {
  // По просьбе: скины НЕ покупаются за монеты — только выбиваются из бокса
  ws.send(JSON.stringify({ type: 'error', message: 'Скины можно получить только из ящика' }));
}

// Надевание скина
function handleEquipSkin(ws, skinId) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) return;
  
  const p = db.players[id];
  const mem = players.get(id);
  
  // Проверяем что скин открыт
  if (!p.skins || !p.skins[skinId]) return;
  
  p.currentSkin = skinId;
  if (mem) mem.currentSkin = skinId;
  
  saveDB();
  savePlayerToDB(id);
  
  ws.send(JSON.stringify({ 
    type: 'skinEquipped',
    skinId: skinId
  }));
  
  console.log(`🎨 Игрок ${id} надел скин: ${skinId}`);
}

// Боксы
const boxPrice = 1700;

// ==================== ЗАЩИТА ОТ БОТОВ (умная) ====================
// Отличает людей от ботов по паттернам кликов
const clickAnalysis = new Map(); // accountId -> { times: [], lastCheck: }

function analyzeClickPattern(accountId, clickTime) {
  let data = clickAnalysis.get(accountId);
  
  if (!data) {
    data = { times: [clickTime], lastCheck: clickTime };
    clickAnalysis.set(accountId, data);
    return true; // Первый клик всегда разрешён
  }
  
  // Добавляем время клика
  data.times.push(clickTime);
  
  // Анализируем каждые 50 кликов
  if (data.times.length >= 50) {
    const now = Date.now();
    const timeSpan = now - data.times[0];
    
    // Если 50 кликов за меньше чем 0.5 секунды - это скорее всего бот
    if (timeSpan < 500) {
      const avgInterval = timeSpan / 49;
      // Люди не могут кликать с интервалом меньше 5-7 мс стабильно
      // Боты имеют слишком равномерные интервалы
      if (avgInterval < 10) {
        console.log(`🚨 Anti-bot: Игрок ${accountId} - подозрительный паттерн (avg ${avgInterval.toFixed(1)}ms)`);
        data.times = []; // Сброс для повторной проверки
        return false;
      }
    }
    
    // Проверка на равномерность интервалов (боты кликают слишком ровно)
    if (data.times.length >= 20) {
      const intervals = [];
      for (let i = 1; i < data.times.length; i++) {
        intervals.push(data.times[i] - data.times[i-1]);
      }
      
      // Считаем дисперсию интервалов
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      // Люди имеют высокую вариативность (stdDev > 15), боты низкую (stdDev < 5)
      if (stdDev < 5 && avg < 20) {
        console.log(`🚨 Anti-bot: Игрок ${accountId} - слишком равномерные клики (stdDev: ${stdDev.toFixed(1)}ms)`);
        data.times = [];
        return false;
      }
    }
    
    // Очищаем старые данные
    data.times = data.times.filter(t => now - t < 2000);
    data.lastCheck = now;
  }
  
  // Очистка старых записей каждые 10 секунд
  if (Date.now() - data.lastCheck > 10000) {
    clickAnalysis.delete(accountId);
  }
  
  return true;
}
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
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Игрок не найден' }));
    return;
  }
  
  const playerDB = db.players[id];
  const playerMem = players.get(id);
  
  // Берем актуальные данные из памяти если есть
  const coins = playerMem ? playerMem.coins : playerDB.coins;
  
  if (coins < boxPrice) {
    ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно косаток' }));
    return;
  }
  
  // Вычитаем деньги
  playerDB.coins = coins - boxPrice;
  if (playerMem) {
    playerMem.coins = playerDB.coins;
  }
  
  // Добавляем бокс
  if (!playerDB.pendingBoxes) {
    playerDB.pendingBoxes = [];
  }
  const boxId = generateId();
  playerDB.pendingBoxes.push(boxId);
  
  // Синхронизируем pendingBoxes в памяти
  if (playerMem) {
    playerMem.pendingBoxes = [...playerDB.pendingBoxes];
  }
  
  // Сохраняем СРАЗУ в БД
  saveDB();
  savePlayerToDB(id);
  
  // Отправляем подтверждение с актуальными данными
  ws.send(JSON.stringify({ 
    type: 'boxBought', 
    boxId,
    coins: playerDB.coins,
    pendingBoxes: playerDB.pendingBoxes.length // ✅ Количество боксов
  }));
  
  console.log(`📦 Игрок ${id} купил бокс. Всего боксов: ${playerDB.pendingBoxes.length}`);
}

function handleOpenBox(ws, boxId) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Игрок не найден' }));
    return;
  }
  
  const playerDB = db.players[id];
  const playerMem = players.get(id);
  const pendingBoxes = playerDB.pendingBoxes || [];
  const boxIndex = pendingBoxes.indexOf(boxId);
  
  if (boxIndex === -1) {
    ws.send(JSON.stringify({ type: 'error', message: 'Бокс не найден' }));
    return;
  }
  
  // Удаляем бокс
  pendingBoxes.splice(boxIndex, 1);
  playerDB.pendingBoxes = pendingBoxes;
  
  // Синхронизируем в памяти
  if (playerMem) {
    playerMem.pendingBoxes = [...pendingBoxes];
  }
  
  const isSkin = Math.random() < 0.7;
  let reward = {};
  
  if (isSkin) {
    const totalWeight = boxRewards.skins.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedSkin = boxRewards.skins[0];
    for (const skin of boxRewards.skins) {
      random -= skin.weight;
      if (random <= 0) { selectedSkin = skin; break; }
    }
    reward = {
      type: 'skin', skinId: selectedSkin.id, skinName: selectedSkin.name,
      rarity: selectedSkin.weight <= 5 ? 'legendary' : selectedSkin.weight <= 10 ? 'epic' : 'rare'
    };
    playerDB.skins = playerDB.skins || {};
    playerDB.skins[selectedSkin.id] = true;
    if (playerMem) playerMem.skins = playerDB.skins;
  } else {
    const totalWeight = boxRewards.coins.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedCoins = boxRewards.coins[0];
    for (const coin of boxRewards.coins) {
      random -= coin.weight;
      if (random <= 0) { selectedCoins = coin; break; }
    }
    reward = {
      type: 'coins', amount: selectedCoins.amount,
      rarity: selectedCoins.weight <= 5 ? 'legendary' : selectedCoins.weight <= 10 ? 'epic' : 'rare'
    };
    playerDB.coins += selectedCoins.amount;
    if (playerMem) playerMem.coins = playerDB.coins;
  }
  
  // Сохраняем СРАЗУ
  saveDB();
  savePlayerToDB(id);
  
  // Отправляем подтверждение с актуальным количеством боксов
  ws.send(JSON.stringify({ 
    type: 'boxOpened', 
    reward,
    pendingBoxes: playerDB.pendingBoxes.length // ✅ Актуальное количество
  }));
  
  console.log(`🎁 Игрок ${id} открыл бокс. Награда: ${reward.type}. Всего боксов: ${playerDB.pendingBoxes.length}`);
}

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT получен, сохраняем данные...');
  saveDB();
  wss.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM получен (Render shutdown), сохраняем данные...');
  saveDB();
  wss.close(() => process.exit(0));
});
