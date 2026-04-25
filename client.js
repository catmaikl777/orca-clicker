// ==================== ИГРОВЫЕ ДАННЫЕ ====================
const game = {
  coins: 0,
  totalCoins: 0,
  level: 1,
  basePerClick: 1,
  basePerSecond: 0,
  clicks: 0,
  startTime: Date.now(),
  skills: {},
  achievements: [],
  quests: [],
  questsProgress: {},
  skins: {},
  currentSkin: 'normal',
  playTime: 0,
  multiplier: 1
};

// ==================== DOM ЭЛЕМЕНТЫ ====================
let coinsEl, levelEl, perClickEl, perSecondEl;
let clicker, orcaImg, orcaEmoji;
let bonus, fishBonus, x2Bonus;

// Инициализация DOM элементов
function initDOM() {
  coinsEl = document.getElementById('coins');
  levelEl = document.getElementById('level');
  perClickEl = document.getElementById('perClick');
  perSecondEl = document.getElementById('perSecond');
  clicker = document.getElementById('clicker');
  orcaImg = document.getElementById('orcaImg');
  orcaEmoji = document.getElementById('orcaEmoji');
  bonus = document.getElementById('bonus');
  fishBonus = document.getElementById('fishBonus');
  x2Bonus = document.getElementById('x2Bonus');
  
  // Обработчик клика по косатке
  if (clicker) {
    clicker.addEventListener('click', handleClick);
  }
  
  // Инициализация обработчиков бонусов
  if (x2Bonus) {
    x2Bonus.addEventListener('click', handleX2BonusClick);
  }
  if (bonus) {
    bonus.addEventListener('click', handleBonusClick);
  }
  if (fishBonus) {
    fishBonus.addEventListener('click', handleFishBonusClick);
  }
  
  // Запускаем спавн бонусов
  setInterval(spawnBonus, 12000);
}

// Утилита для экранирования HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Магазин - улучшения с иконками
const shopItems = [
  { id: 'click1', name: 'Острые зубы', desc: '+1 к клику', cost: 50, type: 'click', value: 1, icon: 'click_booster.png' },
  { id: 'click2', name: 'Акулий хвост', desc: '+5 к клику', cost: 250, type: 'click', value: 5, icon: 'click_booster.png' },
  { id: 'click3', name: 'Китовая сила', desc: '+25 к клику', cost: 1000, type: 'click', value: 25, icon: 'click_booster.png' },
  { id: 'auto1', name: 'Маленькая рыбка', desc: '+1/сек', cost: 100, type: 'auto', value: 1, icon: 'auto_booster.png' },
  { id: 'auto2', name: 'Стая рыб', desc: '+5/сек', cost: 500, type: 'auto', value: 5, icon: 'auto_booster.png' },
  { id: 'auto3', name: 'Косяк тунца', desc: '+25/сек', cost: 2500, type: 'auto', value: 25, icon: 'auto_booster.png' },
  { id: 'auto4', name: 'Океан богатств', desc: '+100/сек', cost: 10000, type: 'auto', value: 100, icon: 'auto_booster.png' },
  { id: 'click4', name: 'Легенда океана', desc: '+100 к клику', cost: 50000, type: 'click', value: 100, icon: 'click_booster.png' },
  { id: 'auto5', name: 'Царство косаток', desc: '+500/сек', cost: 100000, type: 'auto', value: 500, icon: 'auto_booster.png' }
];

// Каталог предметов с базовыми ценами (для сброса при смене аккаунта)
const SHOP_CATALOG = [
  { id: 'click1', baseCost: 50 },
  { id: 'click2', baseCost: 250 },
  { id: 'click3', baseCost: 1000 },
  { id: 'click4', baseCost: 50000 },
  { id: 'auto1', baseCost: 100 },
  { id: 'auto2', baseCost: 500 },
  { id: 'auto3', baseCost: 2500 },
  { id: 'auto4', baseCost: 10000 },
  { id: 'auto5', baseCost: 100000 }
];

// Скины с изображениями
const skinsData = [
  { id: 'normal', name: 'Обычная', cost: 0, image: 'normal.png' },
  { id: 'chillcat', name: 'Чилл', cost: 2000, image: 'CHILLCAT.png' },
  { id: 'hiding', name: 'Прячущаяся', cost: 1500, image: 'cat_hiding.png' },
  { id: 'beauty', name: 'Красавица', cost: 3000, image: 'beauty_cat.png' },
  { id: 'wild', name: 'Дикая', cost: 4000, image: 'wild_cat.png' },
  { id: 'cyberpunk', name: 'Киберпанк', cost: 7500, image: 'skin_cyberpunk.png' },
  { id: 'interesting', name: 'Интересная', cost: 5000, image: 'interesting.png' }
];

// Квесты
const questsData = [
  { id: 'q1', name: 'Первые шаги', desc: 'Сделайте 100 кликов', target: 100, type: 'clicks', reward: 100 },
  { id: 'q2', name: 'Богач', desc: 'Накопите 1000 косаток', target: 1000, type: 'coins', reward: 200 },
  { id: 'q3', name: 'Кликер мастер', desc: 'Сделайте 1000 кликов', target: 1000, type: 'clicks', reward: 500 },
  { id: 'q4', name: 'Миллионер', desc: 'Накопите 1000000 косаток', target: 1000000, type: 'totalCoins', reward: 10000 }
];

// Достижения
const achievementsData = [
  { id: 'a1', name: 'Дебютант', desc: 'Сделайте первый клик', icon: '👆' },
  { id: 'a2', name: 'Усердный', desc: 'Сделайте 100 кликов', icon: '💪' },
  { id: 'a3', name: 'Миллионер', desc: 'Накопите 1,000,000', icon: '💰' },
  { id: 'a4', name: 'Коллекционер', desc: 'Купите все улучшения', icon: '🏆' },
  { id: 'a5', name: 'Мастер клика', desc: 'Достигните 1000 за клик', icon: '⚡' },
  { id: 'a6', name: 'Пассивный доход', desc: 'Достигните 1000/сек', icon: '📈' }
];

// Эффекты (визуальные изменения + бонусы) - сохраняются как в магазине
const effectsData = [
  { id: 'e1', name: 'Золотой клик', desc: '+2x к клику, золотое свечение', cost: 500, icon: '✨', bonus: { type: 'click', mult: 2 } },
  { id: 'e2', name: 'Неоновый свет', desc: '+50% к авто-доходу, неоновое свечение', cost: 1000, icon: '💡', bonus: { type: 'auto', mult: 1.5 } },
  { id: 'e3', name: 'Радужный след', desc: '+3x к клику, радужный эффект', cost: 2000, icon: '🌈', bonus: { type: 'click', mult: 3 } },
  { id: 'e4', name: 'Частицы звёзд', desc: '+100% к авто-доходу, звёздные частицы', cost: 3000, icon: '⭐', bonus: { type: 'auto', mult: 2 } },
  { id: 'e5', name: 'Эффект волны', desc: '+5x к клику, волновая анимация', cost: 1500, icon: '🌊', bonus: { type: 'click', mult: 5 } },
  { id: 'e6', name: 'Огненное сияние', desc: '+10x к клику, огненное свечение', cost: 2500, icon: '🔥', bonus: { type: 'click', mult: 10 } }
];

// Расчет perClick (без навыков - только апгрейды из магазина)
function getPerClick() {
  return (1 + (game.basePerClick || 0));
}

// Расчет perSecond (без навыков - только апгрейды из магазина)
function getPerSecond() {
  return (game.basePerSecond || 0);
}

// ==================== WEBSOCKET ====================
let ws = null;
window.ws = null;
let playerId = null;
let battleId = null;
let battleClicks = 0;
let lastBattleUpdate = 0;
let battleInterval = null;
let wsConnected = false;
let autoClickInterval = null; // Храним интервал автодохода

// Буфер для кликов (отправляем пачками)
let clickBuffer = [];
let lastServerSync = Date.now();
const MAX_CLICKS_PER_SEC = 50; // Максимум 50 кликов в секунду для защиты от спама

// ==================== АНТИ-ОВЕРЛЕЙ / ФОКУС ====================
let windowFocused = document.hasFocus();
let pageVisible = document.visibilityState === 'visible';
let lastFocusWarnAt = 0;

function updateFocusState() {
  windowFocused = document.hasFocus();
  pageVisible = document.visibilityState === 'visible';
}

window.addEventListener('focus', updateFocusState);
window.addEventListener('blur', updateFocusState);
document.addEventListener('visibilitychange', updateFocusState);

function canPlayActions() {
  updateFocusState();
  return windowFocused && pageVisible;
}

const clickSounds = ['clickSound', 'mainmeow1', 'mainmeow2', 'mainmeow3', 'mainmeow4'];

// Настройки WebSocket сервера
// Для локальной разработки: ws://localhost:3001
// Для продакшена: используется переменная окружения или автоматическое определение
const WS_SERVER_URL = (() => {
  // Проверяем переменные окружения
  if (typeof process !== 'undefined' && process.env?.VITE_WS_URL) {
    return process.env.VITE_WS_URL;
  }
  
  // Локальная разработка
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:3001';
  }
  
  // Продакшен - используем WSS на том же хосте
  return 'wss://orca-clicker-api.onrender.com';
})();

function connectWebSocket() {
  console.log('🔌 Подключение к WebSocket:', WS_SERVER_URL);
  ws = new WebSocket(WS_SERVER_URL);
  window.ws = ws;
  
  ws.onopen = () => {
    console.log('✅ Подключено к серверу');
    wsConnected = true;
    
    // Если есть авторизованный пользователь, отправляем данные для восстановления сессии
    if (typeof currentUser !== 'undefined' && currentUser && !isGuest) {
      console.log(`📤 Восстановление сессии: ${currentUser.username}`);
      // Отправляем информацию об аккаунте на восстановление
      ws.send(JSON.stringify({
        type: 'restoreSession',
        accountId: currentUser.id,
        username: currentUser.username
      }));
    } else if (typeof isGuest !== 'undefined' && isGuest) {
      // Режим гостя
      const name = document.getElementById('accountNameDisplay')?.textContent || 'Гость';
      ws.send(JSON.stringify({ type: 'register', name }));
    } else {
      // Нет учетной записи - просто регистрируемся как гость
      const name = 'Player_' + Math.random().toString(36).substr(2, 5);
      ws.send(JSON.stringify({ type: 'register', name }));
    }
    
    ws.send(JSON.stringify({ type: 'getLeaderboard' }));
    ws.send(JSON.stringify({ type: 'getClans' }));
    
    // Обновляем UI лобби если открыта вкладка
    setTimeout(() => {
      if (document.getElementById('battleLobbyView')?.classList.contains('active')) {
        ws.send(JSON.stringify({ type: 'getBattleLobbies' }));
      }
    }, 200);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    } catch (e) {
      console.error('❌ Ошибка парсинга сообщения:', e);
    }
  };
  
  ws.onclose = () => {
    console.log('⚠️ Отключено от сервера, переподключение...');
    wsConnected = false;
    
    // Обновляем UI лобби если открыто
    const container = document.getElementById('battleLobbyList');
    if (container && document.getElementById('battleLobbyView')?.classList.contains('active')) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:#ff6b6b">❌ Отключено от сервера. Переподключение...</p>';
    }
    
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('❌ WebSocket ошибка:', error);
    wsConnected = false;
  };
}

function handleServerMessage(data) {
  // Обработка ответа на аутентификацию с аккаунтом (успех)
  if (data.type === 'authSuccess') {
    console.log(`✅ Аутентификация успешна: ${data.username}`);
    
    // СБРОС цен магазина к дефолтным перед загрузкой (чтобы не было цен от предыдущего аккаунта)
    shopItems.forEach(item => {
      const catalogItem = SHOP_CATALOG?.find(i => i.id === item.id);
      if (catalogItem) {
        item.cost = catalogItem.baseCost;
      } else {
        // Дефолтные цены если каталог недоступен
        const defaultCosts = { click1: 50, click2: 250, click3: 1000, click4: 50000, auto1: 100, auto2: 500, auto3: 2500, auto4: 10000, auto5: 100000 };
        item.cost = defaultCosts[item.id] || item.cost;
      }
    });
    
    // Сохраняем информацию об аккаунте
    const isNewAccount = !currentUser || currentUser.id !== data.accountId;
    if (typeof currentUser === 'undefined' || !currentUser) {
      currentUser = {
        id: data.accountId,
        username: data.username
      };
    } else {
      currentUser.id = data.accountId;
      currentUser.username = data.username;
    }
    
    localStorage.setItem('userSession', JSON.stringify(currentUser));
    
    // Загружаем сохраненные данные игрока если есть
    if (data.data) {
      const d = data.data;
      game.coins = d.coins || 0;
      game.totalCoins = d.totalCoins || 0;
      game.level = d.level || 1;
      // Загружаем БАЗОВЫЕ значения апгрейдов (множители навыков применяются отдельно)
      // basePerClick/basePerSecond = сумма апгрейдов из магазина (без базового 1/0)
      game.basePerClick = d.basePerClick ?? d.perClick ?? 0; // 0 если апгрейдов нет
      game.basePerSecond = d.basePerSecond ?? d.perSecond ?? 0;
      game.clicks = d.clicks || 0;
      game.effects = d.effects || {};
      game.achievements = d.achievements || [];
      game.skins = d.skins || { normal: true };
      game.currentSkin = d.currentSkin || 'normal';
      game.playTime = d.playTime || 0;
      
      // Боксы
      if (d.pendingBoxes) pendingBoxes = d.pendingBoxes;
      
      // Цены улучшений - загружаем ТОЛЬКО если есть shopItems от сервера
      if (d.shopItems && Array.isArray(d.shopItems)) {
        d.shopItems.forEach(saved => {
          const item = shopItems.find(i => i.id === saved.id);
          if (item) item.cost = saved.cost;
        });
        console.log('🛒 Цены загружены с сервера:', d.shopItems);
      } else {
        console.log('🛒 Новый аккаунт - используются дефолтные цены');
      }
      
      // Прогресс квестов
      if (d.questProgress) {
        game.quests = questsData.map(q => {
          const saved = d.questProgress.find(p => p.id === q.id);
          return { ...q, completed: saved ? saved.completed : false };
        });
      } else {
        initQuests();
      }
      
      // Билеты ивента
      if (data.eventCoins) eventCoins = data.eventCoins;
      
      // Лог для отладки
      console.log(`🎮 Данные загружены: basePerClick=${game.basePerClick}, basePerSecond=${game.basePerSecond}`);
      
      // Эффекты загружены, они применяются визуально
    }
    
    playerId = data.accountId;
    wsConnected = true;
    
    updateUI();
    if (typeof updateAccountDisplay === 'function') {
      updateAccountDisplay();
    }
    if (typeof showGameScreen === 'function') {
      showGameScreen();
    }
    
    // Применяем визуальные эффекты после загрузки данных
    applyEffects();
    
    console.log('🎮 Игровые данные загружены');
    
    // Отправляем запрос на получение лобби если открыта модалка батла
    setTimeout(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getBattleLobbies' }));
      }
    }, 300);
    
    return;
  }
  
  // Обработка ошибок аутентификации
  if (data.type === 'authError') {
    console.error('❌ Ошибка аутентификации:', data.message);
    if (typeof showAuthError === 'function') {
      showAuthError(data.message);
    }
    return;
  }

  // Остальные типы сообщений обрабатываются как раньше
  switch (data.type) {
    case 'connected':
      console.log('Соединение установлено');
      break;
    case 'registered':
      playerId = data.playerId;
      console.log('Зарегистрирован:', playerId);
      if (data.data) {
        const oldCoins = game.coins;
        game.coins = data.data.coins || 0;
        game.totalCoins = data.data.totalCoins || 0;
        game.basePerClick = data.data.basePerClick ?? data.data.perClick ?? 0;
        game.basePerSecond = data.data.basePerSecond ?? data.data.perSecond ?? 0;
        game.clicks = data.data.clicks || 0;
        game.effects = data.data.effects || {};
        game.skins = data.data.skins || {};
        game.currentSkin = data.data.currentSkin || 'normal';
        eventCoins = data.eventCoins || 0;
        
        // Лог для отладки
        console.log(`🎮 Гость: basePerClick=${game.basePerClick}, basePerSecond=${game.basePerSecond}`);
        
        // Показываем уведомление если монеты изменились (награды ивента)
        if (game.coins > oldCoins + 1000) {
          showNotification(`💰 Награда ивента: +${formatNumber(game.coins - oldCoins)}!`);
          playSound('bonusSound');
        }
        
        updateUI();
        renderShop();
        renderBoxes();
        applyEffects();  // Применяем эффекты для гостя
      }
      break;
    case 'eventInfo':
      eventInfo = data.event;
      eventCoins = data.event.eventCoins || 0;
      console.log(`🎫 eventInfo получено: eventCoins=${eventCoins}, topPlayers=${eventInfo.topPlayers?.length || 0}`);
      updateEventUI();
      renderEventLeaderboard();
      break;
    case 'leaderboard':
      updateLeaderboardUI(data.data);
      break;
    case 'waitingForBattle':
      document.getElementById('battleStatus').textContent = 'Поиск соперника...';
      break;
    case 'error':
      // Специальная обработка для ошибок батла
      if (data.message && data.message.includes('Лобби')) {
        document.getElementById('battleLobby').classList.remove('hidden');
        document.getElementById('battleStatus').textContent = data.message;
      } else if (data.message) {
        showNotification(`⚠️ ${data.message}`);
        // Возвращаемся к UI лобби если была ошибка
        if (currentLobbyId) {
          document.getElementById('battleQuickSearch').classList.remove('hidden');
          document.getElementById('battleLobbyView').classList.remove('hidden');
        }
      }
      break;
    case 'battleStart':
      startBattleUI(data);
      break;
    case 'battleUpdate':
      updateBattleUI(data);
      if (data.eventCoinsEarned && data.eventCoinsEarned > 0) {
        addEventCoins(data.eventCoinsEarned);
        showNotification(`+${data.eventCoinsEarned} 🎫`);
      }
      break;
    case 'battleEnd':
      endBattleUI(data);
      break;
    case 'clans':
      updateClansUI(data.data || []);
      break;
    case 'clanMembers':
      if (window.updateClanMembersUI) window.updateClanMembersUI(data.members);
      break;
    case 'battleLobbies':
      updateBattleLobbiesUI(data.lobbies);
      break;
    case 'lobbyCreated':
      showNotification('🏠 Лобби создано! Ожидание соперника...');
      // Обновляем UI моего лобби
      updateMyLobbyUI({
        id: data.lobbyId,
        ownerName: data.ownerName,
        hasOpponent: false,
        opponentName: null
      });
      break;
    case 'joinedLobby':
      showNotification('👥 Вы вступили в лобби!');
      // Обновляем UI моего лобби
      updateMyLobbyUI({
        id: data.lobbyId,
        ownerName: data.ownerName,
        hasOpponent: false,
        opponentName: null
      });
      break;
    case 'opponentJoined':
      showNotification(`🎉 ${data.opponentName} вступил в ваше лобби!`);
      // Обновляем UI моего лобби
      updateMyLobbyUI({
        id: data.lobbyId,
        ownerName: data.ownerName,
        hasOpponent: true,
        opponentName: data.opponentName
      });
      break;
    case 'opponentLeft':
      showNotification('😢 Соперник покинул лобби');
      // Обновляем UI моего лобби
      updateMyLobbyUI({
        id: data.lobbyId,
        ownerName: data.ownerName,
        hasOpponent: false,
        opponentName: null
      });
      break;
    case 'opponentDisconnected':
      showNotification('⚠️ Соперник отключился');
      updateMyLobbyUI({
        id: data.lobbyId,
        ownerName: data.ownerName,
        hasOpponent: false,
        opponentName: null
      });
      break;
    case 'leftLobby':
      showNotification('🚪 Вы покинули лобби');
      updateMyLobbyUI(null);
      break;
    case 'clanCreated':
      showNotification(`🏰 Клан "${data.name}" создан!`);
      ws.send(JSON.stringify({ type: 'getClanMembers' }));
      break;
    case 'joinedClan':
      showNotification(`👥 Вы вступили в клан "${data.name}"!`);
      ws.send(JSON.stringify({ type: 'getClanMembers' }));
      break;
    case 'leftClan':
      showNotification('🚪 Вы вышли из клана');
      break;
    case 'effectBought':
      // Сервер подтвердил покупку эффекта
      if (!game.effects) game.effects = {};
      game.effects[data.effectId] = true;
      showNotification(`✨ Эффект «${data.effectName}» куплен!`);
      applyEffects();  // Применяем визуальный эффект
      renderShop();
      updateUI();
      saveGame();
      break;
    case 'boxBought':
      // Сервер подтвердил покупку - обновляем данные
      if (data.boxId) {
        pendingBoxes.push(data.boxId);
      }
      if (data.coins !== undefined) {
        game.coins = data.coins;
      }
      updateBoxUI();
      updateUI();
      showNotification('🎁 Бокс куплен! Откройте в магазине');
      saveGame();
      break;
    case 'boxOpened':
      showBoxReward(data.reward);
      if (data.reward.type === 'skin') {
        game.skins[data.reward.skinId] = true;
      } else {
        game.coins += data.reward.amount;
        game.totalCoins += data.reward.amount;
      }
      if (data.pendingBoxes !== undefined) {
        pendingBoxes = new Array(data.pendingBoxes).fill(null).map((_, i) => `box_${i}`);
      }
      updateUI();
      updateBoxUI();
      saveGame();
      break;
    case 'itemBought':
      // Сервер подтвердил покупку предмета
      if (data.coins !== undefined) game.coins = data.coins;
      if (data.perClick !== undefined) game.basePerClick = data.perClick;
      if (data.perSecond !== undefined) game.basePerSecond = data.perSecond;
      if (data.itemCost !== undefined) {
        const item = shopItems.find(i => i.id === data.itemId);
        if (item) item.cost = data.itemCost;
      }
      showNotification(`✅ Куплено: ${data.itemName}`);
      playSound('buySound');
      renderShop();
      updateUI();
      saveGame();
      break;
    case 'skinEquipped':
      // Сервер подтвердил выбор скина
      if (data.skinId) game.currentSkin = data.skinId;
      showNotification(`🎨 Скин "${skinsData.find(s => s.id === data.skinId)?.name || data.skinId}" выбран!`);
      renderSkins();
      updateUI();
      saveGame();
      break;
    case 'autoclickerBlocked':
      showNotification(`🚫 ${data.message || 'Доступ заблокирован'}`);
      try {
        document.getElementById('clicker')?.classList.add('locked');
      } catch (_) {}
      break;
    case 'forceSaveCompleted':
      if (window.handleForceSaveResponse) {
        window.handleForceSaveResponse(data);
      }
      break;
  }
}

// Разблокировка аудио на мобильных устройствах
function unlockAudio() {
  const audioElements = document.querySelectorAll('audio');
  audioElements.forEach(audio => {
    audio.play().catch(() => {});
    audio.pause();
    audio.currentTime = 0;
  });
}

document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });

function playSound(soundId) {
  const sfxEnabled = document.getElementById('sfxToggle')?.checked !== false;
  if (!sfxEnabled) return;
  let actualSoundId = soundId;
  if (soundId === 'clickSound') {
    actualSoundId = clickSounds[Math.floor(Math.random() * clickSounds.length)];
  }
  const sound = document.getElementById(actualSoundId);
  if (sound) {
    sound.currentTime = 0;
    sound.volume = (document.getElementById('volume')?.value || 50) / 100;
    sound.play().catch(() => {});
  }
}

// Показ плавающего текста
function showFloatingText(x, y, text, color = '#4fc3f7') {
  const effect = document.createElement('div');
  effect.className = 'click-effect';
  effect.textContent = text;
  effect.style.color = color;
  effect.style.left = `${x - 50}px`;
  effect.style.top = `${y - 50}px`;
  document.getElementById('clickEffects').appendChild(effect);
  setTimeout(() => effect.remove(), 1000);
}

// ==================== x2 МНОЖИТЕЛЬ ====================
let x2Active = false;
let x2TimeLeft = 0;
const x2Duration = 30; // 30 секунд

function activateX2Multiplier() {
  if (x2Active) return; // Уже активен
  
  x2Active = true;
  x2TimeLeft = x2Duration;
  game.multiplier = 2;
  
  const clicker = document.getElementById('clicker');
  const timerEl = document.getElementById('x2Timer');
  
  clicker.classList.add('x2-active');
  timerEl.classList.remove('hidden');
  
  showNotification('⭐ X2 МНОЖИТЕЛЬ АКТИВИРОВАН НА 30 СЕКУНД! ⭐');
  playSound('bonusSound');
  
  // Таймер обратного отсчета
  const x2Interval = setInterval(() => {
    x2TimeLeft--;
    document.getElementById('x2TimerValue').textContent = x2TimeLeft;
    
    if (x2TimeLeft <= 0) {
      clearInterval(x2Interval);
      deactivateX2Multiplier();
    }
  }, 1000);
  
  // Автоматическое деактивирование через 30 сек
  setTimeout(deactivateX2Multiplier, x2Duration * 1000);
}

function deactivateX2Multiplier() {
  if (!x2Active) return;
  
  x2Active = false;
  x2TimeLeft = 0;
  game.multiplier = 1;
  
  const clicker = document.getElementById('clicker');
  const timerEl = document.getElementById('x2Timer');
  
  clicker.classList.remove('x2-active');
  timerEl.classList.add('hidden');
  
  showNotification('⏱️ X2 множитель закончился');
  updateUI();
  saveGame();
}
  
// Автокликер - используем getPerSecond() для расчета с учётом навыков
let lastAutoClickTime = 0;
autoClickInterval = setInterval(() => {
  const now = Date.now();
  // Защита от дублирования интервалов
  if (now - lastAutoClickTime < 900) return; // минимум 900мс между вызовами
  lastAutoClickTime = now;
  
  const perSecond = getPerSecond();
  if (perSecond > 0) {
    const oldCoins = game.coins;
    // multiplier применяется только к монетам, не к basePerSecond
    const earned = perSecond * game.multiplier;
    game.coins += earned;
    game.totalCoins += earned;
    
    // Лог для отладки если монеты растут слишком быстро
    if (perSecond > 10000) {
      console.warn(`⚠️ Высокий perSecond: ${perSecond}, multiplier: ${game.multiplier}, добавлено: ${earned.toFixed(0)}`);
    }
    
    updateUI();
    checkQuests();
    // фиксируем автодоход "в реальном времени" (сервер), локалку не спамим
    scheduleServerSave();
  }
}, 1000);

// Счётчик времени в игре
setInterval(() => {
  game.playTime++;
  // playTime тоже сохраняем "в реальном времени" на сервер, без спама в localStorage
  scheduleServerSave();
}, 1000);

// Резервное локальное сохранение без лишнего спама
setInterval(() => {
  // дергаем общий путь — он пишет localStorage и отправку на сервер (отправка склеится)
  saveGame();
}, 10000);

// Запускаем спавн бонусов
setInterval(spawnBonus, 12000);

// Периодическая отправка буфера кликов (каждую секунду)
setInterval(() => {
  if (clickBuffer.length > 0) {
    flushClickBuffer();
  }
}, 1000);
  
// Защита от дублирования интервалов при переподключении
function cleanupIntervals() {
  if (autoClickInterval) {
    clearInterval(autoClickInterval);
    autoClickInterval = null;
  }
  console.log('🧹 Интервалы очищены');
}

// Обработчик клика по косатке
let lastClickTime = 0;
let clicksThisSecond = 0;
function handleClick(e) {
  // Проверка на спам кликами (защита от автокликеров и багов)
  const now = Date.now();
  if (now - lastClickTime >= 1000) {
    clicksThisSecond = 0;
    lastClickTime = now;
  }
  clicksThisSecond++;

  if (clicksThisSecond > MAX_CLICKS_PER_SEC) {
    console.warn(`⚠️ Превышен лимит кликов: ${clicksThisSecond}/сек (макс. ${MAX_CLICKS_PER_SEC})`);
    return; // Игнорируем клик если превышен лимит
  }
  
  const perClick = getPerClick();
  const critChance = 0.1; // 10% шанс крита
  const critMultiplier = 10;
  
  let earned = perClick * game.multiplier;
  let isCrit = false;
  
  // Критический удар удалён - теперь это просто рандомный крит без навыков
  
  game.coins += earned;
  game.totalCoins += earned;
  game.clicks++;
  
  // Плавающий текст
  const rect = clicker.getBoundingClientRect();
  const x = e.clientX || (rect.left + rect.width / 2);
  const y = e.clientY || (rect.top + rect.height / 2);
  const text = isCrit ? `КРИТ! x${critMultiplier}` : `+${formatNumber(earned)}`;
  const color = isCrit ? '#ff6b6b' : '#4fc3f7';
  showFloatingText(x, y, text, color);
  
  // Звук клика
  playSound('clickSound');
  
  // Анимация клика
  clicker.style.transform = 'scale(0.95)';
  setTimeout(() => {
    clicker.style.transform = 'scale(1)';
  }, 100);
  
  // Частицы звёзд (e4)
  if (game.effects && game.effects['e4']) {
    createStarParticles(x, y);
  }
  
  // Волновой эффект (e5)
  if (game.effects && game.effects['e5']) {
    createWaveEffect(clicker);
  }
  
  // Обновление UI
  updateUI();
  
  // Проверка достижений и квестов
  checkAchievements();
  checkQuests();
  
  // Добавляем клик в буфер для отправки на сервер
  clickBuffer.push({
    t: now,
    clicks: game.clicks,
    coins: game.coins,
    totalCoins: game.totalCoins
  });
  
  // Отправляем буфер если накопилось 5+ кликов или прошло 2 секунды
  if (clickBuffer.length >= 5 || Date.now() - lastServerSync > 2000) {
    flushClickBuffer();
  }
  
  // Сохранение
  scheduleServerSave();
}

// Отправка буфера кликов на сервер
function flushClickBuffer() {
  if (clickBuffer.length === 0 || !ws || ws.readyState !== WebSocket.OPEN) return;
  
  // Отправляем последний клик из буфера (актуальные данные)
  const lastClick = clickBuffer[clickBuffer.length - 1];
  const clickData = {
    type: 'click',
    clicks: lastClick.clicks,
    coins: lastClick.coins,
    perClick: game.basePerClick,
    perSecond: game.basePerSecond,
    totalCoins: lastClick.totalCoins
  };
  
  console.log(`📤 Отправка клика: clicks=${lastClick.clicks}, buffer=${clickBuffer.length}`);
  ws.send(JSON.stringify(clickData));
  
  // Очищаем буфер
  clickBuffer = [];
  lastServerSync = Date.now();
}

// Обработчики бонусов
function handleX2BonusClick() {
  if (!x2Active) {
    activateX2Multiplier();
    showFloatingText(
      x2Bonus.getBoundingClientRect().left + 30,
      x2Bonus.getBoundingClientRect().top,
      `x2! 🌟`,
      '#ffd700'
    );
    x2Bonus.classList.add('hidden');
  }
}

function handleBonusClick() {
  // Обычный сундук - даёт perClick * 15
  const perClick = getPerClick();
  const bonusValue = perClick * 15;
  game.coins += bonusValue;
  game.totalCoins += bonusValue;
  showFloatingText(
    bonus.getBoundingClientRect().left + 30,
    bonus.getBoundingClientRect().top,
    `БОНУС! +${formatNumber(bonusValue)}`,
    '#ffd700'
  );
  playSound('bonusSound');
  bonus.classList.add('hidden');
  updateUI();
  saveGame();
}
  
function handleFishBonusClick() {
  const perSecond = getPerSecond();
  const perClick = getPerClick();
  // Рыбка умножает perSecond/perClick, но не применяет game.multiplier
  const fishValue = Math.max(perSecond * 30, perClick * 10);
  game.coins += fishValue;
  game.totalCoins += fishValue;
  showFloatingText(
    fishBonus.getBoundingClientRect().left + 30,
    fishBonus.getBoundingClientRect().top,
    `РЫБКА! +${formatNumber(fishValue)}`,
    '#4fc3f7'
  );
  playSound('bonusSound');
  fishBonus.classList.add('hidden');
  updateUI();
  saveGame();
}
  
function spawnBonus() {
  if (Math.random() < 0.4) {
    const x = 50 + Math.random() * (window.innerWidth - 150);
    const y = 100 + Math.random() * (window.innerHeight - 350);
    
    // 15% шанс спауна x2 бонуса
    const spawnX2 = Math.random() < 0.15;
    
    if (spawnX2) {
      // x2 бонус
      x2Bonus.style.left = `${x}px`;
      x2Bonus.style.top = `${y}px`;
      x2Bonus.classList.remove('hidden');
      setTimeout(() => x2Bonus.classList.add('hidden'), 8000);
    } else {
      // Обычные бонусы (рыба или сундук)
      const useFish = Math.random() < 0.5;
      const bonusEl = useFish ? fishBonus : bonus;
      bonusEl.style.left = `${x}px`;
      bonusEl.style.top = `${y}px`;
      bonusEl.classList.remove('hidden');
      setTimeout(() => bonusEl.classList.add('hidden'), 6000);
    }
  }
}

// Обработчики бонусов вынесены в initDOM()
  
// ==================== UI ОБНОВЛЕНИЯ ====================
function updateUI() {
  // Используем функции расчета с учётом навыков (без x2 бонуса)
  const perClick = getPerClick();
  const perSecond = getPerSecond();
  
  coinsEl.textContent = formatNumber(Math.floor(game.coins));
  levelEl.textContent = game.level;
  // Показываем базовые значения (множитель x2 применяется только к монетам, не к статам)
  perClickEl.textContent = formatNumber(perClick);
  perSecondEl.textContent = formatNumber(perSecond);
  
  // Расчет уровня
  const newLevel = Math.floor(Math.log10(game.totalCoins + 1)) + 1;
  if (newLevel > game.level) {
    game.level = newLevel;
    showNotification(`🎉 Новый уровень: ${game.level}!`);
    playSound('levelSound');
  }
  
  // Обновление скина
  updateSkin();
}

function updateSkin() {
  const skin = skinsData.find(s => s.id === game.currentSkin);
  if (skin && orcaImg) {
    console.log(`🎨 updateSkin: currentSkin=${game.currentSkin}, skin.image=${skin.image}`);
    orcaImg.src = skin.image;
    orcaImg.style.display = 'block';
    if (orcaEmoji) orcaEmoji.style.display = 'none';
    
    // Сохраняем классы эффектов перед обновлением
    const existingClasses = Array.from(clicker.classList).filter(cls => 
      cls.startsWith('effect-')
    );
    
    // Сбрасываем и добавляем скин + сохранённые эффекты
    clicker.className = `clicker skin-${skin.id}`;
    existingClasses.forEach(cls => clicker.classList.add(cls));
    
  } else {
    console.log(`⚠️ updateSkin: skin=${!!skin}, orcaImg=${!!orcaImg}, currentSkin=${game.currentSkin}`);
  }
}

function formatNumber(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return Math.floor(num).toString();
}

function showNotification(text) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(145deg, #4caf50, #388e3c);
    padding: 15px 30px;
    border-radius: 30px;
    color: #fff;
    font-weight: bold;
    z-index: 1000;
    animation: slideDown 0.5s ease-out;
    box-shadow: 0 5px 20px rgba(0,0,0,0.4);
  `;
  notif.textContent = text;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ==================== МАГАЗИН ====================
function renderShop() {
  const container = document.getElementById('shopUpgrades');
  document.getElementById('shopCoins').textContent = formatNumber(Math.floor(game.coins));
  container.innerHTML = '';
  
  shopItems.forEach(item => {
    const div = document.createElement('div');
    div.className = `shop-item ${game.coins < item.cost ? 'locked' : ''}`;
    div.innerHTML = `
      <div class="shop-item-info">
        <div class="shop-item-icon-wrap">
          <img src="${item.icon}" alt="" class="shop-item-icon" onerror="this.style.display='none'">
        </div>
        <div>
          <h4>${item.name}</h4>
          <p>${item.desc}</p>
        </div>
      </div>
      <div class="shop-item-price">${formatNumber(item.cost)}</div>
    `;
    div.onclick = () => buyItem(item);
    container.appendChild(div);
  });
  
  renderSkins();
}

function renderBoxes() {
  const container = document.getElementById('shopBoxes');
  if (!container) return;
  
  container.innerHTML = '';
  
  const boxDiv = document.createElement('div');
  boxDiv.className = 'box-item';
  boxDiv.innerHTML = `
    <div class="box-icon">🎁</div>
    <h4>Тайный Бокс</h4>
    <p>Скин или косатки!</p>
    <div class="box-price">🐋 ${formatNumber(1700)}</div>
    <button class="box-buy-btn" onclick="buyBox()">Купить</button>
    <div class="box-inventory">
      <p>У вас есть: <strong id="boxCount">${pendingBoxes.length}</strong> бокс(ов)</p>
      <button class="box-open-btn" onclick="openBoxUI()" ${pendingBoxes.length === 0 ? 'disabled' : ''}>Открыть</button>
    </div>
  `;
  container.appendChild(boxDiv);
}
  
function openBoxUI() {
  if (pendingBoxes.length > 0) {
    openBox(pendingBoxes[0]);
  }
}

function buyItem(item) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Отправляем на сервер для сохранения
    ws.send(JSON.stringify({ 
      type: 'buyItem', 
      itemId: item.id 
    }));
    // НЕ обновляем локально - ждём подтверждения
  } else {
    // Локальный режим (без сервера)
    if (game.coins >= item.cost) {
      game.coins -= item.cost;
      // Добавляем к basePerClick/basePerSecond (сумма апгрейдов)
      if (item.type === 'click') game.basePerClick += item.value;
      if (item.type === 'auto') game.basePerSecond += item.value;
      item.cost = Math.floor(item.cost * 1.2);
      showNotification(`✅ Куплено: ${item.name}`);
      playSound('buySound');
      renderShop();
      updateUI();
      saveGame();
    }
  }
}

function renderSkins() {
  const container = document.getElementById('shopSkins');
  if (!container) return;
  
  container.innerHTML = '';
  
  skinsData.forEach(skin => {
    const unlocked = game.skins[skin.id] || skin.cost === 0;
    const div = document.createElement('div');
    div.className = `skin-item ${game.currentSkin === skin.id ? 'active' : ''} ${!unlocked ? 'locked-skin' : ''}`;
    div.innerHTML = `
      <img src="${skin.image}" alt="${skin.name}" onerror="this.style.display='none'">
      <p>${skin.name}</p>
      <p>${skin.cost === 0 ? '✅' : formatNumber(skin.cost)}</p>
    `;
    div.onclick = () => buyOrEquipSkin(skin);
    container.appendChild(div);
  });
}

function buyOrEquipSkin(skin) {
  const unlocked = game.skins[skin.id] || skin.cost === 0;
  
  if (unlocked) {
    // Просто выбираем скин (сохранение на сервере)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'equipSkin', 
        skinId: skin.id 
      }));
    } else {
      game.currentSkin = skin.id;
      showNotification(`🎨 Скин "${skin.name}" выбран!`);
      renderSkins();
      updateUI();
      saveGame();
    }
  } else {
    // Скины теперь только из ящиков
    showNotification('🎁 Скины можно получить только из ящика');
  }
}

// ==================== КВЕСТЫ ====================
function initQuests() {
  game.quests = questsData.map(q => ({ ...q, completed: false }));
  // Применяем визуальные эффекты после инициализации квестов
  applyEffects();
}

function renderQuests() {
  const container = document.getElementById('questList');
  container.innerHTML = '';
  
  game.quests.forEach(quest => {
    const progress = getQuestProgress(quest);
    const div = document.createElement('div');
    div.className = `quest ${quest.completed ? 'completed' : ''}`;
    div.innerHTML = `
      <h4>${quest.completed ? '✅' : '📋'} ${quest.name}</h4>
      <p>${quest.desc}</p>
      <div class="quest-progress">
        <div class="quest-progress-bar" style="width: ${Math.min(100, (progress / quest.target) * 100)}%"></div>
      </div>
      <small>${formatNumber(progress)} / ${formatNumber(quest.target)} | Награда: ${formatNumber(quest.reward)}</small>
    `;
    container.appendChild(div);
  });
}

function getQuestProgress(quest) {
  if (quest.type === 'clicks') return game.clicks;
  if (quest.type === 'coins') return game.coins;
  if (quest.type === 'totalCoins') return game.totalCoins;
  return 0;
}

function checkQuests() {
  game.quests.forEach(quest => {
    if (!quest.completed && getQuestProgress(quest) >= quest.target) {
      quest.completed = true;
      game.coins += quest.reward;
      showNotification(`🎉 Квест выполнен: ${quest.name}! +${formatNumber(quest.reward)}`);
      playSound('bonusSound');
      renderQuests();
    }
  });
}

// ==================== ЭФФЕКТЫ ====================
// Применение визуальных эффектов
function applyEffects() {
  const clicker = document.getElementById('clicker');
  if (!clicker || !game.effects) return;
  
  // Сброс всех эффектов
  clicker.classList.remove('effect-gold', 'effect-neon', 'effect-fire');
  clicker.style.removeProperty('--rainbow-gradient');
  
  // Золотой клик (e1)
  if (game.effects['e1']) {
    clicker.classList.add('effect-gold');
  }
  
  // Неоновый свет (e2)
  if (game.effects['e2']) {
    clicker.classList.add('effect-neon');
  }
  
  // Радужный след (e3)
  if (game.effects['e3']) {
    clicker.style.setProperty('--rainbow-gradient', 'linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000)');
  }
  
  // Огненное сияние (e6)
  if (game.effects['e6']) {
    clicker.classList.add('effect-fire');
  }
}

// Создание частиц звёзд (e4)
function createStarParticles(x, y) {
  for (let i = 0; i < 5; i++) {
    const star = document.createElement('div');
    star.className = 'star-particle';
    star.textContent = '⭐';
    star.style.left = (x + (Math.random() - 0.5) * 50) + 'px';
    star.style.top = (y + (Math.random() - 0.5) * 50) + 'px';
    star.style.fontSize = (15 + Math.random() * 15) + 'px';
    document.body.appendChild(star);
    setTimeout(() => star.remove(), 1000);
  }
}

// Создание волнового эффекта (e5)
function createWaveEffect(element) {
  const rect = element.getBoundingClientRect();
  const wave = document.createElement('div');
  wave.className = 'wave-particle';
  wave.style.left = (rect.left + rect.width / 2 - 100) + 'px';
  wave.style.top = (rect.top + rect.height / 2 - 100) + 'px';
  document.body.appendChild(wave);
  setTimeout(() => wave.remove(), 800);
}

function renderEffects() {
  // Инициализация если нет
  if (!game.effects) game.effects = {};
  
  // Используем контейнер магазина
  const container = document.getElementById('shopEffects');
  if (!container) {
    console.error('Контейнер #shopEffects не найден!');
    return;
  }
  container.innerHTML = '';
  
  effectsData.forEach(effect => {
    const bought = !!game.effects[effect.id];
    const canAfford = game.coins >= effect.cost;
    const div = document.createElement('div');
    div.className = `effect-item ${bought ? 'bought' : ''} ${!bought && !canAfford ? 'locked' : ''}`;
    div.innerHTML = `
      <div class="effect-icon">${effect.icon}</div>
      <div class="effect-info">
        <h4>${effect.name}</h4>
        <p>${effect.desc}</p>
      </div>
      <div class="effect-price">${bought ? '✅' : formatNumber(effect.cost)}</div>
    `;
    // Всегда добавляем onclick, проверяем внутри
    div.onclick = () => buyEffect(effect);
    container.appendChild(div);
  });
}

function buyEffect(effect) {
  // Инициализация если нет
  if (!game.effects) game.effects = {};
  
  // Если уже куплено - ничего не делаем
  if (game.effects[effect.id]) {
    showNotification('✨ Эффект уже куплен!');
    return;
  }
  
  if (game.coins >= effect.cost) {
    // Отправляем запрос на сервер
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'buyEffect', effectId: effect.id }));
      // НЕ обновляем локально - ждём подтверждения
    } else {
      // Локальная покупка если нет сервера
      game.coins -= effect.cost;
      game.effects[effect.id] = true;
      showNotification(`✨ Эффект получен: ${effect.name}`);
      applyEffects();  // Применяем визуальный эффект
      renderEffects();
      updateUI();
      saveGame();
    }
  } else {
    showNotification('⚠️ Недостаточно монет!');
  }
}
  
// ==================== ДОСТИЖЕНИЯ ====================
function renderAchievements() {
  const container = document.getElementById('achievementList');
  container.innerHTML = '';
  
  achievementsData.forEach(ach => {
    const unlocked = game.achievements.includes(ach.id);
    const div = document.createElement('div');
    div.className = `achievement ${unlocked ? 'unlocked' : ''}`;
    div.innerHTML = `
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-info">
        <h4>${ach.name}</h4>
        <p>${ach.desc}</p>
      </div>
      <div>${unlocked ? '✅' : '🔒'}</div>
    `;
    container.appendChild(div);
  });
}

function checkAchievements() {
  const checks = [
    { id: 'a1', check: () => game.clicks >= 1 },
    { id: 'a2', check: () => game.clicks >= 100 },
    { id: 'a3', check: () => game.totalCoins >= 1000000 },
    { id: 'a4', check: () => shopItems.every(i => i.cost >= 1000) },
    { id: 'a5', check: () => getPerClick() >= 1000 },
    { id: 'a6', check: () => getPerSecond() >= 1000 }
  ];
  
  checks.forEach(({ id, check }) => {
    if (!game.achievements.includes(id) && check()) {
      game.achievements.push(id);
      const ach = achievementsData.find(a => a.id === id);
      showNotification(`🏆 Достижение: ${ach.name}!`);
      playSound('bonusSound');
      renderAchievements();
      saveGame();
    }
  });
}

// ==================== ЛИДЕРБОРД ====================
function updateLeaderboardUI(data) {
  const tbody = document.querySelector('#leaderboardTable tbody');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px">Пока нет игроков</td></tr>';
    return;
  }
  
  data.slice(0, 100).forEach((player, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(player.name)}</td>
      <td>${formatNumber(player.coins)}</td>
    `;
    tbody.appendChild(row);
  });
}

// ==================== PvP БАТТЛ ====================
let myBattleClicks = 0;
let myBattleCPS = 0;
let battleClickTimer = null;
let currentLobbyId = null;

// Переключение вкладок батла
function switchBattleTab(tab, btn) {
  document.querySelectorAll('.battle-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  if (tab === 'quick') {
    document.getElementById('battleQuickSearch').classList.remove('hidden');
    document.getElementById('battleQuickSearch').classList.add('active');
    document.getElementById('battleLobbyView').classList.add('hidden');
    document.getElementById('battleLobbyView').classList.remove('active');
  } else if (tab === 'lobby') {
    document.getElementById('battleQuickSearch').classList.add('hidden');
    document.getElementById('battleQuickSearch').classList.remove('active');
    document.getElementById('battleLobbyView').classList.remove('hidden');
    document.getElementById('battleLobbyView').classList.add('active');
    // Запрашиваем список лобби с небольшой задержкой
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getBattleLobbies' }));
        console.log('📤 Запрос списка лобби отправлен');
      } else {
        console.warn('⚠️ WebSocket не подключён, ждём подключения');
        document.getElementById('battleLobbyList').innerHTML = 
          '<p style="text-align:center;padding:20px;color:#ffd700">⏳ Подключение к серверу...</p>';
      }
    }, 50);
  }
}

// Создание лобби
function createBattleLobby() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    const container = document.getElementById('battleLobbyList');
    if (container) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:#ff6b6b">❌ Нет подключения к серверу</p>';
    }
    return;
  }
  
  ws.send(JSON.stringify({ type: 'createBattleLobby' }));
}

// Присоединение к лобби
function joinBattleLobby(lobbyId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }

  ws.send(JSON.stringify({ type: 'joinBattleLobby', lobbyId }));
}

// Выход из моего лобби
function leaveMyLobby() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  
  ws.send(JSON.stringify({ type: 'leaveBattleLobby' }));
}

// Обновление списка лобби
function refreshBattleLobbies() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    // Показываем статус в UI лобби
    const container = document.getElementById('battleLobbyList');
    if (container) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:#ff6b6b">❌ Нет подключения к серверу. Попробуйте позже.</p>';
    }
    return;
  }
  
  ws.send(JSON.stringify({ type: 'getBattleLobbies' }));
  showNotification('🔄 Обновление...');
}

// Запуск батла из лобби
function startBattleFromLobby() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  
  if (!currentLobbyId) {
    showNotification('⚠️ Лобби не найдено');
    return;
  }

  ws.send(JSON.stringify({ type: 'startBattleFromLobby', lobbyId: currentLobbyId }));
}
  
// Обновление UI списка лобби
function updateBattleLobbiesUI(lobbies) {
  const container = document.getElementById('battleLobbyList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!lobbies || lobbies.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:20px;color:#888">🏠 Нет активных лобби. Создайте первое!</p>';
    return;
  }
  
  lobbies.forEach(lobby => {
    const div = document.createElement('div');
    div.className = 'lobby-item';
    
    if (lobby.hasOpponent) {
      div.classList.add('full');
      div.innerHTML = `
        <div class="lobby-info">
          <p><strong>${escapeHtml(lobby.ownerName)}</strong> и <strong>${escapeHtml(lobby.opponentName)}</strong></p>
          <small>Лобби заполнено</small>
        </div>
        <span style="color:#ff6b6b;font-weight:600">🔒</span>
      `;
    } else {
      div.innerHTML = `
        <div class="lobby-info">
          <p><strong>${escapeHtml(lobby.ownerName)}</strong> ищет соперника</p>
          <small>Создано ${new Date(lobby.createdAt).toLocaleTimeString()}</small>
        </div>
        <button class="action-btn" onclick="joinBattleLobby('${lobby.id}')" style="margin-bottom:0">Вступить</button>
      `;
    }
    
    container.appendChild(div);
  });
}

// Обновление UI моего лобби
function updateMyLobbyUI(lobby) {
  const myLobbyEl = document.getElementById('myBattleLobby');
  if (!myLobbyEl) return;
  
  if (!lobby) {
    myLobbyEl.classList.add('hidden');
    currentLobbyId = null;
    return;
  }

  currentLobbyId = lobby.id;
  myLobbyEl.classList.remove('hidden');
  
  document.getElementById('myLobbyOwner').textContent = lobby.ownerName;
  document.getElementById('myLobbyOpponent').textContent = lobby.hasOpponent 
    ? escapeHtml(lobby.opponentName) 
    : 'Ожидание соперника...';
  
  // Блокируем кнопку запуска если нет соперника
  const startBtn = document.getElementById('startBattleBtn');
  if (startBtn) {
    startBtn.disabled = !lobby.hasOpponent;
    startBtn.textContent = lobby.hasOpponent ? '⚔️ Начать батл' : 'Ожидание соперника...';
  }
}

function findBattle() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    document.getElementById('battleStatus').textContent = 'Сервер недоступен';
    return;
  }

  ws.send(JSON.stringify({ type: 'findBattle' }));
  document.getElementById('battleLobby').classList.add('hidden');
  document.getElementById('battleStatus').textContent = 'Поиск соперника...';
}

function startBattleUI(data) {
  battleId = data.battleId;
  myBattleClicks = 0;
  myBattleCPS = 0;
  currentLobbyId = data.lobbyId || null;
  
  // Скрываем все UI лобби (с проверками)
  const battleQuickSearch = document.getElementById('battleQuickSearch');
  const battleLobbyView = document.getElementById('battleLobbyView');
  const myBattleLobby = document.getElementById('myBattleLobby');
  const battleLobby = document.getElementById('battleLobby');
  const battleArena = document.getElementById('battleArena');
  
  if (battleQuickSearch) battleQuickSearch.classList.add('hidden');
  if (battleLobbyView) battleLobbyView.classList.add('hidden');
  if (myBattleLobby) myBattleLobby.classList.add('hidden');
  if (battleLobby) battleLobby.classList.add('hidden');
  if (battleArena) battleArena.classList.remove('hidden');
  
  // Обновляем UI арены с проверками
  const opponentNameEl = document.getElementById('opponentName');
  const myBattleScoreEl = document.getElementById('myBattleScore');
  const opponentScoreEl = document.getElementById('opponentScore');
  const myCpsEl = document.getElementById('myCPS');
  const opponentCpsEl = document.getElementById('opponentCPS');
  const battleTimerEl = document.getElementById('battleTimer');
  
  if (opponentNameEl) opponentNameEl.textContent = data.opponent;
  if (myBattleScoreEl) myBattleScoreEl.textContent = '0';
  if (opponentScoreEl) opponentScoreEl.textContent = '0';
  if (myCpsEl) myCpsEl.textContent = `${data.yourPerSecond || 0} CPS`;
  if (opponentCpsEl) opponentCpsEl.textContent = `${data.opponentPerSecond || 0} CPS`;
  if (battleTimerEl) battleTimerEl.textContent = data.duration / 1000;
  
  // Если это владелец лобби - показываем "Вы" а не имя
  if (data.lobbyId && myBattleScoreEl?.parentNode) {
    const h3 = myBattleScoreEl.parentNode.querySelector('h3');
    if (h3) {
      const isOwner = data.opponent && data.opponent !== currentUser?.username;
      h3.textContent = isOwner ? 'Вы' : data.opponent;
    }
  }
  
  // Показываем мой скин (из данных сервера)
  const mySkin = skinsData.find(s => s.id === (data.yourSkin || game.currentSkin));
  const mySkinImg = document.getElementById('myBattleSkin');
  if (mySkin && mySkinImg) {
    mySkinImg.src = mySkin.image;
    mySkinImg.onerror = function() {
      this.onerror = null;
      this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGV4dCB5PSI3MCIgZm9udC1zaXplPSI2MCI+8J+QizwvdGV4dD48L3N2Zz4=';
    };
  }
  
  // Показываем скин соперника (из данных сервера)
  const opponentSkin = skinsData.find(s => s.id === (data.opponentSkin || 'normal'));
  const opponentSkinImg = document.getElementById('opponentBattleSkin');
  if (opponentSkin && opponentSkinImg) {
    opponentSkinImg.src = opponentSkin.image;
    opponentSkinImg.onerror = function() {
      this.onerror = null;
      this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGV4dCB5PSI3MCIgZm9udC1zaXplPSI2MCI+8J+QizwvdGV4dD48L3N2Zz4=';
    };
  }
  
  // Считаем клики в секунду
  let clickCount = 0;
  let lastTime = Date.now();
  
  const battleClickBtn = document.getElementById('battleClickBtn');
  if (battleClickBtn) {
    battleClickBtn.onclick = () => {
      clickCount++;
      myBattleClicks++;
      if (myBattleScoreEl) myBattleScoreEl.textContent = myBattleClicks;
      
      // Обновляем CPS каждую секунду
      const now = Date.now();
      if (now - lastTime >= 1000) {
        myBattleCPS = clickCount;
        clickCount = 0;
        lastTime = now;
        if (myCpsEl) myCpsEl.textContent = `${myBattleCPS} CPS`;
      }
      
      // Отправляем на сервер
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'battleClick',
          battleId: battleId,
          clicks: 1,
          cps: myBattleCPS
        }));
      }
    };
  }
  
  // Таймер обратного отсчета
  battleInterval = setInterval(() => {
    if (battleTimerEl) {
      const currentText = battleTimerEl.textContent;
      const timer = parseInt(currentText) - 1;
      battleTimerEl.textContent = timer;
      if (timer <= 0) {
        clearInterval(battleInterval);
        battleInterval = null;
      }
    }
  }, 1000);
}

function updateBattleUI(data) {
  // data.yourScore = мои клики, data.opponentScore = клики соперника
  const myBattleScoreEl = document.getElementById('myBattleScore');
  const opponentScoreEl = document.getElementById('opponentScore');
  const myCpsEl = document.getElementById('myCPS');
  const opponentCpsEl = document.getElementById('opponentCPS');
  
  if (myBattleScoreEl) myBattleScoreEl.textContent = data.yourScore;
  if (opponentScoreEl) opponentScoreEl.textContent = data.opponentScore;
  if (myCpsEl) myCpsEl.textContent = `${data.yourCPS || 0} CPS`;
  if (opponentCpsEl) opponentCpsEl.textContent = `${data.opponentCPS || 0} CPS`;
  
  // Локально тоже обновляем чтобы не было рассинхрона
  myBattleClicks = data.yourScore;
}

function endBattleUI(data) {
  // Очищаем интервал если есть
  if (battleInterval) {
    clearInterval(battleInterval);
    battleInterval = null;
  }
  
  const isDraw = data.isDraw;
  const won = !isDraw && data.winner === (typeof currentUser !== 'undefined' && currentUser ? currentUser.username : null);
  
  if (won) {
    showNotification(`🎉 Победа! +${data.prize} косаток`);
  } else if (isDraw) {
    showNotification(`🤝 Ничья! +${data.prize} косаток`);
  } else {
    showNotification(`😅 Поражение! +${data.prize} косаток`);
  }
  
  game.coins += data.prize;
  game.totalCoins += data.prize;
  updateUI();
  saveGame();
  
  setTimeout(() => {
    // Скрываем арену и все UI лобби (с проверками)
    const battleArena = document.getElementById('battleArena');
    const battleQuickSearch = document.getElementById('battleQuickSearch');
    const battleLobbyView = document.getElementById('battleLobbyView');
    const myBattleLobby = document.getElementById('myBattleLobby');
    const battleLobby = document.getElementById('battleLobby');
    const battleStatus = document.getElementById('battleStatus');
    const btn = document.getElementById('battleClickBtn');
    
    if (battleArena) battleArena.classList.add('hidden');
    if (battleQuickSearch) battleQuickSearch.classList.remove('hidden');
    if (battleLobbyView) battleLobbyView.classList.add('hidden');
    if (myBattleLobby) myBattleLobby.classList.add('hidden');
    if (battleLobby) battleLobby.classList.remove('hidden');
    
    if (battleStatus) battleStatus.textContent = 'Нажмите кнопку для поиска соперника';
    if (btn) btn.onclick = null;
    
    battleId = null;
    currentLobbyId = null;
    myBattleClicks = 0;
  }, 3000);
}

// ==================== КЛАНЫ ====================
window.createClan = function() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  
  const name = prompt('Введите название клана:');
  if (name) {
    ws.send(JSON.stringify({ type: 'createClan', name }));
  }
}

window.leaveClan = function() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (confirm('Вы уверены, что хотите выйти из клана?')) {
    ws.send(JSON.stringify({ type: 'leaveClan' }));
  }
}

window.joinClan = function(clanId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  ws.send(JSON.stringify({ type: 'joinClan', clanId }));
}

function updateClansUI(clans) {
  const container = document.getElementById('clanList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!clans || clans.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:20px">Пока нет кланов. Создайте первый!</p>';
    return;
  }
  
  clans.forEach(clan => {
    const div = document.createElement('div');
    div.className = 'clan-item';
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(clan.name)}</strong>
        <small>(${clan.memberCount || 0} участников)</small>
      </div>
      <button onclick="joinClan('${clan.id}')">Вступить</button>
    `;
    container.appendChild(div);
  });
}

window.updateClanMembersUI = function(members) {
  const container = document.getElementById('clanMembersList');
  if (!container) return;
  
  container.innerHTML = '';
  if (!members || members.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#888">Нет участников</p>';
    return;
  }
  
  members.forEach(member => {
    const div = document.createElement('div');
    div.className = 'clan-member';
    div.innerHTML = `
      <span>${member.isOwner ? '👑 ' : ''}${escapeHtml(member.name)}</span>
      <span>${formatNumber(member.coins)}</span>
    `;
    container.appendChild(div);
  });
}

// ==================== ИВЕНТ ====================
let eventCoins = 0;
let eventInfo = null;

function addEventCoins(amount) {
  const oldCoins = eventCoins;
  eventCoins += amount;
  console.log(`🎫 addEventCoins: +${amount} (было ${oldCoins}, стало ${eventCoins})`);
  updateEventUI();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'addEventCoins', amount }));
  }
}

function updateEventUI() {
  const eventCoinsDisplay = document.getElementById('eventCoinsDisplay');
  if (eventCoinsDisplay) {
    eventCoinsDisplay.textContent = formatNumber(eventCoins);
    console.log(`✅ UI обновлён: eventCoins=${eventCoins}`);
  } else {
    console.log(`⚠️ Элемент #eventCoinsDisplay не найден`);
  }
  
  const eventTimerEl = document.getElementById('eventTimer');
  if (eventTimerEl && eventInfo) {
    const daysLeft = Math.ceil((eventInfo.endDate - Date.now()) / (1000 * 60 * 60 * 24));
    eventTimerEl.textContent = `${daysLeft} дн.`;
  }
  
  const eventTimerDisplay = document.getElementById('eventTimerDisplay');
  if (eventTimerDisplay && eventInfo) {
    const daysLeft = Math.ceil((eventInfo.endDate - Date.now()) / (1000 * 60 * 60 * 24));
    eventTimerDisplay.textContent = `${daysLeft} дн.`;
  }
}

function renderEventLeaderboard() {
  const container = document.getElementById('eventLeaderboard');
  if (!container || !eventInfo) return;
  
  const topPlayers = eventInfo.topPlayers || [];
  container.innerHTML = '';
  topPlayers.forEach((player, index) => {
    const medals = ['🥇', '🥈', '🥉'];
    const div = document.createElement('div');
    div.className = 'event-player';
    div.innerHTML = `
      <span>${medals[index] || `${index + 1}.`} ${escapeHtml(player.name)}</span>
      <span>${formatNumber(player.coins)} 🎫</span>
    `;
    container.appendChild(div);
  });
}

function openEventModal() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'getEventInfo' }));
  }
  showModal('eventModal');
}

// ==================== БОКСЫ ====================
let pendingBoxes = [];
let isOpeningBox = false;

function buyBox() {
  if (isOpeningBox) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'buyBox' }));
  }
}

function openBox(boxId) {
  if (isOpeningBox) return;
  isOpeningBox = true;
  
  const boxIndex = pendingBoxes.indexOf(boxId);
  if (boxIndex === -1) {
    isOpeningBox = false;
    return;
  }

  // НЕ удаляем локально - ждём подтверждения от сервера
  // Запускаем катсцену
  showBoxOpeningCutscene();
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'openBox', boxId }));
  } else {
    isOpeningBox = false;
  }
}

function showBoxOpeningCutscene() {
  const cutscene = document.createElement('div');
  cutscene.className = 'box-cutscene';
  cutscene.innerHTML = `
    <div class="box-cutscene-bg"></div>
    <div class="box-cutscene-content">
      <div class="mystery-box">🎁</div>
      <div class="box-shake"></div>
      <div class="box-light"></div>
    </div>
    <div class="box-particles"></div>
  `;
  document.body.appendChild(cutscene);
  
  // Анимация тряски
  setTimeout(() => {
    cutscene.classList.add('shaking');
    playSound('clickSound');
  }, 500);
  
  setTimeout(() => {
    cutscene.classList.add('glowing');
  }, 1500);
  
  setTimeout(() => {
    cutscene.classList.add('exploding');
    playSound('bonusSound');
  }, 2000);
  
  setTimeout(() => {
    cutscene.remove();
    isOpeningBox = false;
  }, 3500);
}

function showBoxReward(reward) {
  const rewardModal = document.createElement('div');
  rewardModal.className = 'box-reward-modal';
  
  const rarityColors = {
    legendary: '#ff6b6b',
    epic: '#a855f7',
    rare: '#3b82f6',
    common: '#22c55e'
  };
  
  const rarityGlow = {
    legendary: '0 0 50px rgba(255,107,107,0.8)',
    epic: '0 0 50px rgba(168,85,247,0.8)',
    rare: '0 0 50px rgba(59,130,246,0.8)',
    common: '0 0 50px rgba(34,197,94,0.8)'
  };
  
  const icon = reward.type === 'skin' ? '🎨' : '🐋';
  const title = reward.type === 'skin' ? 'Новый скин!' : 'Косатки!';
  const value = reward.type === 'skin' ? reward.skinName : `+${formatNumber(reward.amount)}`;
  
  rewardModal.innerHTML = `
    <div class="reward-overlay"></div>
    <div class="reward-content" style="box-shadow: ${rarityGlow[reward.rarity]}">
      <div class="reward-icon" style="background: ${rarityColors[reward.rarity]}">${icon}</div>
      <h2 class="reward-title ${reward.rarity}">${title}</h2>
      <p class="reward-value">${value}</p>
      <p class="reward-rarity ${reward.rarity}">${reward.rarity === 'legendary' ? 'ЛЕГЕНДАРНО' : reward.rarity === 'epic' ? 'ЭПИЧЕСКИЙ' : 'РЕДКИЙ'}</p>
      <button class="reward-btn" onclick="this.closest('.box-reward-modal').remove()">Забрать</button>
    </div>
  `;
  
  document.body.appendChild(rewardModal);
  
  setTimeout(() => {
    rewardModal.classList.add('show');
  }, 100);
  
  playSound('levelSound');
}

function updateBoxUI() {
  const boxCountEl = document.getElementById('boxCount');
  if (boxCountEl) {
    boxCountEl.textContent = pendingBoxes.length;
  }
}
function showModal(id) {
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById(id).classList.add('active');
  
  if (id === 'shop') { renderShop(); renderBoxes(); switchShopTab('upgrades', document.querySelector('.shop-tab.active')); }
  if (id === 'quests') renderQuests();
  if (id === 'achievements') renderAchievements();
  if (id === 'stats') updateStats();
  if (id === 'leaderboard' && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'getLeaderboard' }));
  if (id === 'battle') {
    // Сброс UI лобби при открытии
    document.getElementById('battleQuickSearch').classList.remove('hidden');
    document.getElementById('battleQuickSearch').classList.add('active');
    document.getElementById('battleLobbyView').classList.add('hidden');
    document.getElementById('battleLobbyView').classList.remove('active');
    document.getElementById('myBattleLobby').classList.add('hidden');
    // Запросить список лобби (без проверки readyState - отправим при подключении)
    setTimeout(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getBattleLobbies' }));
      }
    }, 100);
  }
  if (id === 'clans' && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'getClans' }));
    ws.send(JSON.stringify({ type: 'getClanMembers' }));
  }
  if (id === 'eventModal') {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'getEventInfo' }));
    updateEventUI();
    renderEventLeaderboard();
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById('modalOverlay').classList.remove('active');
}

function switchShopTab(tab, btn) {
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  if (tab === 'upgrades') {
    document.getElementById('shopUpgrades').style.display = 'flex';
    document.getElementById('shopSkins').style.display = 'none';
    document.getElementById('shopBoxes').style.display = 'none';
    document.getElementById('shopEffects').style.display = 'none';
  } else if (tab === 'skins') {
    document.getElementById('shopUpgrades').style.display = 'none';
    document.getElementById('shopSkins').style.display = 'grid';
    document.getElementById('shopBoxes').style.display = 'none';
    document.getElementById('shopEffects').style.display = 'none';
    renderSkins();
  } else if (tab === 'boxes') {
    document.getElementById('shopUpgrades').style.display = 'none';
    document.getElementById('shopSkins').style.display = 'none';
    document.getElementById('shopBoxes').style.display = 'flex';
    document.getElementById('shopEffects').style.display = 'none';
    renderBoxes();
  } else if (tab === 'effects') {
    document.getElementById('shopUpgrades').style.display = 'none';
    document.getElementById('shopSkins').style.display = 'none';
    document.getElementById('shopBoxes').style.display = 'none';
    document.getElementById('shopEffects').style.display = 'grid';
    renderEffects();
  }
}

// ==================== СТАТИСТИКА ====================
function updateStats() {
  document.getElementById('statClicks').textContent = formatNumber(game.clicks);
  document.getElementById('statTotalCoins').textContent = formatNumber(Math.floor(game.totalCoins));
  
  const minutes = Math.floor(game.playTime / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  let timeStr = '';
  if (days > 0) timeStr += `${days}д `;
  if (hours % 24 > 0) timeStr += `${hours % 24}ч `;
  timeStr += `${minutes % 60}м`;
  
  document.getElementById('statPlayTime').textContent = timeStr;
  document.getElementById('statAchievements').textContent = `${game.achievements.length}/${achievementsData.length}`;
}

function resetGame() {
  if (confirm('Вы уверены? Весь прогресс будет потерян!')) {
    localStorage.removeItem('cosatkaClicker');
    location.reload();
  }
}

// Принудительное сохранение всех данных
window.forceSave = function() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  
  const saveStatus = document.getElementById('saveStatus');
  if (saveStatus) {
    saveStatus.textContent = '⏳ Сохранение...';
    saveStatus.style.color = 'rgba(255, 215, 0, 0.8)';
  }
  
  // Отправляем команду сохранения
  ws.send(JSON.stringify({ type: 'forceSaveAll' }));
  
  // Ожидаем ответ
  const timeout = setTimeout(() => {
    if (saveStatus) {
      saveStatus.textContent = '✅ Готово! Все данные сохранены';
      saveStatus.style.color = 'rgba(0, 212, 255, 0.8)';
    }
  }, 1000);
  
  console.log('💾 Запрос принудительного сохранения отправлен');
};

// Обработка ответа на forceSaveAll
window.handleForceSaveResponse = function(data) {
  const saveStatus = document.getElementById('saveStatus');
  if (saveStatus) {
    if (data.success) {
      saveStatus.textContent = `✅ Всё сохранено! Клан: ${data.clanId ? '✓' : 'нет'}`;
      saveStatus.style.color = 'rgba(0, 212, 255, 0.8)';
      showNotification(`✅ ${data.message}`);
    } else {
      saveStatus.textContent = '❌ Ошибка сохранения';
      saveStatus.style.color = 'rgba(244, 67, 54, 0.8)';
    }
  }
  console.log('💾 Ответ на forceSaveAll:', data);
};

// ==================== СОХРАНЕНИЕ ====================

// "Реальное время" для сервера: склеиваем частые изменения в 1 отправку
let serverSaveTimer = null;
let serverSavePending = false;
let lastServerSaveAt = 0;
const SERVER_SAVE_DEBOUNCE_MS = 250;
const SERVER_SAVE_MAX_WAIT_MS = 1500;

function scheduleServerSave() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  serverSavePending = true;

  const now = Date.now();
  if (!serverSaveTimer && (now - lastServerSaveAt) >= SERVER_SAVE_MAX_WAIT_MS) {
    saveGameToServer();
    return;
  }

  if (serverSaveTimer) return;
  serverSaveTimer = setTimeout(() => {
    serverSaveTimer = null;
    if (serverSavePending) saveGameToServer();
  }, SERVER_SAVE_DEBOUNCE_MS);
}

function saveGameToServer() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  serverSavePending = false;
  lastServerSaveAt = Date.now();
  ws.send(JSON.stringify({
    type: 'saveGame',
    data: {
      coins: game.coins,
      totalCoins: game.totalCoins,
      level: game.level,
      perClick: game.basePerClick || 0,
      perSecond: game.basePerSecond || 0,
      clicks: game.clicks,
      effects: game.effects,
      skins: game.skins,
      currentSkin: game.currentSkin,
      achievements: game.achievements,
      playTime: game.playTime,
      pendingBoxes: pendingBoxes,
      shopItems: shopItems.map(i => ({ id: i.id, cost: i.cost })),
      questProgress: game.quests.map(q => ({ id: q.id, completed: q.completed }))
    }
  }));
}

function saveGame() {
  // Сохраняем в localStorage (резервное)
  const saveData = {
    coins: game.coins,
    totalCoins: game.totalCoins,
    perClick: game.basePerClick,
    perSecond: game.basePerSecond,
    clicks: game.clicks,
    level: game.level,
    effects: game.effects,
    achievements: game.achievements,
    skins: game.skins,
    currentSkin: game.currentSkin,
    playTime: game.playTime,
    multiplier: game.multiplier
  };
  localStorage.setItem('cosatkaClicker', JSON.stringify(saveData));
  
  // Также отправляем на сервер
  scheduleServerSave();
}

// Принудительное сохранение всех данных на сервер
window.forceSave = function() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }

  showNotification('💾 Сохранение данных...');
  
  ws.send(JSON.stringify({
    type: 'saveGame',
    data: {
      coins: game.coins,
      totalCoins: game.totalCoins,
      perClick: game.basePerClick,
      perSecond: game.basePerSecond,
      clicks: game.clicks,
      level: game.level,
      effects: game.effects,
      skins: game.skins,
      currentSkin: game.currentSkin,
      achievements: game.achievements,
      pendingBoxes: pendingBoxes,
      playTime: game.playTime,
      shopItems: shopItems.map(i => ({ id: i.id, cost: i.cost })),
      questProgress: game.quests.map(q => ({ id: q.id, completed: q.completed }))
    }
  }));

  // Обновляем статус сохранения
  const saveStatus = document.getElementById('saveStatus');
  if (saveStatus) {
    saveStatus.textContent = '💾 Сохранение...';
    saveStatus.style.color = '#ffd700';
  }

  // Через 2 секунды возвращаем обратно
  setTimeout(() => {
    if (saveStatus) {
      saveStatus.textContent = '✅ Сохранено!';
      saveStatus.style.color = '#4caf50';
    }
    setTimeout(() => {
      if (saveStatus) {
        saveStatus.textContent = '💾 Автосохранение включено';
        saveStatus.style.color = 'rgba(255,255,255,0.5)';
      }
    }, 2000);
  }, 1000);

  console.log('💾 Принудительное сохранение инициировано');
};

function loadGame() {
  const saved = localStorage.getItem('cosatkaClicker');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      game.coins = data.coins || 0;
      game.totalCoins = data.totalCoins || 0;
      game.level = data.level || 1;
      game.basePerClick = data.basePerClick || data.perClick || 0;
      game.basePerSecond = data.basePerSecond || data.perSecond || 0;
      game.clicks = data.clicks || 0;
      game.effects = data.effects || {};
      game.achievements = data.achievements || [];
      game.skins = data.skins || {};
      game.currentSkin = data.currentSkin || 'normal';
      game.playTime = data.playTime || 0;
      game.multiplier = data.multiplier || 1;
      
      // НЕ применяем эффекты навыков - они рассчитываются динамически через getPerClick()/getPerSecond()
      
      if (data.shopItems) {
        data.shopItems.forEach(savedItem => {
          const item = shopItems.find(i => i.id === savedItem.id);
          if (item) item.cost = savedItem.cost;
        });
      }
      
      if (data.questProgress) {
        game.quests = questsData.map(q => {
          const saved = data.questProgress.find(p => p.id === q.id);
          return { ...q, completed: saved ? saved.completed : false };
        });
      } else {
        initQuests();
      }
    } catch (e) {
      console.error('Error loading save:', e);
      initQuests();
    }
  } else {
    initQuests();
  }
}

function exportSave() {
  const saved = localStorage.getItem('cosatkaClicker');
  document.getElementById('saveData').value = btoa(saved || '{}');
}

function importSave() {
  try {
    const data = atob(document.getElementById('saveData').value);
    localStorage.setItem('cosatkaClicker', data);
    loadGame();
    updateUI();
    showNotification('✅ Сохранение загружено!');
  } catch (e) {
    alert('Ошибка загрузки сохранения');
  }
}

function resetGame() {
  if (confirm('Вы уверены? Весь прогресс будет потерян!')) {
    localStorage.removeItem('cosatkaClicker');
    location.reload();
  }
}

// Аудио настройки
let bgMusic = null;

function initAudio() {
  bgMusic = document.getElementById('bgMusic');
}

function toggleBgMusic() {
  const toggle = document.getElementById('bgMusicToggle');
  if (!toggle) return;
  
  const isPlaying = toggle.checked;
  
  if (bgMusic) {
    const volume = document.getElementById('volume');
    bgMusic.volume = volume ? volume.value / 100 : 0.5;
    if (isPlaying) {
      bgMusic.play().catch(() => {});
    } else {
      bgMusic.pause();
    }
  }
  
  localStorage.setItem('bgMusicEnabled', isPlaying);
}

function saveSfxSetting() {
  const sfxToggle = document.getElementById('sfxToggle');
  if (sfxToggle) {
    localStorage.setItem('sfxEnabled', sfxToggle.checked);
  }
}

function setVolume(value) {
  if (bgMusic) {
    bgMusic.volume = value / 100;
  }
  localStorage.setItem('volume', value);
}

function setBg(bgClass, btn) {
  document.body.className = bgClass;
  document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  localStorage.setItem('bgClass', bgClass);
}

function loadSettings() {
  const bgMusicEnabled = localStorage.getItem('bgMusicEnabled') === 'true';
  const sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false';
  const volume = localStorage.getItem('volume') || 50;
  const bgClass = localStorage.getItem('bgClass') || 'bg-ocean';
  
  const bgMusicToggle = document.getElementById('bgMusicToggle');
  const sfxToggle = document.getElementById('sfxToggle');
  const volumeSlider = document.getElementById('volume');
  
  if (bgMusicToggle) bgMusicToggle.checked = bgMusicEnabled;
  if (sfxToggle) sfxToggle.checked = sfxEnabled;
  if (volumeSlider) volumeSlider.value = volume;
  
  if (bgMusicEnabled && bgMusic) {
    bgMusic.volume = volume / 100;
    bgMusic.play().catch(() => {});
  }
  
  const bgBtn = document.querySelector(`.bg-btn[onclick*="${bgClass}"]`);
  setBg(bgClass, bgBtn);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
let effectsApplied = false;  // Флаг чтобы не применять эффекты дважды

document.addEventListener('DOMContentLoaded', () => {
  initDOM();
  initAudio();
  loadGame();
  loadSettings();
  updateUI();
  
  // Применяем эффекты только если ещё не применяли
  if (!effectsApplied) {
    applyEffects();
    effectsApplied = true;
  }
  
  connectWebSocket();
  
  // Обновление при изменении имени
  const nameInput = document.getElementById('playerName');
  if (nameInput) {
    nameInput.addEventListener('change', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'register', name: nameInput.value }));
      }
    });
    
    nameInput.addEventListener('input', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'register', name: nameInput.value }));
      }
    });
  }
});

