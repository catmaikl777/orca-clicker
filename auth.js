// ==================== Система аккаунтов ====================

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Хеш пароля с bcrypt (безопасный)
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Проверка пароля
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Регистрация нового аккаунта
async function handleRegister(ws, data, db, players, saveDB, broadcastEventInfo, broadcastLeaderboard, updateLeaderboard, savePlayerToDB, dbAdapter) {
  const { username, password } = data;
  
  if (!username || !password) {
    ws.send(JSON.stringify({ type: 'authError', message: 'Введите имя и пароль' }));
    return;
  }
  
  if (password.length < 4) {
    ws.send(JSON.stringify({ type: 'authError', message: 'Пароль должен быть от 4 символов' }));
    return;
  }
  
  // Ищем аккаунт по username
  let accountId = Object.keys(db.accounts || {}).find(id => 
    db.accounts[id].username.toLowerCase() === username.toLowerCase()
  );
  
  if (accountId) {
    // Аккаунт существует - проверяем пароль
    const account = db.accounts[accountId];
    const isValid = await verifyPassword(password, account.passwordHash);
    if (!isValid) {
      ws.send(JSON.stringify({ type: 'authError', message: 'Неверный пароль' }));
      return;
    }
    
    // Пароль верный - входим
    account.lastLogin = Date.now();
    ws.authenticated = true;
    ws.accountId = accountId;
    
    // Получаем или создаём игровые данные
    let playerData = db.players[accountId];
    console.log(`🔍 [auth.js] playerData из db.players: ${accountId}, exists=${!!playerData}, coins=${playerData?.coins}, type=${typeof playerData}`);
    
    if (!playerData && dbAdapter && dbAdapter.usePostgreSQL) {
      // Загружаем из БД если нет в памяти
      try {
        const dbPlayer = await dbAdapter.getPlayer(accountId);
        if (dbPlayer) {
          console.log(`💾 [auth.js] Загружен игрок из БД: ${accountId}, coins=${dbPlayer.coins}`);
          playerData = {
            id: dbPlayer.id,
            name: dbPlayer.name,
            coins: dbPlayer.coins || 0,
            totalCoins: dbPlayer.total_coins || 0,
            perClick: dbPlayer.per_click || 1,
            perSecond: dbPlayer.per_second || 0,
            clicks: dbPlayer.clicks || 0,
            level: dbPlayer.level || 1,
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
            eventRewards: dbPlayer.event_rewards || 0,
            createdAt: dbPlayer.created_at || Date.now(),
            lastLogin: dbPlayer.last_login || Date.now(),
            antiCheat: null
          };
          db.players[accountId] = playerData;
          playerData._justLoadedFromDB = Date.now();  // Помечаем что только что загружен из БД
        }
      } catch (err) {
        console.error(`❌ [auth.js] Ошибка загрузки игрока из БД:`, err.message);
      }
    }
    
    if (!playerData) {
      playerData = createDefaultPlayer(accountId, account.username);
      db.players[accountId] = playerData;
      db.stats.totalPlayers++;
    }
    
    players.set(accountId, { ...playerData, ws });
    updateLeaderboard(playerData);
    // Не сохраняем сразу - это сделает websocket-server.js после загрузки из БД
    
    // Лог для отладки - что отправляем клиенту
    console.log(`📤 authSuccess: accountId=${accountId}, username=${account.username}, coins=${playerData.coins}, totalCoins=${playerData.totalCoins}`);
    console.log(`📤 authSuccess data object:`, {
      id: playerData.id,
      name: playerData.name,
      coins: playerData.coins,
      totalCoins: playerData.totalCoins,
      level: playerData.level,
      clan: playerData.clan
    });
    
    ws.send(JSON.stringify({ 
      type: 'authSuccess',
      accountId,
      username: account.username,
      data: playerData,
      eventCoins: db.event.eventCoins[accountId] || 0
    }));
    
    console.log(`✅ Вход: ${account.username}, coins=${playerData.coins}`);
    broadcastLeaderboard();
    broadcastEventInfo();
    
  } else {
    // Создаём новый аккаунт
    accountId = generateId();
    const usernameLower = username.toLowerCase();
    
    // Проверяем что username не занят
    const existing = Object.values(db.accounts || {}).find(a => 
      a.username.toLowerCase() === usernameLower
    );
    if (existing) {
      ws.send(JSON.stringify({ type: 'authError', message: 'Имя занято' }));
      return;
    }
    
    db.accounts[accountId] = {
      id: accountId,
      username: username,
      passwordHash: await hashPassword(password),
      createdAt: Date.now(),
      lastLogin: Date.now()
    };
    
    const playerData = createDefaultPlayer(accountId, username);
    db.players[accountId] = playerData;
    db.stats.totalPlayers++;
    
    console.log(`📝 Создаю игрока: id=${accountId}, name=${playerData.name}`);
    
    ws.authenticated = true;
    ws.accountId = accountId;
    ws.username = username;
    players.set(accountId, { ...playerData, ws });
    updateLeaderboard(playerData);
    // Не сохраняем сразу - это сделает websocket-server.js
    
    ws.send(JSON.stringify({ 
      type: 'authSuccess',
      accountId,
      username: username,
      data: playerData,
      eventCoins: db.event?.eventCoins?.[accountId] || 0,
      isNew: true
    }));
    
    console.log(`🆕 Регистрация: ${username}`);
    broadcastLeaderboard();
    broadcastEventInfo();
  }
}

// Создание игрока по умолчанию
function createDefaultPlayer(accountId, username) {
  return {
    id: accountId,
    name: username,
    coins: 0,
    totalCoins: 0,
    perClick: 0,
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
    shopItems: [],
    questProgress: [],
    dailyQuestDate: null,
    dailyQuestIds: [],
    dailyProgress: { clicks: 0, coins: 0, playTime: 0 },
    createdAt: Date.now(),
    lastLogin: Date.now()
  };
}

// Генерация ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

module.exports = {
  handleRegister,
  hashPassword,
  verifyPassword,
  createDefaultPlayer,
  generateId
};
