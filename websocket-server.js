
// ============================================
// WebSocket сервер для Кошка-косатка Кликер
// PostgreSQL - единственный источник истины
// ============================================

const WebSocket = require('ws');
const http = require('http');
const { handleRegister: handleAuthRegister, createDefaultPlayer, generateId: generateAuthId } = require('./auth');
const { WebSocketRateLimiter } = require('./middleware/rate-limiter');
const dbAdapter = require('./middleware/database-adapter');

function checkAdmin(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Требуется авторизация' });
    return false;
  }
  
  const token = auth.replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) {
    sendJson(res, 403, { error: 'Неверный пароль' });
    return false;
  }
  
  return true;
}

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
  if (!dbAdapter.usePostgreSQL) {
    console.log(`⚠️ saveClanToDB: PostgreSQL не используется`);
    return;
  }
  if (!dbAdapter.initialized) {
    console.log(`⚠️ saveClanToDB: PostgreSQL ещё не инициализирован`);
    return;
  }
  const clan = db.clans[clanId];
  if (!clan) {
    console.log(`⚠️ saveClanToDB: клан ${clanId} не найден`);
    return;
  }
  console.log(`💾 Сохранение клана в БД: ${clanId}, name=${clan.name}, owner=${clan.owner}, members=${clan.members.length}`);
  dbAdapter.saveClan(clan).then(() => {
    console.log(`✅ Клан сохранён: ${clanId}`);
  }).catch(e => console.error('❌ Ошибка сохранения клана:', e.message));
}
  
// Удаление клана из PostgreSQL
function deleteClanFromDB(clanId) {
  if (!dbAdapter.usePostgreSQL) return;
  if (!dbAdapter.initialized) return;
  dbAdapter.deleteClan(clanId).catch(e => console.error('Ошибка удаления клана:', e.message));
}

// Сохранение одного игрока в PostgreSQL
function savePlayerToDB(accountId) {
  if (!dbAdapter.usePostgreSQL) {
    console.log(`⚠️ savePlayerToDB: PostgreSQL не используется! usePostgreSQL=${dbAdapter.usePostgreSQL}, NODE_ENV=${process.env.NODE_ENV}`);
    return;
  }
  if (!dbAdapter.initialized) {
    console.log(`⚠️ savePlayerToDB: PostgreSQL ещё не инициализирован!`);
    return;
  }
  const p = db.players[accountId];
  if (!p) {
    console.log(`💾 savePlayerToDB: игрок ${accountId} не найден в db.players`);
    return;
  }
  
  // Проверяем что это зарегистрированный игрок (есть в accounts)
  const acc = db.accounts[accountId];
  const isRegistered = !!acc;
  
  // Лог для отладки - ВАЖНО: логируем coins перед сохранением
  console.log(`💾 savePlayerToDB: id=${accountId}, name=${p.name}, coins=${p.coins}, totalCoins=${p.totalCoins}, isRegistered=${isRegistered}`);
  
  // Если игрок зарегистрирован но аккаунт ещё не сохранён в БД - сохраняем сначала
  if (isRegistered && acc) {
    // Сохраняем аккаунт НЕ awaiting (чтобы не блокировать)
    dbAdapter.saveAccount(acc).catch(e => console.error('Ошибка сохранения аккаунта:', e.message));
  }
  
  // Затем сохраняем игрока
  console.log(`💾 savePlayerToDB: ВЫЗЫВАЮ dbAdapter.savePlayer для ${accountId}`);
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

// Удаление игроков с ником начинающимся с "Player"
async function cleanupPlayerAccounts() {
  if (!dbAdapter.usePostgreSQL) return;
  
  try {
    // Найти всех игроков с именем начинающимся с "Player"
    const result = await dbAdapter.pool.query(
      "SELECT id, name FROM players WHERE name LIKE 'Player%' AND account_id IS NULL"
    );
    
    if (result.rows.length > 0) {
      console.log(`🧹 Найдено ${result.rows.length} гостевых аккаунтов (Player...) для удаления`);
      
      for (const row of result.rows) {
        // Лог перед удалением
        const existingPlayer = db.players[row.id];
        console.log(`🗑️ Удаляю гостевой аккаунт: ${row.name} (${row.id}), exists in db.players=${!!existingPlayer}, coins=${existingPlayer?.coins || 'N/A'}`);
        
        // Удалить из памяти
        delete db.players[row.id];
        players.delete(row.id);
        
        // Удалить из БД
        await dbAdapter.pool.query('DELETE FROM players WHERE id = $1', [row.id]);
        
        console.log(`🗑️ Удалён гостевой аккаунт: ${row.name} (${row.id})`);
      }
      
      console.log(`✅ Удалено ${result.rows.length} гостевых аккаунтов`);
    }
  } catch (error) {
    console.error('❌ Ошибка удаления гостевых аккаунтов:', error.message);
  }
}

// Запуск проверки на удаление гостевых аккаунтов каждые 10 минут
setInterval(() => {
  cleanupPlayerAccounts();
}, 10 * 60 * 1000); // 10 минут

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
      
      // Запуск heartbeat для поддержания соединения
      const { startHeartbeat } = require('./middleware/database-adapter.js');
      startHeartbeat(dbAdapter);
      console.log('💓 PostgreSQL heartbeat запущен (каждые 5 минут)');
      try {
        // Загрузить игроков
        const rows = await dbAdapter.pool.query('SELECT * FROM players');
        rows.rows.forEach(row => {
          try {
            // Вспомогательная функция для безопасного парсинга JSON
            const safeParseJSON = (str, defaultVal) => {
              if (!str) return defaultVal;
              if (typeof str === 'object') return str;
              if (typeof str !== 'string') return defaultVal;
              try {
                return JSON.parse(str);
              } catch (e) {
                console.warn(`⚠️ Ошибка парсинга JSON для поля: ${str.substring(0, 50)}...`, e.message);
                return defaultVal;
              }
            };
            
            db.players[row.id] = {
              id: row.id,
              name: row.name,
              coins: row.coins || 0,
              totalCoins: row.total_coins || 0,
              perClick: row.per_click || 1,
              perSecond: row.per_second || 0,
              clicks: row.clicks || 0,
              level: row.level || 1,
              skills: safeParseJSON(row.skills, {}),
              achievements: safeParseJSON(row.achievements, []),
skins: safeParseJSON(row.skins, { normal: true }),
              currentSkin: row.current_skin || 'normal',
              effects: safeParseJSON(row.effects, {}),
              clan: row.clan || null,
              eventRewards: row.event_rewards || 0,
              pendingBoxes: safeParseJSON(row.pending_boxes, []),
              questProgress: safeParseJSON(row.quest_progress, []),
              dailyProgress: safeParseJSON(row.daily_quest_progress, { clicks: 0, coins: 0, playTime: 0 }),
              dailyQuestDate: row.daily_quest_date,
              dailyQuestIds: safeParseJSON(row.daily_quest_ids, []),
              createdAt: row.created_at || Date.now(),
              lastLogin: row.last_login || Date.now(),
              updatedAt: row.updated_at || row.last_login || Date.now(),
              antiCheat: null
            };
            console.log(`💾 Загружен игрок: ${row.id}, coins=${row.coins}, clan=${row.clan || 'null'}`);
            db.players[row.id]._justLoadedFromDB = Date.now();  // Помечаем что только что загружен из БД
            
            // Преобразуем coins в число
            db.players[row.id].coins = Number(row.coins) || 0;
            db.players[row.id].totalCoins = Number(row.total_coins) || 0;
            db.players[row.id].eventRewards = Number(row.event_rewards) || 0;
            
            // Загружаем pendingEventClicks
            db.players[row.id]._pendingEventClicks = Number(row.pending_event_clicks) || 0;
            db.players[row.id]._lastProcessedClicks = Number(row.last_processed_clicks) || 0;
            db.players[row.id].playTime = Number(row.total_play_time) || 0;  // Общее время в игре
            
            if (row.banned_at) {
              db.players[row.id].antiCheat = {
                bannedUntil: Infinity,
                banReason: row.ban_reason || 'autoclicker',
                bannedAt: row.banned_at
              };
            }
          } catch (e) {
            console.error(`❌ Ошибка загрузки игрока ${row.id}:`, e.message);
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
          console.log(`🏰 Загружен клан из БД: ${clan.id}, name=${clan.name}, owner=${clan.owner}, members=${clan.members.length}`);
        });
        db.stats.totalClans = clans.length;

        console.log(`📦 Загружено: ${Object.keys(db.players).length} игроков, ${Object.keys(db.accounts).length} аккаунтов, ${Object.keys(bans).length} банов, ${Object.keys(eventCoins).length} eventCoins, ${clans.length} кланов`);
        
        // Лог для отладки - показать монеты загруженных игроков
        console.log(`💾 Загруженные игроки (coins):`);
        Object.entries(db.players).forEach(([id, p]) => {
          console.log(`   ${id}: ${p.name}, coins=${p.coins}, totalCoins=${p.totalCoins}`);
        });
        
        // Запустить очистку гостевых аккаунтов при старте
        cleanupPlayerAccounts().then(() => {
          console.log('✅ Очистка гостевых аккаунтов завершена');
        }).catch(e => console.error('Ошибка очистки:', e.message));
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
case 'createBattleLobby': handleCreateBattleLobby(ws, data.isOpen); break;
    case 'joinBattleLobby': handleJoinBattleLobby(ws, data); break;
    case 'leaveBattleLobby': handleLeaveBattleLobby(ws); break;
    case 'deleteBattleLobby': handleDeleteBattleLobby(ws); break;
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
    case 'buyFishBox': handleBuyFishBox(ws); break;
    case 'openFishBox': handleOpenFishBox(ws, data.boxId); break;
    // 3x3 Рейдовые битвы
    case 'createRaidLobby': handleCreateRaidLobby(ws, data.isOpen); break;
    case 'joinRaidLobby': handleJoinRaidLobby(ws, data); break;
    case 'leaveRaidLobby': handleLeaveRaidLobby(ws); break;
    case 'selectRaidRole': handleSelectRaidRole(ws, data.role); break;
    case 'selectRaidStratagem': handleSelectRaidStratagem(ws, data.stratagem); break;
    case 'startRaidBattle': handleStartRaidBattle(ws, data.lobbyId); break;
    case 'raidClick': handleRaidClick(ws, data); break;
    case 'getRaidLobbies': handleGetRaidLobbies(ws); break;
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
  
  // Лог для отладки
  console.log(`💾 handleSaveGame: id=${id}, coins=${data.coins}, updatedAt=${data.updatedAt}`);
  
  // УБРАНА проверка updatedAt - она работала неправильно!
  // Теперь всегда обновляем данные из клиента (клиент - источник истины для активных сессий)
  
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
  p.effects = data.effects || p.effects || {};
  // pendingBoxes: сохраняем только если массив не пустой или явно передан клиентом
  if (data.pendingBoxes !== undefined) {
    p.pendingBoxes = Array.isArray(data.pendingBoxes) ? data.pendingBoxes : p.pendingBoxes || [];
  }
  p.playTime = data.playTime ?? p.playTime;
  // shopItems: НЕ принимаем от клиента - цены управляются только сервером!
  // p.shopItems = data.shopItems || p.shopItems;  // ЗАКОММЕНТИРОВАНО
  p.questProgress = data.questProgress || p.questProgress;
  if (data.dailyQuestDate) p.dailyQuestDate = data.dailyQuestDate;
  if (Array.isArray(data.dailyQuestIds) && data.dailyQuestIds.length > 0) p.dailyQuestIds = data.dailyQuestIds;
  if (data.dailyProgress) p.dailyProgress = data.dailyProgress;
  if (data.clan !== undefined) p.clan = data.clan;
  p.lastLogin = Date.now();
  p.updatedAt = new Date();  // Обновляем время последнего сохранения
  if (mem) Object.assign(mem, p);
  
  updateLeaderboard(p);
  savePlayerToDB(id);
  console.log(`💾 Автосохранение: ${id}, pendingBoxes=${p.pendingBoxes?.length || 0} шт., coins=${p.coins}, updatedAt=${p.updatedAt.toISOString()}`);
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
  handleAuthRegister(ws, { username, password }, db, players, savePlayerToDB, broadcastEventInfo, broadcastLeaderboard, updateLeaderboard, savePlayerToDB, dbAdapter);
}

// Обработчик сохранения данных игрока
function handleSavePlayerData(ws, data) {
  const { accountId, gameData } = data;
  
  if (!accountId || !gameData) {
    console.error('❌ Неполные данные для сохранения');
    return;
  }
  
  // Защита: если только что загрузили игрока из БД (в течение 2 секунд), игнорируем сохранение от клиента
  const player = db.players[accountId];
  if (player && player._justLoadedFromDB) {
    const timeSinceLoad = Date.now() - player._justLoadedFromDB;
    if (timeSinceLoad < 2000) {
      console.log(`⏱️ Игнорируем savePlayerData от клиента (только что загружен из БД: ${timeSinceLoad}мс назад)`);
      return;
    }
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
  playerData.effects = gameData.effects || playerData.effects || {};
  playerData.pendingBoxes = gameData.pendingBoxes || playerData.pendingBoxes || [];
  playerData.multiplier = gameData.multiplier || 1;
  playerData.lastLogin = Date.now();
  
  // Обновляем в памяти если игрок онлайн
  if (players.has(accountId)) {
    const onlinePlayer = players.get(accountId);
    Object.assign(onlinePlayer, playerData);
  }
  
  savePlayerToDB(accountId);
  console.log(`💾 Данные сохранены: ${accountId}, effects=${JSON.stringify(playerData.effects)}`);
  
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
  
  // Аккаунт не найден — просим перелогиниться
  let account = Object.values(db.accounts || {}).find(a => a.id === accountId);
  if (!account) {
    console.log(`⚠️ Аккаунт ${accountId} не найден, просим перелогиниться`);
    ws.send(JSON.stringify({ type: 'sessionExpired', message: 'Сессия истекла, войдите снова' }));
    return;
  }
  
  let playerData = db.players[accountId];
  if (!playerData) {
    // Загружаем данные из базы данных
    try {
      const dbPlayer = await dbAdapter.getPlayer(accountId);
      if (dbPlayer) {
        console.log(`💾 Загружены данные игрока из БД: ${accountId}, coins=${dbPlayer.coins}, clan=${dbPlayer.clan || 'null'}`);
      playerData = {
        id: dbPlayer.id,
        name: dbPlayer.name,
        coins: Number(dbPlayer.coins) || 0,
        totalCoins: Number(dbPlayer.total_coins) || 0,
        perClick: Number(dbPlayer.per_click) || 1,
        perSecond: Number(dbPlayer.per_second) || 0,
        clicks: Number(dbPlayer.clicks) || 0,
        level: Number(dbPlayer.level) || 1,
        skills: typeof dbPlayer.skills === 'string' ? JSON.parse(dbPlayer.skills) : dbPlayer.skills || {},
        achievements: typeof dbPlayer.achievements === 'string' ? JSON.parse(dbPlayer.achievements) : dbPlayer.achievements || [],
        skins: typeof dbPlayer.skins === 'string' ? JSON.parse(dbPlayer.skins) : dbPlayer.skins || { normal: true },
        currentSkin: dbPlayer.current_skin || 'normal',
        pendingBoxes: typeof dbPlayer.pending_boxes === 'string' ? JSON.parse(dbPlayer.pending_boxes) : dbPlayer.pending_boxes || [],
        questProgress: typeof dbPlayer.quest_progress === 'string' ? JSON.parse(dbPlayer.quest_progress) : dbPlayer.quest_progress || [],
dailyProgress: typeof dbPlayer.daily_quest_progress === 'string' ? JSON.parse(dbPlayer.daily_quest_progress) : dbPlayer.daily_quest_progress || { clicks: 0, coins: 0, playTime: 0 },
        dailyQuestDate: dbPlayer.daily_quest_date,
        dailyQuestIds: typeof dbPlayer.daily_quest_ids === 'string' ? JSON.parse(dbPlayer.daily_quest_ids) : dbPlayer.daily_quest_ids || [],
        clan: dbPlayer.clan || null,
        effects: typeof dbPlayer.effects === 'string' ? JSON.parse(dbPlayer.effects) : dbPlayer.effects || {},
        eventRewards: Number(dbPlayer.event_rewards) || 0,
        createdAt: dbPlayer.created_at || Date.now(),
        lastLogin: dbPlayer.last_login || Date.now(),
        updatedAt: dbPlayer.updated_at || dbPlayer.last_login || Date.now(),
        antiCheat: null,
        _pendingEventClicks: Number(dbPlayer.pending_event_clicks) || 0,
        _lastProcessedClicks: Number(dbPlayer.last_processed_clicks) || 0,
        playTime: Number(dbPlayer.total_play_time) || 0  // Общее время в игры
      };
      } else {
        console.log(`⚠️ Игрок ${accountId} не найден в БД, создаем нового`);
        playerData = createDefaultPlayer(accountId, account.username);
      }
    } catch (error) {
      console.error(`❌ Ошибка загрузки игрока ${accountId} из БД:`, error);
      playerData = createDefaultPlayer(accountId, account.username);
    }
    db.players[accountId] = playerData;
    playerData._justLoadedFromDB = Date.now();  // Помечаем что только что загружен из БД
  } else {
    // Игрок уже есть в памяти - ВСЁ РАВНО проверяем БД для свежих данных!
    console.log(`ℹ️ Игрок ${accountId} уже в памяти, проверяем актуальность данных из БД...`);
    try {
      const dbPlayer = await dbAdapter.getPlayer(accountId);
      if (dbPlayer) {
        const dbCoins = Number(dbPlayer.coins) || 0;
        const memCoins = Number(playerData.coins) || 0;
        if (dbCoins !== memCoins) {
          console.log(`⚠️ ДАННЫЕ РАСХОДЯТСЯ! БД: ${dbCoins} coins, Память: ${memCoins} coins - ОБНОВЛЯЕМ ИЗ БД`);
          // Перезагружаем данные из БД
          playerData.coins = dbCoins;
          playerData.totalCoins = Number(dbPlayer.total_coins) || 0;
          playerData.perClick = Number(dbPlayer.per_click) || 1;
          playerData.perSecond = Number(dbPlayer.per_second) || 0;
          playerData.clicks = Number(dbPlayer.clicks) || 0;
          playerData.level = Number(dbPlayer.level) || 1;
          playerData.clan = dbPlayer.clan || null;
          playerData.effects = typeof dbPlayer.effects === 'string' ? JSON.parse(dbPlayer.effects) : dbPlayer.effects || {};
          playerData._pendingEventClicks = Number(dbPlayer.pending_event_clicks) || 0;
          playerData._lastProcessedClicks = Number(dbPlayer.last_processed_clicks) || 0;
          playerData.playTime = Number(dbPlayer.total_play_time) || 0;  // Общее время в игре
          console.log(`✅ Данные обновлены из БД: ${accountId}, coins=${dbCoins}, playTime=${playerData.playTime}`);
        }
      }
    } catch (error) {
      console.error(`❌ Ошибка проверки данных из БД для ${accountId}:`, error);
    }
  }
  
  if (!playerData.shopItems) playerData.shopItems = [];  // shopItems больше не используются - цены управляются только через getPlayerItemCost
  playerData.shopItems = [];  // СБРОС shopItems - цены управляются только через getPlayerItemCost/SHOP_CATALOG
  
  playerData.lastLogin = Date.now();
  account.lastLogin = Date.now();
  ws.authenticated = true;
  ws.accountId = accountId;
  
  playerData._pendingEventClicks = 0;
  playerData._lastProcessedClicks = playerData.clicks || 0;
  
  players.set(accountId, { ...playerData, ws });
  updateLeaderboard(playerData);
  
  // Лог перед сохранением
  console.log(`💾 Перед сохранением: accountId=${accountId}, coins=${playerData.coins}, totalCoins=${playerData.totalCoins}`);
  
  savePlayerToDB(accountId);

  const basePS = playerData.perSecond || 0;
  console.log(`🔄 Сессия восстановлена: ${account.username} (${accountId}), basePerSecond=${basePS}, клан: ${playerData.clan || 'нет'}`);
  
  // clan всегда должен быть строкой ID или null
  const finalClanId = playerData.clan || null;
  console.log(`🏰 finalClanId = ${finalClanId}`);
  
  // Лог для отладки - что отправляем клиенту
  console.log(`📤 authSuccess (restoreSession): accountId=${accountId}, coins=${playerData.coins}, totalCoins=${playerData.totalCoins}`);
  console.log(`📤 authSuccess (restoreSession) data object:`, {
    coins: playerData.coins,
    totalCoins: playerData.totalCoins,
    level: playerData.level,
    clan: playerData.clan
  });
  
  ws.send(JSON.stringify({ 
    type: 'authSuccess',
    accountId,
    username: account.username,
    data: {
      ...playerData,
      basePerClick: playerData.perClick,
      basePerSecond: playerData.perSecond,
      clan: finalClanId
    },
    eventCoins: db.event.eventCoins[accountId] || 0
  }));
  
  // Отправляем список кланов
  setTimeout(() => sendClans(ws), 100);
  
  // Если игрок в клане - сразу отправляем информацию о членах клана
  if (playerData.clan && db.clans[playerData.clan]) {
    setTimeout(() => {
      const clan = db.clans[playerData.clan];
      if (clan) {
        const membersData = clan.members.map(id => ({
          id, name: db.players[id]?.name || 'Unknown',
          coins: db.players[id]?.coins || 0, isOwner: id === clan.owner
        }));
        ws.send(JSON.stringify({ type: 'clanMembers', clanId: playerData.clan, members: membersData }));
        console.log(`👥 Отправлены участники клана ${playerData.clan}: ${membersData.length} шт.`);
      }
    }, 150);
  }
  
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
  
  // Проверка: если ник начинается с "Player" - удаляем игрока
  if (playerData.name.startsWith('Player')) {
    console.log(`🗑️ Удаляю гостевой аккаунт: ${playerData.name} (${playerId})`);
    delete db.players[playerId];
    players.delete(playerId);
    
    // Удаляем из БД если есть
    if (dbAdapter.usePostgreSQL) {
      dbAdapter.pool.query('DELETE FROM players WHERE id = $1', [playerId])
        .catch(e => console.error('Ошибка удаления гостевого аккаунта:', e.message));
    }
    
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Имя "Player..." зарезервировано. Пожалуйста, выберите другое имя или войдите в аккаунт.' 
    }));
    return;
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

// Генерация кода для лобби (4 цифры)
function generateLobbyCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Создание лобби для батла
function handleCreateBattleLobby(ws, isOpen = true) {
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
  const lobbyCode = generateLobbyCode();
  
  battleLobbies.set(lobbyId, {
    id: lobbyId,
    owner: id,
    ownerName: player.name,
    opponent: null,
    opponentName: null,
    status: 'waiting',
    isOpen: isOpen !== false,
    lobbyCode: lobbyCode,
    createdAt: Date.now()
  });
  
  ws.send(JSON.stringify({ 
    type: 'lobbyCreated', 
    lobbyId,
    ownerName: player.name,
    isOpen: isOpen !== false,
    lobbyCode: lobbyCode
  }));
  
  // Отправляем обновление списка лобби всем
  broadcastBattleLobbies();
}

// Присоединение к лобби (по ID или коду)
function handleJoinBattleLobby(ws, data) {
  const lobbyId = data.lobbyId || data;
  const code = data.code;
  
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player) return;
  
  const lobby = battleLobbies.get(lobbyId);
  if (!lobby) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    return;
  }
  
  // Проверка: лобби закрыто - нужен код
  if (!lobby.isOpen) {
    if (!code || lobby.lobbyCode !== code) {
      ws.send(JSON.stringify({ type: 'error', message: 'Неверный код для вступления в закрытое лобби' }));
      return;
    }
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

// Удаление лобби (только владелец)
function handleDeleteBattleLobby(ws) {
  const id = ws.accountId || ws.playerId;
  
  // Ищем лобби игрока
  let lobbyId = null;
  for (const [lid, lobby] of battleLobbies) {
    if (lobby.owner === id) {
      lobbyId = lid;
      break;
    }
  }
  
  if (!lobbyId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    return;
  }
  
  const lobby = battleLobbies.get(lobbyId);
  if (!lobby) return;
  
  // Если есть соперник, уведомляем его
  if (lobby.opponent) {
    const opponentWs = players.get(lobby.opponent)?.ws;
    if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
      opponentWs.send(JSON.stringify({
        type: 'lobbyDeleted',
        lobbyId,
        message: 'Владелец удалил лобби'
      }));
    }
  }
  
  // Удаляем лобби
  battleLobbies.delete(lobbyId);
  broadcastBattleLobbies();
  
  ws.send(JSON.stringify({ type: 'lobbyDeleted', lobbyId }));
  console.log(`🗑️ Лобби ${lobbyId} удалено владельцем ${id}`);
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
      isOpen: lobby.isOpen !== false, // По умолчанию открытое
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
      isOpen: lobby.isOpen !== false,
      lobbyCode: lobby.lobbyCode,
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
  
  // Получаем уровни игроков
  const level1 = player1?.level || 1;
  const level2 = player2?.level || 1;
  
  let winner = null;
  if (disconnectedPlayer) {
    winner = disconnectedPlayer === p1 ? p2 : p1;
  } else if (battle.scores[p1] > battle.scores[p2]) {
    winner = p1;
  } else if (battle.scores[p2] > battle.scores[p1]) {
    winner = p2;
  }
  
  const winnerName = winner ? players.get(winner)?.name : 'Ничья';
  const isDraw = !winner;
  
  // Расчет призов based on level:
  // Победа: 100 * уровень
  // Поражение: 20 * уровень
  // Ничья: 50 * уровень (половина от победы)
  if (player1) {
    const reward = isDraw ? 50 * level1 : (p1 === winner ? 100 * level1 : 20 * level1);
    player1.coins += reward;
    db.players[p1].coins = player1.coins;
  }
  if (player2) {
    const reward = isDraw ? 50 * level2 : (p2 === winner ? 100 * level2 : 20 * level2);
    player2.coins += reward;
    db.players[p2].coins = player2.coins;
  }
  
  db.stats.totalBattles++;
  
  const result = { 
    type: 'battleEnd', 
    winner: winnerName, 
    isDraw, 
    prize: isDraw ? 50 : (winner ? 100 : 20)
  };
  
  if (player1) {
    result.yourScore = battle.scores[p1];
    result.opponentScore = battle.scores[p2];
    result.yourCPS = battle.cps[p1] || 0;
    result.opponentCPS = battle.cps[p2] || 0;
    result.prize = isDraw ? 50 * level1 : (p1 === winner ? 100 * level1 : 20 * level1);
    result.yourLevel = level1;
    player1.ws.send(JSON.stringify(result));
  }
  if (player2) {
    result.yourScore = battle.scores[p2];
    result.opponentScore = battle.scores[p1];
    result.yourCPS = battle.cps[p2] || 0;
    result.opponentCPS = battle.cps[p1] || 0;
    result.prize = isDraw ? 50 * level2 : (p2 === winner ? 100 * level2 : 20 * level2);
    result.yourLevel = level2;
    player2.ws.send(JSON.stringify(result));
  }
  
  // Очищаем буферы после окончания батла
  clearBattleBuffer(p1);
  clearBattleBuffer(p2);
  
  battles.delete(battleId);
  
  console.log(`⚔️ Battle ${battleId} ended: winner=${winnerName}, p1(prize=${isDraw ? 50 * level1 : (p1 === winner ? 100 * level1 : 20 * level1)}), p2(prize=${isDraw ? 50 * level2 : (p2 === winner ? 100 * level2 : 20 * level2)})`);
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
  console.log(`🏰 handleCreateClan: ws.accountId=${ws.accountId}, ws.playerId=${ws.playerId}, id=${id}, clanName=${clanName}`);
  console.log(`  dbAdapter.initialized=${dbAdapter.initialized}, usePostgreSQL=${dbAdapter.usePostgreSQL}`);
  
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
  // clan должен быть строкой ID
  player.clan = clanId;
  db.players[id].clan = clanId;
  console.log(`🏰 Клан создан: ${clanId} для игрока ${id}, player.clan=${player.clan} (type: ${typeof player.clan})`);
  
  // Синхронизация в памяти
  if (players.has(id)) {
    const memPlayer = players.get(id);
    memPlayer.clan = clanId;
    console.log(`🏰 Синхронизация: players.get(id).clan=${memPlayer.clan} (type: ${typeof memPlayer.clan})`);
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
  // Эффекты теперь ТОЛЬКО из Рыбного бокса - нельзя купить в магазине
  ws.send(JSON.stringify({ type: 'error', message: 'Эффекты можно получить только из Рыбного бокса!' }));
}

// Покупка предмета в магазине
function handleBuyItem(ws, itemId) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) {
    console.error(`❌ handleBuyItem: игрок ${id} не найден`);
    return;
  }
  
  const p = db.players[id];
  const mem = players.get(id);
  
  // БЕРЁМ актуальные монеты ИЗ ПАМЯТИ если игрок онлайн, иначе из БД
  const coins = mem ? mem.coins : p.coins;
  
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) {
    console.error(`❌ handleBuyItem: предмет ${itemId} не найден в каталоге`);
    return;
  }
  
  const itemCost = getPlayerItemCost(p, itemId);
  if (itemCost === null) {
    console.error(`❌ handleBuyItem: не удалось получить цену для ${itemId}`);
    return;
  }
  
  console.log(`🛒 Попытка покупки: ${item.name}, цена=${itemCost}, coins=${coins}, coins в БД=${p.coins}`);
  
  // Проверяем что coins - число
  if (typeof coins !== 'number' || !Number.isFinite(coins)) {
    console.error(`❌ handleBuyItem: invalid coins value: ${coins}`);
    ws.send(JSON.stringify({ type: 'error', message: 'Ошибка данных игрока' }));
    return;
  }
  
  if (coins < itemCost) {
    console.log(`❌ Недостаточно монет: нужно ${itemCost}, есть ${coins}`);
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
const boxPrice = 8500;  // Было 1700, увеличено в 5 раз
const fishBoxPrice = 12500;  // Было 2500, увеличено в 5 раз

// ==================== 3x3 РЕЙДОВЫЕ БИТВЫ ====================
const RAID_ROLES = {
  assassin: { emoji: '🔪', name: 'Ассасин', multiplier: 1.0, bonus: 'x2 кликов в последние 10с' },
  tank: { emoji: '🛡️', name: 'Танк', multiplier: 0.5, bonus: 'Защита союзников' },
  shooter: { emoji: '🏹', name: 'Стрелок', multiplier: 1.0, bonus: 'Стабильный DPS' },
  mage: { emoji: '🔮', name: 'Маг', multiplier: 1.0, bonus: 'Заморозка кликов на 3с' },
  healer: { emoji: '💚', name: 'Хилер', multiplier: 1.0, bonus: 'Восстановление 15% очков' },
  leader: { emoji: '👑', name: 'Лидер', multiplier: 1.1, bonus: '+10% к кликам команды' }
};

const RAID_RANKS = {
  bronze: { name: 'Бронза', minPoints: 0, rewardCoins: 500, rewardBoxes: 1 },
  silver: { name: 'Серебро', minPoints: 1000, rewardCoins: 2000, rewardBoxes: 2 },
  gold: { name: 'Золото', minPoints: 3000, rewardCoins: 5000, rewardBoxes: 3 },
  platinum: { name: 'Платина', minPoints: 8000, rewardCoins: 15000, rewardBoxes: 0, rewardEffect: true },
  diamond: { name: 'Алмаз', minPoints: 15000, rewardCoins: 50000, rewardBoxes: 0, rewardSkin: true }
};

const RAID_STRATEGEMS = {
  tripleStrike: { name: 'Тройной удар', description: 'x3 клики союзнику на 10с' },
  stoneWall: { name: 'Каменная стена', description: 'Иммунитет к контролю 15с' },
  reverse: { name: 'Реверс', description: '-20% очков врагам' },
  tornado: { name: 'Торнадо', description: 'Перемешивает роли врагов' },
  sacrifice: { name: 'Жертва', description: '+200% к очкам другого игрока' }
};

const RAID_EVENTS = [
  { time: 10, type: 'wave', name: 'Волна усиления', description: 'Случайная роль получает x2 на 5с' },
  { time: 25, type: 'kraken', name: 'Кракен!', description: '5 кликов по боссу или -20% урона' },
  { time: 40, type: 'darkness', name: 'Тёмная фаза', description: 'Экраны меняются местами' },
  { time: 55, type: 'rage', name: 'Ярость', description: 'x2 кликов до конца боя' }
];

// Хранилище рейдовых лобби
const raidLobbies = new Map(); // lobbyId -> { id, captainId, team, opponentTeam, status, stratagem, createdAt }
const raidTeams = new Map(); // playerId -> { lobbyId, role, playerId1, playerId2, playerId3 }
const raidBattles = new Map(); // battleId -> { team1, team2, scores, startTime, events, status }

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
    // Базовые скины (чаще)
    { id: 'chillcat', weight: 20, name: 'Чилл' },
    { id: 'hiding', weight: 20, name: 'Прячущаяся' },
    { id: 'beauty', weight: 18, name: 'Красавица' },
    { id: 'wild', weight: 15, name: 'Дикая' },
    { id: 'interesting', weight: 12, name: 'Интересная' },
    // Редкие скины
    { id: 'cyberpunk', weight: 8, name: 'Киберпанк' },
    { id: 'cute', weight: 5, name: 'Милашка' },
    { id: 'bugeyed', weight: 4, name: 'Глазастая' },
    { id: 'abitchonky', weight: 4, name: 'Пухляшка' }
  ],
  coins: [
    { amount: 500, weight: 40 },
    { amount: 1000, weight: 25 },
    { amount: 2500, weight: 15 },
    { amount: 5000, weight: 8 },
    { amount: 10000, weight: 3 }
  ]
};

// Награды Рыбного бокса - визуальные эффекты и временные баффы
const fishBoxRewards = {
  visualEffects: [
    // Базовые эффекты (чаще)
    { id: 'e1', name: 'Золотой клик', weight: 25, rarity: 'rare' },
    { id: 'e2', name: 'Неоновый свет', weight: 22, rarity: 'rare' },
    { id: 'e5', name: 'Волновой эффект', weight: 18, rarity: 'rare' },
    // Редкие эффекты
    { id: 'e3', name: 'Радужный след', weight: 12, rarity: 'epic' },
    { id: 'e4', name: 'Частицы звёзд', weight: 10, rarity: 'epic' },
    { id: 'e6', name: 'Огненное сияние', weight: 8, rarity: 'epic' },
    // Эпические эффекты
    { id: 'e7', name: 'Ледяной мороз', weight: 5, rarity: 'epic' },
    { id: 'e10', name: 'Призрачное сияние', weight: 4, rarity: 'epic' },
    // Легендарные эффекты
    { id: 'e8', name: 'Темная материя', weight: 2, rarity: 'legendary' },
    { id: 'e9', name: 'Электрический шторм', weight: 1.5, rarity: 'legendary' }
  ],
  tempBuff: [
    { type: 'multiplier', mult: 2, weight: 30, duration: 30, rarity: 'rare' },
    { type: 'multiplier', mult: 3, weight: 20, duration: 25, rarity: 'epic' },
    { type: 'multiplier', mult: 5, weight: 10, duration: 20, rarity: 'legendary' }
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
  console.log(`📥 Сервер получил openBox: id=${id}, boxId=${boxId}`);
  
  if (!id || !db.players[id]) {
    console.error(`❌ openBox: игрок ${id} не найден`);
    return;
  }
  
  const playerDB = db.players[id];
  const playerMem = players.get(id);
  const pendingBoxes = playerDB.pendingBoxes || [];
  console.log(`📦 Текущие боксы игрока: ${pendingBoxes.length} шт., массив:`, pendingBoxes);
  
  // Ищем бокс - сначала по точному совпадению ID, потом по шаблону 'box_*'
  let boxIndex = pendingBoxes.indexOf(boxId);
  
  // Если не нашли и ID начинается с 'box_' или 'fishbox_', ищем по индексу
  if (boxIndex === -1 && boxId && (boxId.startsWith('box_') || boxId.startsWith('fishbox_'))) {
    const numericIndex = parseInt(boxId.split('_')[1]);
    if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < pendingBoxes.length) {
      boxIndex = numericIndex;
      console.log(`📦 Найдён бокс по индексу: ${boxIndex}`);
    }
  }
  
  if (boxIndex === -1) {
    console.error(`❌ Бокс не найден: ${boxId}`);
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Бокс не найден' 
    }));
    return;
  }
  
  // Получаем реальный ID бокса
  const realBoxId = pendingBoxes[boxIndex];
  console.log(`📦 Реальный ID бокса: ${realBoxId}`);
  
  // Удаляем бокс
  pendingBoxes.splice(boxIndex, 1);
  playerDB.pendingBoxes = pendingBoxes;
  
  // Синхронизируем в памяти
  if (playerMem) {
    playerMem.pendingBoxes = [...pendingBoxes];
  }
  
  console.log(`💾 Удаляю бокс ${realBoxId}, осталось: ${pendingBoxes.length}`);
  savePlayerToDB(id);
  
  // Генерируем награду
  const isLegendary = Math.random() < 0.05; // 5% шанс
  const isEpic = Math.random() < 0.15 && !isLegendary; // 15% шанс (если не легендарка)
  const rarity = isLegendary ? 'legendary' : isEpic ? 'epic' : 'rare';
  
  const skins = Object.keys(playerDB.skins || {});
  const unlockedSkins = skins.filter(s => playerDB.skins[s]);
  
  let reward;
  if (isLegendary && unlockedSkins.length < skinsData.length) {
    // Легендарка - новый скин
    const availableSkins = skinsData.filter(s => !unlockedSkins.includes(s.id));
    if (availableSkins.length > 0) {
      const randomSkin = availableSkins[Math.floor(Math.random() * availableSkins.length)];
      reward = {
        type: 'skin',
        rarity: 'legendary',
        skinId: randomSkin.id,
        skinName: randomSkin.name
      };
      playerDB.skins[randomSkin.id] = true;
      if (playerMem) playerMem.skins[randomSkin.id] = true;
      console.log(`🎨 Легендарный скин: ${randomSkin.name}`);
    } else {
      // Все скины открыты - даём много монет
      reward = { type: 'whale', rarity: 'legendary', amount: 1000000 };
      playerDB.coins += 1000000;
      console.log(`💰 Все скины открыты! +1000000 монет`);
    }
  } else if (isEpic) {
    // Эпика - много косаток
    const amount = 50000;
    reward = { type: 'whale', rarity: 'epic', amount };
    playerDB.coins += amount;
    console.log(`🐋 Эпическая награда: +${amount} косаток`);
  } else {
    // Обычная - обычные косатки
    const amount = 1000 + Math.floor(Math.random() * 5000);
    reward = { type: 'whale', rarity: 'rare', amount };
    playerDB.coins += amount;
    console.log(`🐋 Обычная награда: +${amount} косаток`);
  }
  
  // Отправляем награду клиенту
  ws.send(JSON.stringify({ 
    type: 'boxOpened', 
    reward,
    pendingBoxes: playerDB.pendingBoxes.length
  }));
  
  console.log(`✅ Бокс открыт: ${realBoxId}, награда:`, reward);
}

function handleBuyFishBox(ws) {
  const id = ws.accountId || ws.playerId;
  if (!id || !db.players[id]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Игрок не найден' }));
    return;
  }
  
  const playerDB = db.players[id];
  const playerMem = players.get(id);
  
  const coins = playerMem ? playerMem.coins : playerDB.coins;
  
  if (coins < fishBoxPrice) {
    ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно косаток' }));
    return;
  }
  
  playerDB.coins = coins - fishBoxPrice;
  if (playerMem) {
    playerMem.coins = playerDB.coins;
  }
  
  if (!playerDB.pendingFishBoxes) {
    playerDB.pendingFishBoxes = [];
  }
  const fishBoxId = generateId();
  playerDB.pendingFishBoxes.push(fishBoxId);
  
  if (playerMem) {
    playerMem.pendingFishBoxes = [...playerDB.pendingFishBoxes];
  }
  
  savePlayerToDB(id);
  
  ws.send(JSON.stringify({ 
    type: 'fishBoxBought', 
    boxId: fishBoxId,
    coins: playerDB.coins,
    pendingFishBoxes: playerDB.pendingFishBoxes.length
  }));
  
  console.log(`🐟 Игрок ${id} купил Рыбный бокс. Всего рыбных боксов: ${playerDB.pendingFishBoxes.length}`);
}

function handleOpenFishBox(ws, boxId) {
  const id = ws.accountId || ws.playerId;
  console.log('📥 Сервер получил openFishBox:', { id, boxId });
  
  if (!id || !db.players[id]) {
    console.error('❌ Игрок не найден:', id);
    ws.send(JSON.stringify({ type: 'error', message: 'Игрок не найден' }));
    return;
  }
  
  const playerDB = db.players[id];
  const playerMem = players.get(id);
  const pendingFishBoxes = playerDB.pendingFishBoxes || [];
  console.log('🐟 Текущие рыбные боксы игрока:', pendingFishBoxes);
  
  // Ищем бокс - сначала по точному совпадению ID, потом по шаблону 'fishbox_*'
  let boxIndex = pendingFishBoxes.indexOf(boxId);
  
  // Если не нашли и ID начинается с 'fishbox_', ищем по индексу
  if (boxIndex === -1 && (boxId === 'fishbox' || boxId.startsWith('fishbox_'))) {
    const idx = parseInt(boxId.split('_')[1]) || 0;
    boxIndex = idx < pendingFishBoxes.length ? idx : -1;
  }
  
  console.log('🔍 Поиск рыбного бокса:', { boxId, boxIndex });
  
  if (boxIndex === -1) {
    console.error('❌ Рыбный бокс не найден в массиве!', { boxId, pendingFishBoxes });
    ws.send(JSON.stringify({ type: 'error', message: 'Рыбный бокс не найден' }));
    return;
  }
  
  const realBoxId = pendingFishBoxes[boxIndex];
  
  pendingFishBoxes.splice(boxIndex, 1);
  playerDB.pendingFishBoxes = pendingFishBoxes;
  
  if (playerMem) {
    playerMem.pendingFishBoxes = [...pendingFishBoxes];
  }
  
  // 50% шанс на визуальный эффект, 50% на временный бафф
  const isVisualEffect = Math.random() < 0.5;
  let reward = {};
  
  if (isVisualEffect) {
    const totalWeight = fishBoxRewards.visualEffects.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedEffect = fishBoxRewards.visualEffects[0];
    for (const effect of fishBoxRewards.visualEffects) {
      random -= effect.weight;
      if (random <= 0) { selectedEffect = effect; break; }
    }
    reward = {
      type: 'visualEffect',
      effectId: selectedEffect.id,
      effectName: selectedEffect.name,
      rarity: selectedEffect.rarity
    };
  } else {
    const totalWeight = fishBoxRewards.tempBuff.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedBuff = fishBoxRewards.tempBuff[0];
    for (const buff of fishBoxRewards.tempBuff) {
      random -= buff.weight;
      if (random <= 0) { selectedBuff = buff; break; }
    }
    reward = {
      type: 'tempBuff',
      buffType: selectedBuff.type,
      mult: selectedBuff.mult,
      duration: selectedBuff.duration,
      rarity: selectedBuff.rarity
    };
  }
  
  savePlayerToDB(id);
  
  ws.send(JSON.stringify({ 
    type: 'fishBoxOpened', 
    reward,
    pendingFishBoxes: playerDB.pendingFishBoxes.length
  }));
  
  console.log(`🐟 Игрок ${id} открыл Рыбный бокс ${realBoxId}. Награда: ${reward.type}. Всего рыбных боксов: ${playerDB.pendingFishBoxes.length}`);
}

// ==================== 3x3 РЕЙДОВЫЕ БИТВЫ ====================

// Создание рейдового лобби
function handleCreateRaidLobby(ws, isOpen = true) {
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  if (!player) {
    ws.send(JSON.stringify({ type: 'error', message: 'Игрок не найден' }));
    return;
  }
  
  // Проверка: игрок уже в лобби?
  if (raidTeams.has(id)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы уже в рейдовой команде' }));
    return;
  }
  
  const lobbyId = generateId();
  const lobbyCode = Math.floor(1000 + Math.random() * 9000).toString();
  
  raidLobbies.set(lobbyId, {
    id: lobbyId,
    captainId: id,
    captainName: player.name,
    team: [{ id, name: player.name, role: null }],
    opponentTeam: null,
    status: 'waiting', // waiting, ready, battling, finished
    stratagem: null,
    isOpen: isOpen,
    lobbyCode: lobbyCode,
    createdAt: Date.now()
  });
  
  raidTeams.set(id, { lobbyId, role: null });
  
  ws.send(JSON.stringify({ 
    type: 'raidLobbyCreated',
    lobbyId,
    captainName: player.name,
    lobbyCode,
    isOpen
  }));
  
  broadcastRaidLobbies();
  console.log(`🎮 Рейдовое лобби создано: ${lobbyId}, код: ${lobbyCode}`);
}

// Присоединение к рейдовому лобби
function handleJoinRaidLobby(ws, data) {
  const lobbyId = data.lobbyId;
  const code = data.code;
  const id = ws.accountId || ws.playerId;
  const player = players.get(id);
  
  if (!player) {
    ws.send(JSON.stringify({ type: 'error', message: 'Игрок не найден' }));
    return;
  }
  
  const lobby = raidLobbies.get(lobbyId);
  if (!lobby) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    return;
  }
  
  // Проверка: лобби закрыто - нужен код
  if (!lobby.isOpen && (!code || lobby.lobbyCode !== code)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Неверный код лобби' }));
    return;
  }
  
  // Проверка: лобби уже заполнено
  if (lobby.team.length >= 3) {
    ws.send(JSON.stringify({ type: 'error', message: 'Команда заполнена' }));
    return;
  }
  
  // Проверка: игрок уже в лобби
  if (raidTeams.has(id)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы уже в команде' }));
    return;
  }
  
  // Добавляем игрока
  lobby.team.push({ id, name: player.name, role: null });
  raidTeams.set(id, { lobbyId, role: null });
  
  ws.send(JSON.stringify({ 
    type: 'joinedRaidLobby',
    lobbyId,
    teamSize: lobby.team.length
  }));
  
  // Уведомляем капитана о присоединении и статусе
  const captainWs = players.get(lobby.captainId)?.ws;
  if (captainWs && captainWs.readyState === WebSocket.OPEN) {
    captainWs.send(JSON.stringify({
      type: 'playerJoinedRaidLobby',
      lobbyId,
      playerName: player.name,
      teamSize: lobby.team.length,
      isTeamFull: lobby.team.length >= 3,
      allRolesSelected: lobby.team.every(p => p.role)
    }));
  }
  
  // Уведомляем всех игроков о статусе команды
  lobby.team.forEach(member => {
    const memberWs = players.get(member.id)?.ws;
    if (memberWs && memberWs.readyState === WebSocket.OPEN) {
      memberWs.send(JSON.stringify({
        type: 'raidTeamStatus',
        lobbyId,
        teamSize: lobby.team.length,
        isTeamFull: lobby.team.length >= 3,
        allRolesSelected: lobby.team.every(p => p.role)
      }));
    }
  });
  
  console.log(`👥 Игрок ${player.name} присоединился к рейду: ${lobbyId}, команда: ${lobby.team.length}/3`);
}

// Выход из рейдового лобби
function handleLeaveRaidLobby(ws) {
  const id = ws.accountId || ws.playerId;
  const teamData = raidTeams.get(id);
  
  if (!teamData) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы не в команде' }));
    return;
  }
  
  const lobby = raidLobbies.get(teamData.lobbyId);
  if (lobby) {
    // Удаляем из команды
    lobby.team = lobby.team.filter(p => p.id !== id);
    
    // Если капитан вышел - удаляем лобби
    if (id === lobby.captainId || lobby.team.length === 0) {
      raidLobbies.delete(teamData.lobbyId);
      ws.send(JSON.stringify({ type: 'raidLobbyDeleted' }));
    } else {
      // Уведомляем остальных
      lobby.team.forEach(member => {
        const memberWs = players.get(member.id)?.ws;
        if (memberWs && memberWs.readyState === WebSocket.OPEN) {
          memberWs.send(JSON.stringify({
            type: 'playerLeftRaidLobby',
            lobbyId: teamData.lobbyId,
            playerName: players.get(id)?.name || 'Unknown'
          }));
        }
      });
    }
  }
      
  raidTeams.delete(id);
  broadcastRaidLobbies();
}

// Выбор роли в рейде
function handleSelectRaidRole(ws, role) {
  const id = ws.accountId || ws.playerId;
  const teamData = raidTeams.get(id);
  
  if (!teamData) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы не в команде' }));
    return;
  }
  
  if (!RAID_ROLES[role]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Неверная роль' }));
    return;
  }
  
  const lobby = raidLobbies.get(teamData.lobbyId);
  if (!lobby) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    return;
  }
  
  // Проверка: роль уже выбрана кем-то в команде
  const roleTaken = lobby.team.some(p => p.role === role);
  if (roleTaken) {
    ws.send(JSON.stringify({ type: 'error', message: 'Эта роль уже выбрана' }));
    return;
  }
  
  // Устанавливаем роль
  teamData.role = role;
  const playerInTeam = lobby.team.find(p => p.id === id);
  if (playerInTeam) {
    playerInTeam.role = role;
  }
  
  ws.send(JSON.stringify({ 
    type: 'raidRoleSelected',
    role,
    roleData: RAID_ROLES[role]
  }));
  
  console.log(`🎭 Игрок выбрал роль ${role} в рейде ${teamData.lobbyId}`);
}

// Выбор стратегемы (только капитан)
function handleSelectRaidStratagem(ws, stratagem) {
  const id = ws.accountId || ws.playerId;
  const teamData = raidTeams.get(id);
  
  if (!teamData) {
    ws.send(JSON.stringify({ type: 'error', message: 'Вы не в команде' }));
    return;
  }
  
  const lobby = raidLobbies.get(teamData.lobbyId);
  if (!lobby || id !== lobby.captainId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Только капитан может выбрать стратегему' }));
    return;
  }
  
  if (!RAID_STRATEGEMS[stratagem]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Неверная стратегема' }));
    return;
  }
  
  lobby.stratagem = stratagem;
  
  ws.send(JSON.stringify({ 
    type: 'raidStratagemSelected',
    stratagem,
    stratagemData: RAID_STRATEGEMS[stratagem]
  }));
  
  console.log(`🎯 Капитан выбрал стратегему ${stratagem} для рейда ${teamData.lobbyId}`);
}

// Запуск рейдовой битвы
function handleStartRaidBattle(ws, lobbyId) {
  const id = ws.accountId || ws.playerId;
  const lobby = raidLobbies.get(lobbyId);
  
  if (!lobby) {
    ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    return;
  }
  
  if (id !== lobby.captainId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Только капитан может начать бой' }));
    return;
  }
  
  if (lobby.team.length < 3) {
    ws.send(JSON.stringify({ type: 'error', message: 'Нужно 3 игрока для начала боя' }));
    return;
  }
  
  // Проверка: все выбрали роли?
  const allRolesSelected = lobby.team.every(p => p.role);
  if (!allRolesSelected) {
    ws.send(JSON.stringify({ type: 'error', message: 'Все игроки должны выбрать роль' }));
    return;
  }
  
  // TODO: Поиск соперника (временно - автоматическое начало)
  lobby.status = 'battling';
  
  // Создаём битву
  const battleId = generateId();
  const battle = {
    id: battleId,
    lobbyId: lobbyId,
    team1: lobby.team.map(p => ({ 
      id: p.id, 
      name: p.name, 
      role: p.role,
      clicks: 0,
      multiplier: RAID_ROLES[p.role].multiplier
    })),
    team2: [], // Будет заполнено при поиске соперника
    scores: { team1: 0, team2: 0 },
    startTime: Date.now(),
    duration: 60, // 60 секунд
    events: [],
    status: 'active',
    currentEvent: null
  };
  
  raidBattles.set(battleId, battle);
  
  // Уведомляем команду
  lobby.team.forEach(member => {
    const memberWs = players.get(member.id)?.ws;
    if (memberWs && memberWs.readyState === WebSocket.OPEN) {
      memberWs.send(JSON.stringify({
        type: 'raidBattleStart',
        battleId,
        team: battle.team1,
        duration: 60
      }));
    }
  });
  
  console.log(`⚔️ Рейдовая битва началась: ${battleId}`);
}

// Обработка клика в рейде
function handleRaidClick(ws, data) {
  const id = ws.accountId || ws.playerId;
  const battleId = data.battleId;
  const clicks = data.clicks || 1;
  
  const battle = raidBattles.get(battleId);
  if (!battle || battle.status !== 'active') {
    return;
  }
  
  // Находим игрока в команде
  const player = battle.team1.find(p => p.id === id);
  if (!player) {
    return;
  }
  
  // Добавляем клики
  player.clicks += clicks;
  
  // Рассчитываем очки с учётом роли
  const playerScore = player.clicks * player.multiplier;
  
  // Обновляем общий счёт команды
  battle.scores.team1 = battle.team1.reduce((sum, p) => sum + (p.clicks * p.multiplier), 0);
  
  // Отправляем обновление
  ws.send(JSON.stringify({
    type: 'raidBattleUpdate',
    battleId,
    playerId: id,
    clicks: player.clicks,
    score: playerScore,
    teamScore: battle.scores.team1
  }));
}

// Получение списка рейдовых лобби
function handleGetRaidLobbies(ws) {
  const lobbies = Array.from(raidLobbies.values())
    .filter(l => l.status === 'waiting')
    .map(l => ({
      lobbyId: l.id,
      captainName: l.captainName,
      teamSize: l.team.length,
      isOpen: l.isOpen,
      lobbyCode: l.isOpen ? null : l.lobbyCode,
      stratagem: l.stratagem
    }));
  
  ws.send(JSON.stringify({
    type: 'raidLobbies',
    lobbies
  }));
}

// Трансляция рейдовых лобби всем клиентам
function broadcastRaidLobbies() {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      const lobbies = Array.from(raidLobbies.values())
        .filter(l => l.status === 'waiting')
        .map(l => ({
          lobbyId: l.id,
          captainName: l.captainName,
          teamSize: l.team.length,
          isOpen: l.isOpen,
          lobbyCode: l.isOpen ? null : l.lobbyCode
        }));
      
      client.send(JSON.stringify({
        type: 'raidLobbies',
        lobbies
      }));
    }
  });
}

// Запуск таймера рейдовых событий
setInterval(() => {
  raidBattles.forEach((battle, battleId) => {
    if (battle.status !== 'active') return;
    
    const elapsed = Math.floor((Date.now() - battle.startTime) / 1000);
    
    // Проверка событий
    RAID_EVENTS.forEach(event => {
      if (elapsed === event.time && !battle.events.includes(event.type)) {
        battle.events.push(event.type);
        battle.currentEvent = event;
        
        // Отправляем событие всем участникам
        battle.team1.forEach(player => {
          const playerWs = players.get(player.id)?.ws;
          if (playerWs && playerWs.readyState === WebSocket.OPEN) {
            playerWs.send(JSON.stringify({
              type: 'raidBattleEvent',
              battleId,
              event: event
            }));
          }
        });
        
        console.log(`🎭 Рейдовое событие: ${event.name} в битве ${battleId}`);
      }
    });
    
    // Конец боя через 60 секунд
    if (elapsed >= battle.duration) {
      battle.status = 'finished';
      
      // TODO: Подсчёт результатов и награды
      
      // Уведомляем о конце боя
      battle.team1.forEach(player => {
        const playerWs = players.get(player.id)?.ws;
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
          playerWs.send(JSON.stringify({
            type: 'raidBattleEnd',
            battleId,
            teamScore: battle.scores.team1
          }));
        }
      });
      
      // Удаляем битву через 30 секунд
      setTimeout(() => {
        raidBattles.delete(battleId);
      }, 30000);
      
      console.log(`✅ Рейдовая битва завершена: ${battleId}`);
    }
  });
}, 1000);

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT получен, сервер останавливается...');
  wss.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM получен (Render shutdown), сервер останавливается...');
  wss.close(() => process.exit(0));
});
