
// ============================================
// WebSocket сервер для Кошка-косатка Кликер
// PostgreSQL - единственный источник истины
// ============================================

const WebSocket = require('ws');
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
  // Проверяем бан в памяти или в БД
  if (typeof ac.bannedUntil === 'number' && ac.bannedUntil > Date.now()) return true;
  // Если бан сохранён в БД (bannedAt есть), проверяем
  if (typeof ac.bannedAt === 'number' && dbAdapter.usePostgreSQL) {
    // Бан permanent (не временный) - проверяем по bannedAt
    if (!ac.bannedUntil || ac.bannedUntil <= Date.now()) {
      // Permanent ban - если есть bannedAt, значит забанен навсегда
      return true;
    }
  }
  return false;
}

function banPlayer(playerId, reason) {
  if (!db.players[playerId]) return;
  const ac = getAntiCheatState(db.players[playerId]);
  // Permanent ban (навсегда)
  ac.bannedUntil = Infinity; // Никогда не истекает
  ac.banReason = reason || 'autoclicker';
  ac.bannedAt = Date.now();
  
  // Сохраняем в БД
  savePlayerToDB(playerId);
  if (dbAdapter.usePostgreSQL && dbAdapter.initialized) {
    dbAdapter.saveBan(playerId, reason).catch(e => console.error('Ошибка сохранения бана:', e.message));
  }
}

// Сохранение клана в PostgreSQL
function saveClanToDB(clanId) {
  if (!dbAdapter.usePostgreSQL) return;
  if (!dbAdapter.initialized) return;
  const clan = db.clans[clanId];
  if (!clan) return;
  dbAdapter.saveClan(clan).catch(e => console.error('Ошибка сохранения клана:', e.message));
}

// Удаление клана из PostgreSQL
function deleteClanFromDB(clanId) {
  if (!dbAdapter.usePostgreSQL) return;
  if (!dbAdapter.initialized) return;
  dbAdapter.deleteClan(clanId).catch(e => console.error('Ошибка удаления клана:', e.message));
}

// Сохранение одного игрока в PostgreSQL
function savePlayerToDB(accountId) {
  if (!dbAdapter.usePostgreSQL) return;
  if (!dbAdapter.initialized) return; // Адаптер ещё не инициализирован
  const p = db.players[accountId];
  if (!p) return;
  
  // Проверяем что это зарегистрированный игрок (есть в accounts)
  const acc = db.accounts[accountId];
  const isRegistered = !!acc;
  
  // Лог для отладки
  console.log(`💾 savePlayerToDB: id=${accountId}, name=${p.name}, isRegistered=${isRegistered}`);
  
  // Если игрок зарегистрирован но аккаунт ещё не сохранён в БД - сохраняем сначала
  if (isRegistered && acc) {
    // Сохраняем аккаунт НЕ awaiting (чтобы не блокировать)
    dbAdapter.saveAccount(acc).catch(e => console.error('Ошибка сохранения аккаунта:', e.message));
  }
  
  // Затем сохраняем игрока
  dbAdapter.savePlayer({ 
    ...p, 
    accountId: isRegistered ? accountId : null, // Только зарегистрированные игроки имеют accountId
    id: accountId // id всегда есть
  }).catch(e => console.error('Ошибка сохранения игрока:', e.message));
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

// Трек кликов для CPS по реальным кликам
const clickTrack = new Map(); // playerId -> { times: number[] }
const CLICK_TRACK_WINDOW_MS = 3000;

// Проверка интервалов между кликами (быстрая реакция)
const clickIntervals = new Map(); // playerId -> { lastAt: number, intervals: number[] }
const INTERVAL_WINDOW = 20; // сколько последних интервалов держим
const MIN_HUMAN_INTERVAL_MS = 25; // <25мс сериями — почти всегда автокликер
const MIN_INTERVAL_STREAK = 8; // сколько подряд "слишком быстрых" интервалов для бана
const LOW_VARIANCE_THRESHOLD_MS = 2.5; // слишком ровно = подозрительно

// Снимки для проверки CPS
const saveSnapshots = new Map(); // playerId -> { t, clicks }

// Хранилище в памяти (только для онлайн игроков)
const players = new Map();
const battles = new Map();
const waitingPlayers = [];

// Данные игроков (загружаются из PostgreSQL при необходимости)
const now = Date.now();
let db = {
  players: {},
  clans: {},
  leaderboard: [],
  stats: { totalBattles: 0, totalClans: 0, totalPlayers: 0 },
  accounts: {},
  event: { 
    eventCoins: {}, 
    active: true, 
    season: 1,
    startDate: now,
    endDate: now + 14 * 24 * 60 * 60 * 1000 // 2 недели
  }
};

// Буфер обновлений для батлов (чтобы не терять обновления при быстрых кликах)
const battleUpdateBuffer = new Map(); // playerId -> { updates: [], lastSend: timestamp }

// Лобби для батлов
const battleLobbies = new Map(); // lobbyId -> { id, owner, ownerName, opponent, opponentName, status, createdAt }
const lobbyWaitingPlayers = new Map(); // playerId -> lobbyId (игрок в очереди на вступление)

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
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      const clientId = client.accountId || client.playerId;
      // Отправляем персональные eventCoins каждому игроку
      const playerEventCoins = db.event.eventCoins?.[clientId] || 0;
      client.send(JSON.stringify({
        type: 'eventInfo',
        event: {
          active: db.event.active,
          endDate: db.event.endDate,
          season: db.event.season,
          eventCoins: playerEventCoins,
          topPlayers: Object.entries(db.event.eventCoins || {})
            .map(([pid, coins]) => ({ 
              id: pid, 
              name: db.players[pid]?.name || 'Player', 
              coins 
            }))
            .sort((a, b) => b.coins - a.coins)
            .slice(0, 10)
        }
      }));
      console.log(`📤 Отправлено eventInfo игроку ${clientId}: eventCoins=${playerEventCoins}`);
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
  
  // Инициализация данных из PostgreSQL
  if (dbAdapter.usePostgreSQL) {
    dbAdapter.init().then(async () => {
      console.log('✅ PostgreSQL инициализирован');
      try {
        // Загрузить игроков
        const rows = await dbAdapter.pool.query('SELECT * FROM players');
        rows.rows.forEach(row => {
          db.players[row.id] = {
            id: row.id,
            name: row.name,
            coins: row.coins || 0,
            totalCoins: row.total_coins || 0,
            perClick: row.per_click || 1,
            perSecond: row.per_second || 0,
            clicks: row.clicks || 0,
            level: row.level || 1,
            skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills || {},
            achievements: typeof row.achievements === 'string' ? JSON.parse(row.achievements) : row.achievements || [],
            skins: typeof row.skins === 'string' ? JSON.parse(row.skins) : row.skins || { normal: true },
            currentSkin: row.current_skin || 'normal',
            clan: typeof row.clan === 'string' ? JSON.parse(row.clan) : row.clan || null,
            eventRewards: row.event_rewards || 0,
            pendingBoxes: typeof row.pending_boxes === 'string' ? JSON.parse(row.pending_boxes) : row.pending_boxes || [],
            createdAt: row.created_at || Date.now(),
            lastLogin: row.last_login || Date.now(),
            antiCheat: null // Загрузим баны ниже
          };
          // Восстановить бан если есть
          if (row.banned_at) {
            db.players[row.id].antiCheat = {
              bannedUntil: Infinity,
              banReason: row.ban_reason || 'autoclicker',
              bannedAt: row.banned_at
            };
          }
        });
        
        // Загрузить аккаунты
        const accRows = await dbAdapter.pool.query('SELECT * FROM accounts');
        accRows.rows.forEach(row => {
          db.accounts[row.id] = {
            id: row.id,
            username: row.username,
            passwordHash: row.password_hash,
            createdAt: row.created_at,
            lastLogin: row.last_login
          };
        });
        
        // Загрузить баны из отдельной таблицы
        const bans = await dbAdapter.getBans();
        Object.entries(bans).forEach(([playerId, banData]) => {
          if (db.players[playerId]) {
            db.players[playerId].antiCheat = {
              bannedUntil: Infinity,
              banReason: banData.reason,
              bannedAt: banData.bannedAt
            };
          }
        });
        
        // Загрузить eventCoins из таблицы event_coins
        const eventCoins = await dbAdapter.getAllEventCoins();
        db.event.eventCoins = eventCoins;
        
        // Загрузить кланы
        const clans = await dbAdapter.getAllClans();
        clans.forEach(clan => {
          db.clans[clan.id] = clan;
        });
        db.stats.totalClans = clans.length;

        console.log(`📦 Загружено: ${Object.keys(db.players).length} игроков, ${Object.keys(db.accounts).length} аккаунтов, ${Object.keys(bans).length} банов, ${Object.keys(eventCoins).length} eventCoins, ${clans.length} кланов`);
      } catch (e) {
        console.error('❌ Ошибка загрузки из PostgreSQL:', e.message);
      }
    }).catch(err => console.error('DB init error:', err.message));
  } else {
    console.log('ℹ️ File-based database (database.json)');
  }
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
    
    // Удаляем из лобби при отключении
    for (const [lobbyId, lobby] of battleLobbies) {
      if (lobby.owner === playerId || lobby.opponent === playerId) {
        // Уведомляем другого игрока если есть
        const otherId = lobby.owner === playerId ? lobby.opponent : lobby.owner;
        if (otherId) {
          const otherWs = players.get(otherId)?.ws;
          if (otherWs && otherWs.readyState === WebSocket.OPEN) {
            otherWs.send(JSON.stringify({
              type: 'opponentDisconnected',
              lobbyId
            }));
          }
        }
        battleLobbies.delete(lobbyId);
      }
    }
    
    for (const [battleId, battle] of battles) {
      if (battle.players.includes(playerId)) endBattle(battleId, playerId);
    }
    const idx = waitingPlayers.indexOf(playerId);
    if (idx > -1) waitingPlayers.splice(idx, 1);
    
    // Обновляем список лобби
    broadcastBattleLobbies();
  });
});

function handleMessage(ws, data) {
  const id = ws.accountId || ws.playerId;
  
  // Лог для отладки
  if (data.type === 'createClan' || data.type === 'joinClan') {
    console.log(`📋 Clan action: ${data.type} by ${id}, db.players[id]=${!!db.players[id]}, players.has=${players.has(id)}`);
  }
  
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
    case 'createBattleLobby': handleCreateBattleLobby(ws); break;
    case 'joinBattleLobby': handleJoinBattleLobby(ws, data.lobbyId); break;
    case 'leaveBattleLobby': handleLeaveBattleLobby(ws); break;
    case 'getBattleLobbies': handleGetBattleLobbies(ws); break;
    case 'battleClick': handleBattleClick(ws, data.battleId, data.clicks, data.cps); break;
    case 'getLeaderboard': sendLeaderboard(ws); break;
    case 'createClan': handleCreateClan(ws, data.name); break;
    case 'joinClan': handleJoinClan(ws, data.clanId); break;
    case 'leaveClan': handleLeaveClan(ws); break;
    case 'deleteClan': handleDeleteClan(ws, data.clanId); break;
    case 'getClans': sendClans(ws); break;
    case 'startBattleFromLobby': handleStartBattleFromLobby(ws, data.lobbyId); break;
    case 'getClanMembers': getClanMembers(ws); break;
    case 'buyEffect': handleBuyEffect(ws, data.effectId); break;
    case 'buyItem': handleBuyItem(ws, data.itemId); break;
    case 'buySkin': handleBuySkin(ws, data.skinId); break;
    case 'equipSkin': handleEquipSkin(ws, data.skinId); break;
    case 'buyBox': handleBuyBox(ws); break;
    case 'openBox': handleOpenBox(ws, data.boxId); break;
    case 'saveGame': handleSaveGame(ws, data.data); break;
    case 'forceSaveAll': handleForceSaveAll(ws); break;
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

  // Адаптированные проверки для мобильных устройств
  const trusted = payload?.trusted !== undefined ? !!payload.trusted : true;
  const focus = payload?.focus !== undefined ? !!payload.focus : true;
  const vis = typeof payload?.vis === 'string' ? payload.vis : 'visible';
  
  // На мобильных устройствах ослабляем trusted/focus/vis проверки
  const isMobile = payload?.isMobile === true || (payload?.userAgent || '').includes('Mobi');
  
  if (!isMobile) {
    // Для десктопа - строгие проверки trusted/focus/vis
    if (!trusted || !focus || vis !== 'visible') {
      banPlayer(id, `overlay_trusted:${trusted}_focus:${focus}_vis:${vis}`);
      ws.send(JSON.stringify({ type: 'autoclickerBlocked', message: 'Запрещены клики в фоне/через автокликер. Доступ заблокирован.' }));
      ws.close(1008, 'Overlay/autoclicker detected');
      return;
    }
  }
  // Для мобильных - пропускаем trusted/focus/vis, но проверяем CPS и паттерны
  
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
  
  // 3) Начисляем eventCoins за клики (1 билет за 100 кликов)
  const player = db.players[id];
  
  // Инициализируем _pendingEventClicks если нет (для старых игроков)
  if (typeof player._pendingEventClicks !== 'number') {
    player._pendingEventClicks = 0;
    console.log(`📋 Инициализировано _pendingEventClicks=0 для ${id}`);
  }
  
  // Проверка что clicks не уменьшается (защита от читеров)
  const newClicks = typeof payload.clicks === 'number' ? payload.clicks : (player.clicks || 0);
  const lastProcessedClicks = player._lastProcessedClicks || 0;
  
  // Если clicks меньше чем было раньше - игнорируем (возможно читерство)
  if (newClicks < lastProcessedClicks) {
    console.warn(`⚠️ Подозрение: clicks уменьшились для ${id}: ${lastProcessedClicks} → ${newClicks}`);
    return;
  }
  
  const clicksSinceLastCheck = Math.max(0, newClicks - lastProcessedClicks);
  
  console.log(`🔍 Click check: id=${id}, lastProcessed=${lastProcessedClicks}, newClicks=${newClicks}, clicksSinceLast=${clicksSinceLastCheck}, pending=${player._pendingEventClicks}`);
  
  // Добавляем новые клики к pending
  player._pendingEventClicks += clicksSinceLastCheck;
  
  if (player._pendingEventClicks >= 100) {
    const ticketsEarned = Math.floor(player._pendingEventClicks / 100);
    const usedClicks = ticketsEarned * 100;
    console.log(`🎫 Начисление билетов: ${ticketsEarned} за ${usedClicks} кликов (pending было ${player._pendingEventClicks})`);
    addEventCoins(id, ticketsEarned);
    // Вычитаем использованные клики из pending
    player._pendingEventClicks -= usedClicks;
    console.log(`🎫 Игрок ${id} получил ${ticketsEarned} билетов. Всего: ${db.event.eventCoins[id]}, pending осталось: ${player._pendingEventClicks}`);
    console.log(`📢 Вызов broadcastEventInfo()`);
    // Отправляем обновлённые данные ивента всем игрокам
    broadcastEventInfo();
  }
  
  // Сохраняем последний обработанный клик
  player._lastProcessedClicks = newClicks;
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
  if (data.dailyQuestDate) p.dailyQuestDate = data.dailyQuestDate;
  if (Array.isArray(data.dailyQuestIds) && data.dailyQuestIds.length > 0) p.dailyQuestIds = data.dailyQuestIds;
  if (data.clan !== undefined) p.clan = data.clan;
  p.lastLogin = Date.now();
  if (mem) Object.assign(mem, p);
  
  updateLeaderboard(p);
  savePlayerToDB(id);
  console.log('💾 Автосохранение:', id);
}
  
// Принудительное сохранение ВСЕх данных игрока и клана
function handleForceSaveAll(ws) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Игрок не найден' }));
    return;
  }
  
  const p = db.players[id];
  const mem = players.get(id);
  
  // Сохраняем игрока
  savePlayerToDB(id);
  
  // Сохраняем клан если игрок в клане
  if (p.clan) {
    saveClanToDB(p.clan);
  }
  
  console.log(`💾 Принудительное сохранение всех данных: ${id}, клан: ${p.clan || 'нет'}`);
  
  // Отправляем подтверждение
  ws.send(JSON.stringify({ 
    type: 'forceSaveCompleted',
    success: true,
    message: 'Все данные сохранены!',
    timestamp: Date.now(),
    clanId: p.clan || null
  }));
}

function sendEventInfo(ws) {
  const id = ws.accountId || ws.playerId;
  const playerName = db.players[id]?.name || 'Player';
  
  ws.send(JSON.stringify({ 
    type: 'eventInfo',
    event: {
      active: db.event.active,
      endDate: db.event.endDate,
      season: db.event.season,
      eventCoins: db.event.eventCoins[id] || 0,
      topPlayers: Object.entries(db.event.eventCoins || {})
        .map(([pid, coins]) => ({ 
          id: pid, 
          name: db.players[pid]?.name || 'Player', 
          coins 
        }))
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 10)
    }
  }));
}

// ==================== Аутентификация (системе аккаунтов) ====================

// Обработчик аутентификации (login/register с аккаунтом)
function handleAuthRequest(ws, data) {
  const { username, password } = data;
  
  // Сохраняем username для использования в других функциях
  ws.username = username;
  
  // Используем функцию из auth.js
  handleAuthRegister(ws, { username, password }, db, players, savePlayerToDB, broadcastEventInfo, broadcastLeaderboard, updateLeaderboard, savePlayerToDB);
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
async function handleRestoreSession(ws, data) {
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
    // Загружаем данные из базы данных
    try {
      const dbPlayer = await dbAdapter.getPlayer(accountId);
      if (dbPlayer) {
        console.log(`💾 Загружены данные игрока из БД: ${accountId}, clan=${dbPlayer.clan || 'null'}`);
        playerData = {
          ...dbPlayer,
          // Преобразуем JSON поля обратно в объекты
          skills: typeof dbPlayer.skills === 'string' ? JSON.parse(dbPlayer.skills) : dbPlayer.skills || {},
          achievements: typeof dbPlayer.achievements === 'string' ? JSON.parse(dbPlayer.achievements) : dbPlayer.achievements || [],
          skins: typeof dbPlayer.skins === 'string' ? JSON.parse(dbPlayer.skins) : dbPlayer.skins || { normal: true },
          pendingBoxes: typeof dbPlayer.pending_boxes === 'string' ? JSON.parse(dbPlayer.pending_boxes) : dbPlayer.pending_boxes || [],
          questProgress: dbPlayer.quest_progress || [],
          dailyQuestDate: dbPlayer.daily_quest_date,
          dailyQuestIds: dbPlayer.daily_quest_ids || [],
          antiCheat: dbPlayer.anti_cheat || {},
          clan: (() => {
            let clanValue = dbPlayer.clan;
            if (typeof clanValue === 'string') {
              try {
                clanValue = JSON.parse(clanValue);
              } catch (e) {
                // Если значение уже plain string, оставляем его как есть
              }
            }
            return clanValue ?? null;
          })(),
          // Преобразуем snake_case в camelCase
          perClick: dbPlayer.per_click,
          perSecond: dbPlayer.per_second,
          totalCoins: dbPlayer.total_coins,
          currentSkin: dbPlayer.current_skin,
          eventRewards: dbPlayer.event_rewards,
          createdAt: dbPlayer.created_at,
          lastLogin: dbPlayer.last_login
        };
      } else {
        console.log(`⚠️ Игрок ${accountId} не найден в БД, создаем нового`);
        playerData = createDefaultPlayer(accountId, username || 'Player');
      }
    } catch (error) {
      console.error(`❌ Ошибка загрузки игрока ${accountId} из БД:`, error);
      playerData = createDefaultPlayer(accountId, username || 'Player');
    }
    db.players[accountId] = playerData;
  }
  
  // Инициализируем shopItems если нет
  if (!playerData.shopItems) {
    playerData.shopItems = [];
  }
  
  playerData.lastLogin = Date.now();
  db.accounts[accountId].lastLogin = Date.now();
  ws.authenticated = true;
  ws.accountId = accountId;
  
  // Инициализируем поля для отслеживания билетов
  playerData._pendingEventClicks = 0;
  playerData._lastProcessedClicks = playerData.clicks || 0;
  
  players.set(accountId, { ...playerData, ws });
  updateLeaderboard(playerData);
  savePlayerToDB(accountId);

  // Лог для отладки высоких значений perSecond
  const basePS = playerData.perSecond || 0;
  const calcPerSecond = basePS * (playerData.skills?.['s3'] ? 2 : 1) * (playerData.skills?.['s6'] ? 5 : 1);
  console.log(`🔄 Сессия восстановлена: ${username} (${accountId}), basePerSecond=${basePS}, skills=s3:${!!playerData.skills?.['s3']} s6:${!!playerData.skills?.['s6']}, calcPerSecond=${calcPerSecond}`);

  // Отправляем данные игроку (perSecond = basePerSecond, множители применяются на клиенте)
  ws.send(JSON.stringify({ 
    type: 'authSuccess',
    accountId,
    username: username || playerData.name,
    data: {
      ...playerData,
      basePerClick: playerData.perClick,  // Явно указываем что это база
      basePerSecond: playerData.perSecond  // Явно указываем что это база
    },
    eventCoins: db.event.eventCoins[accountId] || 0
  }));
  
  // Отправляем список кланов
  setTimeout(() => sendClans(ws), 100);
  
  // Если игрок в клане - отправляем информацию о членах клана
  if (playerData.clan && db.clans[playerData.clan]) {
    setTimeout(() => sendClanMembers(playerData.clan), 150);
  }
  
  console.log(`🔄 Сессия восстановлена: ${username} (${accountId}), клан: ${playerData.clan || 'нет'}`);
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
  
  // Инициализируем поля для отслеживания билетов
  playerData._pendingEventClicks = 0;
  playerData._lastProcessedClicks = playerData.clicks || 0;
  
  players.set(playerId, { ...playerData, ws });
  
  // Лог для отладки
  const calcPerSecond = (playerData.basePerSecond || 0) * (playerData.skills?.['s3'] ? 2 : 1) * (playerData.skills?.['s6'] ? 5 : 1);
  console.log(`🎮 Гость зарегистрирован: ${playerId}, basePerSecond=${playerData.basePerSecond}, calcPerSecond=${calcPerSecond}`);
  
  ws.send(JSON.stringify({ 
    type: 'registered', 
    playerId, 
    name: playerData.name, 
    data: playerData,
    eventCoins: db.event?.eventCoins?.[playerId] || 0
  }));
  broadcastLeaderboard();
  broadcastEventInfo();
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
  savePlayerToDB(id);
}

// Добавление eventCoins
function addEventCoins(playerId, amount) {
  if (!db.event) return;
  if (!db.event.eventCoins) db.event.eventCoins = {};
  if (!db.event.eventCoins[playerId]) db.event.eventCoins[playerId] = 0;
  db.event.eventCoins[playerId] += amount;
  console.log(`💰 addEventCoins: ${playerId} +${amount} = ${db.event.eventCoins[playerId]}`);
  if (dbAdapter.usePostgreSQL) {
    dbAdapter.saveEventCoins(playerId, db.event.eventCoins[playerId]).catch(err => {
      console.error('❌ Ошибка сохранения eventCoins:', err.message);
    });
  }
}

function handleFindBattle(ws) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player) return;
  
  // Не позволяем одному игроку быть в очереди дважды
  if (waitingPlayers.includes(id)) {
    ws.send(JSON.stringify({ type: 'waitingForBattle' }));
    return;
  }
  
  // Если уже есть игрок в очереди - начинаем батл
  if (waitingPlayers.length > 0) {
    const opponentId = waitingPlayers.shift();
    // Проверяем что opponentId не равен текущему игроку
    if (opponentId !== id) {
      startBattle(id, opponentId);
      return;
    } else {
      // Если вдруг это тот же игрок, добавляем обратно
      waitingPlayers.push(opponentId);
    }
  }
  
  // Если никого нет в очереди - добавляем текущего игрока
  // Ограничиваем очередь максимум 1 игроком (чтобы третий не подключился)
  if (waitingPlayers.length >= 1) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби заполнено. Подождите...' }));
    return;
  }
  
  waitingPlayers.push(id);
  ws.send(JSON.stringify({ type: 'waitingForBattle' }));
}

// Создание лобби для батла
function handleCreateBattleLobby(ws) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player) return;
  
  // Проверка: игрок уже в лобби?
  for (const [lobbyId, lobby] of battleLobbies) {
    if (lobby.owner === id || lobby.opponent === id) {
      ws.send(JSON.stringify({ type: 'error', message: 'Вы уже в лобби' }));
      return;
    }
  }
  
  // Проверка: игрок в очереди на вступление?
  if (lobbyWaitingPlayers.has(id)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы ожидаете вступления в лобби' }));
    return;
  }
  
  const lobbyId = generateId();
  battleLobbies.set(lobbyId, {
    id: lobbyId,
    owner: id,
    ownerName: player.name,
    opponent: null,
    opponentName: null,
    status: 'waiting', // waiting, ready, started
    createdAt: Date.now()
  });
  
  ws.send(JSON.stringify({ 
    type: 'lobbyCreated', 
    lobbyId,
    ownerName: player.name
  }));
  
  // Отправляем обновление списка лобби всем
  broadcastBattleLobbies();
}

// Присоединение к лобби
function handleJoinBattleLobby(ws, lobbyId) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player) return;
  
  const lobby = battleLobbies.get(lobbyId);
  if (!lobby) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    return;
  }
  
  // Проверка: лобби уже заполнено?
  if (lobby.opponent) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби уже заполнено' }));
    return;
  }
  
  // Проверка: игрок не может вступить в своё лобби
  if (lobby.owner === id) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы создали это лобби' }));
    return;
  }
  
  // Проверка: игрок уже в другом лобби?
  for (const [lid, l] of battleLobbies) {
    if (l.owner === id || l.opponent === id) {
      ws.send(JSON.stringify({ type: 'error', message: 'Вы уже в другом лобби' }));
      return;
    }
  }
  
  // Добавляем игрока в лобби
  lobby.opponent = id;
  lobby.opponentName = player.name;
  lobbyWaitingPlayers.delete(id);
  
  ws.send(JSON.stringify({ 
    type: 'joinedLobby', 
    lobbyId,
    ownerName: lobby.ownerName,
    opponentName: lobby.ownerName
  }));
  
  // Отправляем владельцу лобби уведомление
  const ownerWs = players.get(lobby.owner)?.ws;
  if (ownerWs && ownerWs.readyState === WebSocket.OPEN) {
    ownerWs.send(JSON.stringify({
      type: 'opponentJoined',
      lobbyId,
      opponentName: player.name
    }));
  }
  
  // Обновляем список лобби
  broadcastBattleLobbies();
}

// Выход из лобби
function handleLeaveBattleLobby(ws) {
  const id = ws.accountId || ws.playerId;
  
  // Ищем лобби игрока
  let lobbyId = null;
  for (const [lid, lobby] of battleLobbies) {
    if (lobby.owner === id || lobby.opponent === id) {
      lobbyId = lid;
      break;
    }
  }
  
  if (!lobbyId) return;
  
  const lobby = battleLobbies.get(lobbyId);
  if (!lobby) return;
  
  // Если игрок был владельцем, удаляем лобби
  if (lobby.owner === id) {
    battleLobbies.delete(lobbyId);
    broadcastBattleLobbies();
  } else {
    // Если игрок был соперником, просто удаляем его из лобби
    lobby.opponent = null;
    lobby.opponentName = null;
    broadcastBattleLobbies();
    
    // Уведомляем владельца
    const ownerWs = players.get(lobby.owner)?.ws;
    if (ownerWs && ownerWs.readyState === WebSocket.OPEN) {
      ownerWs.send(JSON.stringify({
        type: 'opponentLeft',
        lobbyId
      }));
    }
  }
  
  ws.send(JSON.stringify({ type: 'leftLobby', lobbyId }));
}

// Получение списка лобби
function handleGetBattleLobbies(ws) {
  const lobbies = Array.from(battleLobbies.values())
    .filter(lobby => lobby.status === 'waiting')
    .map(lobby => ({
      id: lobby.id,
      ownerName: lobby.ownerName,
      opponentName: lobby.opponentName,
      hasOpponent: !!lobby.opponent,
      createdAt: lobby.createdAt
    }));
  
  ws.send(JSON.stringify({ 
    type: 'battleLobbies', 
    lobbies 
  }));
}

// Запуск батла из лобби (владельцем)
function handleStartBattleFromLobby(ws, lobbyId) {
  const id = ws.accountId || ws.playerId;
  
  const lobby = battleLobbies.get(lobbyId);
  if (!lobby) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    return;
  }
  
  // Только владелец может запустить батл
  if (lobby.owner !== id) {
    ws.send(JSON.stringify({ type: 'error', message: 'Только владелец может запустить батл' }));
    return;
  }
  
  // Проверка что есть соперник
  if (!lobby.opponent) {
    ws.send(JSON.stringify({ type: 'error', message: 'Ожидание соперника...' }));
    return;
  }
  
  // Запускаем батл
  startBattle(lobby.owner, lobby.opponent, lobbyId);
}

// Рассылка списка лобби всем игрокам
function broadcastBattleLobbies() {
  const lobbies = Array.from(battleLobbies.values())
    .filter(lobby => lobby.status === 'waiting')
    .map(lobby => ({
      id: lobby.id,
      ownerName: lobby.ownerName,
      opponentName: lobby.opponentName,
      hasOpponent: !!lobby.opponent,
      createdAt: lobby.createdAt
    }));
    
  const data = JSON.stringify({ type: 'battleLobbies', lobbies });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function startBattle(player1Id, player2Id, lobbyId = null) {
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
    duration: 30000,
    lobbyId: lobbyId
  });
  
  // Обновляем статус лобби если есть
  if (lobbyId && battleLobbies.has(lobbyId)) {
    const lobby = battleLobbies.get(lobbyId);
    lobby.status = 'started';
  }
  
  const battleData = {
    type: 'battleStart', 
    battleId,
    lobbyId,
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
  
  // Удаляем из лобби
  if (lobbyId) {
    battleLobbies.delete(lobbyId);
    broadcastBattleLobbies();
  }
  
  // Удаляем из очереди если были
  const idx1 = waitingPlayers.indexOf(player1Id);
  if (idx1 > -1) waitingPlayers.splice(idx1, 1);
  const idx2 = waitingPlayers.indexOf(player2Id);
  if (idx2 > -1) waitingPlayers.splice(idx2, 1);
  
  setTimeout(() => endBattle(battleId), 30000);
}

function handleBattleClick(ws, battleId, clicks, cps) {
  const battle = battles.get(battleId);
  if (!battle) return;
  
  const id = ws.accountId || ws.playerId;
  
  // Проверка на бан
  if (isPlayerBanned(id)) {
    console.log(`🚨 Anti-cheat: Забаненный игрок ${id}`);
    return;
  }
  
  // Лимит CPS для батлов (максимум 250 кликов в секунду - достаточно для быстрых кликов)
  if (cps > 250) {
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
  
  // Отправляем обновления обоим игрокам СРАЗУ (без буферизации для батла)
  const player = players.get(id);
  
  // Данные для текущего игрока
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
    
  // Данные для соперника (показываем ЕГО счёт как yourScore, а счёт игрока как opponentScore)
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
  
  // Берем актуальное имя из db.players
  const dbPlayer = db.players[player.id];
  const name = dbPlayer?.name || player.name || 'Player';
  
  const entry = { 
    id: player.id, 
    name: name, 
    coins: Number(player.coins) || 0, 
    perSecond: Number(player.perSecond) || 0, 
    level: Number(player.level) || 1 
  };
  
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
    .map(p => ({ 
      id: p.id, 
      name: p.name, 
      coins: Number(p.coins) || 0, 
      perSecond: Number(p.perSecond) || 0, 
      level: Number(p.level) || 1 
    }))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 100);
  ws.send(JSON.stringify({ type: 'leaderboard', data: db.leaderboard }));
}

function handleCreateClan(ws, clanName) {
  const id = ws.accountId || ws.playerId;
  console.log(`🏰 handleCreateClan: ws.accountId=${ws.accountId}, ws.playerId=${ws.playerId}, id=${id}`);
  
  // Создаем игрока если его нет
  if (!db.players[id]) {
    db.players[id] = {
      id,
      name: ws.username || 'Player',
      coins: 0,
      totalCoins: 0,
      perClick: 1,
      perSecond: 0,
      clicks: 0,
      level: 1,
      skills: {},
      achievements: [],
      skins: { normal: true },
      currentSkin: 'normal',
      clan: null,
      eventRewards: 0,
      pendingBoxes: [],
      createdAt: Date.now(),
      lastLogin: Date.now()
    };
  }
  
  const player = players.get(id) || db.players[id];
  
  // Ограничение: максимум 1 клан на игрока
  if (player.clan) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы уже владеете кланом!' }));
    return;
  }
  
  // Проверка что игрок не в другом клане
  const existingClan = Object.values(db.clans).find(c => c.members.includes(id));
  if (existingClan) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы уже в клане! Выйдите сначала.' }));
    return;
  }
  
  const clanId = generateId();
  db.clans[clanId] = {
    id: clanId, name: clanName, owner: id, ownerName: player.name,
    members: [id], memberNames: [player.name],
    totalCoins: 0, createdAt: Date.now(), description: ''
  };
  player.clan = clanId;
  db.players[id].clan = clanId;
  db.stats.totalClans++;
  
  console.log(`🏰 Клан создан: ${clanId} для игрока ${id}, player.clan=${player.clan}`);
  
  // Синхронизация в памяти
  if (players.has(id)) {
    players.get(id).clan = clanId;
  }
  
  ws.send(JSON.stringify({ type: 'clanCreated', clanId, name: clanName, clanId }));
  broadcastClans();
  sendClanMembers(clanId);
  savePlayerToDB(id);
  saveClanToDB(clanId);
}
  
function handleJoinClan(ws, clanId) {
  const id = ws.accountId || ws.playerId;
  const clan = db.clans[clanId];
  
  // Создаем игрока если его нет
  if (!db.players[id]) {
    db.players[id] = {
      id,
      name: ws.username || 'Player',
      coins: 0,
      totalCoins: 0,
      perClick: 1,
      perSecond: 0,
      clicks: 0,
      level: 1,
      skills: {},
      achievements: [],
      skins: { normal: true },
      currentSkin: 'normal',
      clan: null,
      eventRewards: 0,
      pendingBoxes: [],
      createdAt: Date.now(),
      lastLogin: Date.now()
    };
  }
  
  const player = players.get(id) || db.players[id];
  if (!clan || player.clan || clan.members.includes(id)) return;
  
  clan.members.push(id);
  clan.memberNames.push(player.name);
  player.clan = clanId;
  db.players[id].clan = clanId;
  
  // Синхронизация
  if (players.has(id)) {
    players.get(id).clan = clanId;
  }
  
  ws.send(JSON.stringify({ type: 'joinedClan', clanId, name: clan.name, clanId }));
  broadcastClans();
  sendClanMembers(clanId);
  savePlayerToDB(id);
  saveClanToDB(clanId);
}
  
function handleDeleteClan(ws, clanId) {
  const id = ws.accountId || ws.playerId;
  const clan = db.clans[clanId];
  
  if (!clan) {
    ws.send(JSON.stringify({ type: 'error', message: 'Клан не найден' }));
    return;
  }
  
  if (clan.owner !== id) {
    ws.send(JSON.stringify({ type: 'error', message: 'Только владелец может удалить клан' }));
    return;
  }
  
  // Удаляем клан
  delete db.clans[clanId];
  db.stats.totalClans--;
  deleteClanFromDB(clanId);
  
  // Удаляем клан у всех участников
  clan.members.forEach(memberId => {
    if (db.players[memberId]) {
      db.players[memberId].clan = null;
      savePlayerToDB(memberId);
    }
    const member = players.get(memberId);
    if (member) member.clan = null;
  });
  
  ws.send(JSON.stringify({ type: 'clanDeleted', clanId }));
  broadcastClans();
  console.log(`🗑️ Клан удалён: ${clanId} владельцем ${id}`);
}
  
function handleLeaveClan(ws) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player || !player.clan) {
    console.log(`⚠️ handleLeaveClan: игрок ${id} не в клане`);
    return;
  }
  
  const clan = db.clans[player.clan];
  if (!clan) { 
    player.clan = null; 
    db.players[id].clan = null;
    console.log(`⚠️ handleLeaveClan: клан не найден`);
    return;
  }
  
  const clanId = clan.id;
  console.log(`🚪 Игрок ${id} выходит из клана ${clanId}`);

  if (clan.owner === id) {
    if (clan.members.length > 1) {
      const newOwner = clan.members.find(mid => mid !== id);
      clan.owner = newOwner;
      clan.ownerName = players.get(newOwner)?.name || 'Unknown';
      console.log(`👑 Новый владелец клана: ${newOwner}`);
    } else {
      delete db.clans[clanId];
      db.stats.totalClans--;
      deleteClanFromDB(clanId);
      player.clan = null;
      db.players[id].clan = null;
      ws.send(JSON.stringify({ type: 'leftClan', clanId }));
      broadcastClans();  // ✅ Отправляем всем
      console.log(`🗑️ Клан удалён: ${clanId}`);
      return;
    }
  }
  
  clan.members = clan.members.filter(mid => mid !== id);
  clan.memberNames = clan.memberNames.filter(n => n !== player.name);
  player.clan = null;
  db.players[id].clan = null;
  ws.send(JSON.stringify({ type: 'leftClan', clanId }));
  broadcastClans();
  sendClanMembers(clan.id);
  saveClanToDB(clanId);
  savePlayerToDB(id);
  console.log(`✅ Игрок ${id} вышел из клана ${clanId}`);
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
  console.log(`📡 sendClans: отправлено ${list.length} кланов игроку ${ws.accountId || ws.playerId}`);
  ws.send(JSON.stringify({ type: 'clans', data: list }));
}

function broadcastClans() {
  const list = Object.values(db.clans).map(c => ({
    id: c.id, name: c.name, ownerName: c.ownerName,
    memberCount: c.members.length, totalCoins: c.totalCoins
  }));
  const data = JSON.stringify({ type: 'clans', data: list });
  let count = 0;
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(data);
      count++;
    }
  });
  console.log(`📊 broadcastClans: ${Object.keys(db.clans).length} кланов, отправлено ${count} клиентам`);
}

function handleBuyEffect(ws, effectId) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) return;
  const p = db.players[id];
  const mem = players.get(id);
  const coins = mem ? mem.coins : p.coins;
  
  const effects = {
    'e1': { name: 'Золотой клик', cost: 500 },
    'e2': { name: 'Неоновый свет', cost: 1000 },
    'e3': { name: 'Радужный след', cost: 2000 },
    'e4': { name: 'Частицы звёзд', cost: 3000 },
    'e5': { name: 'Эффект волны', cost: 1500 },
    'e6': { name: 'Огненное сияние', cost: 2500 }
  };
  
  const effect = effects[effectId];
  if (!effect || (p.effects && p.effects[effectId])) return;
  if (coins < effect.cost) {
    ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно монет' }));
    return;
  }
  
  p.coins = coins - effect.cost;
  if (!p.effects) p.effects = {};
  p.effects[effectId] = true;
  if (mem) { mem.coins = p.coins; mem.effects = p.effects; }
  
  savePlayerToDB(id);
  
  ws.send(JSON.stringify({ 
    type: 'effectBought', 
    effectId, 
    effectName: effect.name 
  }));
  
  console.log(`✨ Игрок ${id} купил эффект: ${effect.name}`);
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
  
  // Применяем улучшения к basePerClick/basePerSecond (без множителей навыков)
  if (item.type === 'click') p.perClick += item.value;
  if (item.type === 'auto') p.perSecond += item.value;
  
  // Лог для отладки
  console.log(`🛒 Игрок ${id} купил предмет: ${item.name}, basePerSecond теперь: ${p.perSecond}`);
  
  // Увеличиваем цену (пер-игрока)
  const newCost = Math.floor(itemCost * 1.2);
  setPlayerItemCost(p, itemId, newCost);
  
  // МГНОВЕННОЕ сохранение в PostgreSQL
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
}

// Покупка скина
function handleBuySkin(ws, skinId) {
  // По просьбе: скины НЕ покупаются за монеты — только выбиваются из бокса
  ws.send(JSON.stringify({ type: 'error', message: 'Скины можно получить только из ящика' }));
}

// Надевание скина
function handleEquipSkin(ws, skinId) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) {
    console.log(`⚠️ handleEquipSkin: игрок не найден id=${id}`);
    return;
  }
  
  const p = db.players[id];
  const mem = players.get(id);
  
  // Парсим skins если это строка
  let skins = p.skins;
  if (typeof skins === 'string') {
    try { skins = JSON.parse(skins); } catch(e) { skins = { normal: true }; }
  }
  if (!skins) skins = { normal: true };
  
  console.log(`🎨 handleEquipSkin: id=${id}, skinId=${skinId}, skins=${JSON.stringify(skins)}`);
  
  // Проверяем что скин открыт (normal всегда доступен)
  if (skinId === 'normal' || skins[skinId]) {
    p.currentSkin = skinId;
    if (mem) mem.currentSkin = skinId;
    
    savePlayerToDB(id);
    
    ws.send(JSON.stringify({ 
      type: 'skinEquipped',
      skinId: skinId
    }));
    
    console.log(`✅ Игрок ${id} надел скин: ${skinId}`);
  } else {
    console.log(`❌ Скин ${skinId} не открыт у игрока ${id}`);
    ws.send(JSON.stringify({ type: 'error', message: `Скин "${skinId}" не открыт` }));
  }
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
      if (avgInterval < 10) {
        console.log(`🚨 Anti-bot: Игрок ${accountId} - подозрительный паттерн (avg ${avgInterval.toFixed(1)}ms)`);
        data.times = [];
        return false;
      }
    }
    
    // Проверка на равномерность интервалов
    if (data.times.length >= 20) {
      const intervals = [];
      for (let i = 1; i < data.times.length; i++) {
        intervals.push(data.times[i] - data.times[i-1]);
      }
      
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev < 5 && avg < 20) {
        console.log(`🚨 Anti-bot: Игрок ${accountId} - слишком равномерные клики (stdDev: ${stdDev.toFixed(1)}ms)`);
        data.times = [];
        return false;
      }
    }
    
    data.times = data.times.filter(t => now - t < 2000);
    data.lastCheck = now;
  }
  
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
  
  // Сохраняем СРАЗУ в PostgreSQL
  savePlayerToDB(id);
  
  // Отправляем подтверждение с актуальными данными
  ws.send(JSON.stringify({ 
    type: 'boxBought', 
    boxId,
    coins: playerDB.coins,
    pendingBoxes: playerDB.pendingBoxes.length
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
  
  // Сохраняем СРАЗУ в PostgreSQL
  savePlayerToDB(id);
  
  // Отправляем подтверждение с актуальным количеством боксов
  ws.send(JSON.stringify({ 
    type: 'boxOpened', 
    reward,
    pendingBoxes: playerDB.pendingBoxes.length
  }));
  
  console.log(`🎁 Игрок ${id} открыл бокс. Награда: ${reward.type}. Всего боксов: ${playerDB.pendingBoxes.length}`);
}

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT получен, сервер останавливается...');
  wss.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM получен (Render shutdown), сервер останавливается...');
  wss.close(() => process.exit(0));
});
