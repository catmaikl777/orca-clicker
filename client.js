// ==================== ИГРОВЫЕ ДАННЫЕ ====================
const game = {
  coins: 0,
  totalCoins: 0,
  level: 1,
  perClick: 1,
  perSecond: 0,
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

// Навыки (дерево)
const skillsData = [
  { id: 's1', name: 'Двойной клик', desc: '2x за клик', cost: 1000, effect: () => { game.basePerClick = game.basePerClick || game.perClick; game.perClick = game.basePerClick * 2; } },
  { id: 's2', name: 'Критический удар', desc: '10% шанс 10x', cost: 5000, effect: () => {} },
  { id: 's3', name: 'Авто-эффективность', desc: '2x за секунду', cost: 3000, effect: () => { game.basePerSecond = game.basePerSecond || game.perSecond; game.perSecond = game.basePerSecond * 2; } },
  { id: 's4', name: 'Золотая лихорадка', desc: 'Бонусы дают 3x', cost: 2000, effect: () => {} },
  { id: 's5', name: 'Мастер клика', desc: '5x за клик', cost: 10000, effect: () => { game.basePerClick = game.basePerClick || game.perClick; game.perClick = game.basePerClick * 5; } },
  { id: 's6', name: 'Бизнес-косатка', desc: '5x за секунду', cost: 15000, effect: () => { game.basePerSecond = game.basePerSecond || game.perSecond; game.perSecond = game.basePerSecond * 5; } }
];

// ==================== WEBSOCKET ====================
let ws = null;
window.ws = null;
let playerId = null;
let battleId = null;
let battleClicks = 0;
let lastBattleUpdate = 0;
let battleInterval = null;
let wsConnected = false;

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
    
    // Сохраняем информацию об аккаунте
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
      game.perClick = d.perClick || 1;
      game.perSecond = d.perSecond || 0;
      game.clicks = d.clicks || 0;
      game.skills = d.skills || {};
      game.achievements = d.achievements || [];
      game.skins = d.skins || { normal: true };
      game.currentSkin = d.currentSkin || 'normal';
      game.playTime = d.playTime || 0;
      
      // Боксы
      if (d.pendingBoxes) pendingBoxes = d.pendingBoxes;
      
      // Цены улучшений
      if (d.shopItems) {
        d.shopItems.forEach(saved => {
          const item = shopItems.find(i => i.id === saved.id);
          if (item) item.cost = saved.cost;
        });
      }
      
      // Прогресс квестов
      if (d.questProgress) {
        game.quests = questsData.map(q => {
          const saved = d.questProgress.find(p => p.id === q.id);
          return { ...q, completed: saved ? saved.completed : false };
        });
      } else if (!game.quests.length) {
        initQuests();
      }
      
      // Применяем эффекты навыков
      skillsData.forEach(skill => {
        if (game.skills[skill.id] && skill.effect) skill.effect();
      });
      
      // Билеты ивента
      if (data.eventCoins) eventCoins = data.eventCoins;
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
    
    console.log('🎮 Игровые данные загружены');
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
        game.perClick = data.data.perClick || 1;
        game.perSecond = data.data.perSecond || 0;
        game.clicks = data.data.clicks || 0;
        game.skills = data.data.skills || {};
        game.skins = data.data.skins || {};
        game.currentSkin = data.data.currentSkin || 'normal';
        eventCoins = data.eventCoins || 0;
        
        // Показываем уведомление если монеты изменились (награды ивента)
        if (game.coins > oldCoins + 1000) {
          showNotification(`💰 Награда ивента: +${formatNumber(game.coins - oldCoins)}!`);
          playSound('bonusSound');
        }
        
        updateUI();
        renderShop();
        renderBoxes();
      }
      break;
    case 'eventInfo':
      eventInfo = data.event;
      eventCoins = data.event.eventCoins || 0;
      updateEventUI();
      renderEventLeaderboard();
      break;
    case 'leaderboard':
      updateLeaderboardUI(data.data);
      break;
    case 'waitingForBattle':
      document.getElementById('battleStatus').textContent = 'Поиск соперника...';
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
    case 'skillBought':
      game.skills[data.skillId] = true;
      // Применяем эффект навыка
      const boughtSkill = skillsData.find(s => s.id === data.skillId);
      if (boughtSkill && boughtSkill.effect) boughtSkill.effect();
      showNotification(`✨ Навык «${data.skillName}» куплен!`);
      renderSkills();
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
      // Сохраняем чтобы данные зафиксировались локально
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
      if (data.perClick !== undefined) game.perClick = data.perClick;
      if (data.perSecond !== undefined) game.perSecond = data.perSecond;
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
    case 'skillBought':
      // Сервер подтвердил покупку навыка
      game.skills[data.skillId] = true;
      const skill = skillsData.find(s => s.id === data.skillId);
      if (skill && skill.effect) skill.effect();
      showNotification(`✨ Навык получен: ${data.skillName}`);
      renderSkills();
      updateUI();
      saveGame();
      break;
    case 'skinBought':
      // Покупка скина отключена; оставляем совместимость если сервер где-то ещё шлёт
      showNotification('🎁 Скины можно получить только из ящика');
      break;
    case 'skinEquipped':
      // Сервер подтвердил выбор скина
      if (data.skinId) game.currentSkin = data.skinId;
      showNotification(`🎨 Скин "${skinsData.find(s => s.id === data.skinId)?.name || data.skinId}" выбран!`);
      renderSkins();
      updateUI();
      saveGame();
      break;
    case 'error':
      showNotification(`⚠️ ${data.message}`);
      break;
  }
}

// ==================== ОСНОВНАЯ МЕХАНИКА ====================
const clicker = document.getElementById('clicker');
const coinsEl = document.getElementById('coins');
const levelEl = document.getElementById('level');
const perClickEl = document.getElementById('perClick');
const perSecondEl = document.getElementById('perSecond');
const orcaImg = document.getElementById('orcaImg');
const orcaEmoji = document.getElementById('orcaEmoji');

// Клик по косатке
function handleClick(e) {
  e.preventDefault();
  
  let value = game.perClick * game.multiplier;
  let isCrit = false;
  const x = e.clientX || (e.touches && e.touches[0]?.clientX) || window.innerWidth / 2;
  const y = e.clientY || (e.touches && e.touches[0]?.clientY) || window.innerHeight / 2;
  
  if (game.skills['s2'] && Math.random() < 0.1) {
    value *= 10;
    isCrit = true;
    showFloatingText(x, y, `КРИТ! +${formatNumber(value)}`, '#ff5252');
    playSound('critSound');
  } else {
    showFloatingText(x, y, `+${formatNumber(value)}`, '#4fc3f7');
    playSound('clickSound');
  }
  
  if (x2Active) showFloatingText(x, y - 50, `x2! ⭐`, '#ffd700');
  createClickParticles(x, y, x2Active ? 'gold' : '#4fc3f7', isCrit);
  
  game.coins += value;
  game.totalCoins += value;
  game.clicks++;
  
  if (game.clicks % 100 === 0) addEventCoins(1);
  
  clicker.style.transform = 'scale(0.9)';
  setTimeout(() => clicker.style.transform = 'scale(1)', 100);
  
  checkAchievements();
  checkQuests();
  updateUI();
  saveGame();
}

clicker.addEventListener('click', handleClick);
clicker.addEventListener('touchstart', handleClick, { passive: false });

// Функция для создания частиц при клике
function createClickParticles(x, y, color, intense = false) {
  const particleCount = intense ? 20 : 12;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.background = color;
    particle.style.boxShadow = `0 0 ${intense ? 15 : 10}px ${color}`;
    
    // Случайное направление разлета
    const angle = (Math.PI * 2 * i) / particleCount;
    const speed = intense ? 150 + Math.random() * 100 : 100 + Math.random() * 80;
    const tx = Math.cos(angle) * speed;
    const ty = Math.sin(angle) * speed;
    
    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    
    document.getElementById('clickEffects').appendChild(particle);
    
    setTimeout(() => particle.remove(), 900);
  }
}

// Мобильный аудио unlock (iOS/Android блокируют звук без жеста пользователя)
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const sounds = document.querySelectorAll('audio');
  sounds.forEach(s => {
    s.play().catch(() => {});
    s.pause();
    s.currentTime = 0;
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

// Автокликер
setInterval(() => {
  if (game.perSecond > 0) {
    game.coins += game.perSecond * game.multiplier;
    game.totalCoins += game.perSecond * game.multiplier;
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

// Система бонусов
const bonus = document.getElementById('bonus');
const fishBonus = document.getElementById('fishBonus');
const x2Bonus = document.getElementById('x2Bonus');

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

setInterval(spawnBonus, 12000);

// x2 Бонус клик
x2Bonus.addEventListener('click', () => {
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
});

bonus.addEventListener('click', () => {
  const multiplier = game.skills['s4'] ? 3 : 2;
  const bonusValue = game.perClick * 15 * multiplier * game.multiplier;
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
});

fishBonus.addEventListener('click', () => {
  const fishValue = Math.max(game.perSecond * 30 * game.multiplier, game.perClick * 10);
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
});
  
// ==================== UI ОБНОВЛЕНИЯ ====================
function updateUI() {
  coinsEl.textContent = formatNumber(Math.floor(game.coins));
  levelEl.textContent = game.level;
  perClickEl.textContent = formatNumber(game.perClick * game.multiplier);
  perSecondEl.textContent = formatNumber(game.perSecond * game.multiplier);
  
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
    orcaImg.src = skin.image;
    orcaImg.style.display = 'block';
    orcaEmoji.style.display = 'none';
    clicker.className = `clicker skin-${skin.id}`;
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
      if (item.type === 'click') game.perClick += item.value;
      if (item.type === 'auto') game.perSecond += item.value;
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

// ==================== ДЕРЕВО НАВЫКОВ ====================
function renderSkills() {
  const container = document.getElementById('skillTree');
  container.innerHTML = '';
  
  const branch = document.createElement('div');
  branch.className = 'skill-branch';
  branch.innerHTML = '<h4>🌟 Особые навыки</h4>';
  
  const skillsDiv = document.createElement('div');
  skillsDiv.className = 'skills';
  
  skillsData.forEach(skill => {
    const div = document.createElement('div');
    div.className = `skill ${game.skills[skill.id] ? 'bought' : ''} ${game.coins < skill.cost && !game.skills[skill.id] ? 'locked' : ''}`;
    div.innerHTML = `
      <div>⭐</div>
      <div>${skill.name}</div>
      <small>${formatNumber(skill.cost)}</small>
    `;
    if (!game.skills[skill.id]) {
      div.onclick = () => buySkill(skill);
    }
    skillsDiv.appendChild(div);
  });
  
  branch.appendChild(skillsDiv);
  container.appendChild(branch);
}

function buySkill(skill) {
  if (!game.skills[skill.id]) {
    if (game.coins >= skill.cost) {
      // Отправляем запрос на сервер
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'buySkill', skillId: skill.id }));
        // НЕ обновляем локально - ждём подтверждения
      } else {
        // Локальная покупка если нет сервера
        game.coins -= skill.cost;
        game.skills[skill.id] = true;
        if (skill.effect) skill.effect();
        showNotification(`✨ Навык получен: ${skill.name}`);
        renderSkills();
        updateUI();
        saveGame();
      }
    } else {
      showNotification('⚠️ Недостаточно монет!');
    }
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
    { id: 'a5', check: () => game.perClick >= 1000 },
    { id: 'a6', check: () => game.perSecond >= 1000 }
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
  
  document.getElementById('battleLobby').classList.add('hidden');
  document.getElementById('battleArena').classList.remove('hidden');
  document.getElementById('opponentName').textContent = data.opponent;
  document.getElementById('myBattleScore').textContent = '0';
  document.getElementById('opponentScore').textContent = '0';
  document.getElementById('myCPS').textContent = `${data.yourPerSecond || 0} CPS`;
  document.getElementById('opponentCPS').textContent = `${data.opponentPerSecond || 0} CPS`;
  
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
  
  let timer = data.duration / 1000;
  const timerEl = document.getElementById('battleTimer');
  timerEl.textContent = timer;
  
  // Считаем клики в секунду
  let clickCount = 0;
  let lastTime = Date.now();
  
  battleClickBtn.onclick = () => {
    clickCount++;
    myBattleClicks++;
    document.getElementById('myBattleScore').textContent = myBattleClicks;
    
    // Обновляем CPS каждую секунду
    const now = Date.now();
    if (now - lastTime >= 1000) {
      myBattleCPS = clickCount;
      clickCount = 0;
      lastTime = now;
      document.getElementById('myCPS').textContent = `${myBattleCPS} CPS`;
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
  
  battleInterval = setInterval(() => {
    timer--;
    timerEl.textContent = timer;
    if (timer <= 0) clearInterval(battleInterval);
  }, 1000);
}

function updateBattleUI(data) {
  // data.yourScore = мои клики, data.opponentScore = клики соперника
  document.getElementById('myBattleScore').textContent = data.yourScore;
  document.getElementById('opponentScore').textContent = data.opponentScore;
  document.getElementById('myCPS').textContent = `${data.yourCPS || 0} CPS`;
  document.getElementById('opponentCPS').textContent = `${data.opponentCPS || 0} CPS`;
  // Локально тоже обновляем чтобы не было рассинхрона
  myBattleClicks = data.yourScore;
}

function endBattleUI(data) {
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
    document.getElementById('battleLobby').classList.remove('hidden');
    document.getElementById('battleArena').classList.add('hidden');
    document.getElementById('battleStatus').textContent = 'Нажмите кнопку для поиска соперника';
    battleId = null;
    myBattleClicks = 0;
    const btn = document.getElementById('battleClickBtn');
    if (btn) btn.onclick = null;
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
  eventCoins += amount;
  updateEventUI();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'addEventCoins', amount }));
  }
}

function updateEventUI() {
  const eventCoinsEl = document.getElementById('eventCoins');
  if (eventCoinsEl) {
    eventCoinsEl.textContent = formatNumber(eventCoins);
  }
  
  const eventCoinsDisplay = document.getElementById('eventCoinsDisplay');
  if (eventCoinsDisplay) {
    eventCoinsDisplay.textContent = formatNumber(eventCoins);
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
  if (id === 'skills') renderSkills();
  if (id === 'achievements') renderAchievements();
  if (id === 'stats') updateStats();
  if (id === 'leaderboard' && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'getLeaderboard' }));
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
  } else if (tab === 'skins') {
    document.getElementById('shopUpgrades').style.display = 'none';
    document.getElementById('shopSkins').style.display = 'grid';
    document.getElementById('shopBoxes').style.display = 'none';
    renderSkins();
  } else if (tab === 'boxes') {
    document.getElementById('shopUpgrades').style.display = 'none';
    document.getElementById('shopSkins').style.display = 'none';
    document.getElementById('shopBoxes').style.display = 'flex';
    renderBoxes();
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
      perClick: game.perClick,
      perSecond: game.perSecond,
      basePerClick: game.basePerClick || game.perClick,
      basePerSecond: game.basePerSecond || game.perSecond,
      clicks: game.clicks,
      skills: game.skills,
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
    level: game.level,
    perClick: game.perClick,
    perSecond: game.perSecond,
    clicks: game.clicks,
    skills: game.skills,
    achievements: game.achievements,
    shopItems: shopItems.map(i => ({ id: i.id, cost: i.cost })),
    questProgress: game.quests.map(q => ({ id: q.id, completed: q.completed })),
    skins: game.skins,
    currentSkin: game.currentSkin,
    playTime: game.playTime,
    multiplier: game.multiplier
  };
  localStorage.setItem('cosatkaClicker', JSON.stringify(saveData));
  
  // Также отправляем на сервер
  scheduleServerSave();
}

function loadGame() {
  const saved = localStorage.getItem('cosatkaClicker');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      game.coins = data.coins || 0;
      game.totalCoins = data.totalCoins || 0;
      game.level = data.level || 1;
      game.perClick = data.perClick || 1;
      game.perSecond = data.perSecond || 0;
      game.clicks = data.clicks || 0;
      game.skills = data.skills || {};
      game.achievements = data.achievements || [];
      game.skins = data.skins || {};
      game.currentSkin = data.currentSkin || 'normal';
      game.playTime = data.playTime || 0;
      game.multiplier = data.multiplier || 1;
      
      // Применяем эффекты навыков
      skillsData.forEach(skill => {
        if (game.skills[skill.id] && skill.effect) skill.effect();
      });
      
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
const bgMusic = document.getElementById('bgMusic');

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
document.addEventListener('DOMContentLoaded', () => {
  loadGame();
  loadSettings();
  updateUI();
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

