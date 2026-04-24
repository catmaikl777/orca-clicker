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
async function handleRegister(ws, data, db, players, saveDB, broadcastEventInfo, broadcastLeaderboard, updateLeaderboard, savePlayerToDB) {
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
    if (!playerData) {
      playerData = createDefaultPlayer(accountId, account.username);
      db.players[accountId] = playerData;
      db.stats.totalPlayers++;
    }
    
    players.set(accountId, { ...playerData, ws });
    updateLeaderboard(playerData);
    saveDB();
    savePlayerToDB(accountId);
    
    ws.send(JSON.stringify({ 
      type: 'authSuccess',
      accountId,
      username: account.username,
      data: playerData,
      eventCoins: db.event.eventCoins[accountId] || 0
    }));
    
    console.log(`✅ Вход: ${account.username}`);
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
    ws.username = username; // Сохраняем username
    players.set(accountId, { ...playerData, ws });
    updateLeaderboard(playerData);
    saveDB();
    savePlayerToDB(accountId);
    
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
    shopItems: [], // Цены предметов (пусто = дефолтные цены)
    questProgress: [],
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
