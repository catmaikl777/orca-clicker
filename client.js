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
  multiplier: 1,
  dailyQuestDate: null,
  dailyQuestIds: [],
  dailyProgress: { clicks: 0, coins: 0, playTime: 0 },
  clan: null,
  // Отслеживание кланов для достижений
  clansJoinedHistory: [],
  ownedClanMemberCount: 0,
  // Путь к славе (ранги)
  totalRankClicks: 0,
  currentRank: 'novice',
  rankRewardsClaimed: [],
  // Ежедневная серия
  lastLoginDate: null,
  loginStreak: 0,
  lastStreakRewardDate: null,
  // Рыбалка
  fish: 0
};

// Глобальные переменные для кланов
let clansList = [];

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
// ==================== УТИЛИТЫ ====================
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 4);
}

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

// Скины с изображениями - ВСЕ ТОЛЬКО ИЗ БОКСОВ!
const skinsData = [
  { id: 'normal', name: 'Обычная', cost: 0, image: 'normal.png' },
  { id: 'chillcat', name: 'Чилл', cost: 0, image: 'CHILLCAT.png' },
  { id: 'hiding', name: 'Прячущаяся', cost: 0, image: 'cat_hiding.png' },
  { id: 'beauty', name: 'Красавица', cost: 0, image: 'beauty_cat.png' },
  { id: 'wild', name: 'Дикая', cost: 0, image: 'wild_cat.png' },
  { id: 'cyberpunk', name: 'Киберпанк', cost: 0, image: 'skin_cyberpunk.png' },
  { id: 'interesting', name: 'Интересная', cost: 0, image: 'interesting.png' },
  
  // ДОПОЛНИТЕЛЬНЫЕ СКИНЫ - только из боксов!
  { id: 'richi', name: 'Ричи', cost: 0, image: 'richi.png', secret: true },
  { id: 'cute', name: 'Милашка', cost: 0, image: 'cute.png' },
  { id: 'bugeyed', name: 'Глазастая', cost: 0, image: 'bug-eyed.png' },
  { id: 'abitchonky', name: 'Пухляшка', cost: 0, image: 'a-bit-chonky.png' }
];

const richiSecretAchievementThreshold = 40;

function unlockSecretRichiSkin() {
  if (!game.skins.richi && game.achievements.length >= richiSecretAchievementThreshold) {
    game.skins.richi = true;
    showRichiUnlockAnimation();
    renderSkins();
    saveGame();
  }
}

function showRichiUnlockAnimation() {
  const animationModal = document.createElement('div');
  animationModal.className = 'richi-unlock-modal';
  animationModal.innerHTML = `
    <div class="richi-unlock-overlay"></div>
    <div class="richi-unlock-content">
      <div class="richi-sparkles"></div>
      <div class="richi-glow"></div>
      <div class="richi-image-container">
        <img src="richi.png" alt="Ричи" class="richi-unlock-image" onerror="this.style.display='none'">
      </div>
      <h1 class="richi-unlock-title">✨ СЕКРЕТНЫЙ СКИН РАЗБЛОКИРОВАН! ✨</h1>
      <p class="richi-unlock-subtitle">Ричи получен за ВСЕ достижения!</p>
      <button class="richi-unlock-btn" onclick="this.closest('.richi-unlock-modal').remove()">Принять</button>
    </div>
  `;

  document.body.appendChild(animationModal);

  setTimeout(() => {
    animationModal.classList.add('show');
    playSound('levelSound');
  }, 100);

  // Автоматическое закрытие через 8 секунд
  setTimeout(() => {
    if (animationModal.parentNode) {
      animationModal.remove();
    }
  }, 8000);
}

// Квесты
const questsData = [
  // Базовые квесты
  { id: 'q1', name: 'Первые шаги', desc: 'Сделайте 100 кликов', target: 100, type: 'clicks', reward: 100 },
  { id: 'q2', name: 'Богач', desc: 'Накопите 1,000 косаток', target: 1000, type: 'coins', reward: 200 },
  { id: 'q3', name: 'Кликер мастер', desc: 'Сделайте 1,000 кликов', target: 1000, type: 'clicks', reward: 500 },
  { id: 'q4', name: 'Миллионер', desc: 'Накопите 1,000,000 косаток', target: 1000000, type: 'totalCoins', reward: 10000 },
  
  // Новые квесты - клики
  { id: 'q5', name: 'Трудоголик', desc: 'Сделайте 5,000 кликов', target: 5000, type: 'clicks', reward: 2000 },
  { id: 'q6', name: 'Клик-машина', desc: 'Сделайте 10,000 кликов', target: 10000, type: 'clicks', reward: 5000 },
  { id: 'q7', name: 'Легенда клика', desc: 'Сделайте 50,000 кликов', target: 50000, type: 'clicks', reward: 25000 },
  { id: 'q8', name: 'Бог клика', desc: 'Сделайте 100,000 кликов', target: 100000, type: 'clicks', reward: 50000 },
  
  // Новые квесты - монеты
  { id: 'q9', name: 'Первый миллион', desc: 'Накопите 100,000 косаток', target: 100000, type: 'coins', reward: 5000 },
  { id: 'q10', name: 'Миллиардер', desc: 'Накопите 1,000,000,000 косаток', target: 1000000000, type: 'coins', reward: 50000 },
  { id: 'q11', name: 'Триллионер', desc: 'Накопите 1 триллион косаток', target: 1000000000000, type: 'coins', reward: 100000 },
  
  // Новые квесты - автодоход
  { id: 'q12', name: 'Пассивный доход', desc: 'Достигните 100/сек', target: 100, type: 'perSecond', reward: 1000 },
  { id: 'q13', name: 'Бизнесмен', desc: 'Достигните 1,000/сек', target: 1000, type: 'perSecond', reward: 5000 },
  { id: 'q14', name: 'Корпорация', desc: 'Достигните 10,000/сек', target: 10000, type: 'perSecond', reward: 25000 },
  { id: 'q15', name: 'Империя', desc: 'Достигните 100,000/сек', target: 100000, type: 'perSecond', reward: 100000 },
  
  // Новые квесты - за клик
  { id: 'q16', name: 'Мощный клик', desc: 'Достигните 100 за клик', target: 100, type: 'perClick', reward: 1000 },
  { id: 'q17', name: 'Силач', desc: 'Достигните 1,000 за клик', target: 1000, type: 'perClick', reward: 5000 },
  { id: 'q18', name: 'Титан', desc: 'Достигните 10,000 за клик', target: 10000, type: 'perClick', reward: 25000 },
  
  // Новые квесты - время
  { id: 'q19', name: 'Новичок', desc: 'Проведите в игре 10 минут', target: 600, type: 'playTime', reward: 500 },
  { id: 'q20', name: 'Ветеран', desc: 'Проведите в игре 1 час', target: 3600, type: 'playTime', reward: 2000 },
  { id: 'q21', name: 'Постоянный клиент', desc: 'Проведите в игре 5 часов', target: 18000, type: 'playTime', reward: 10000 },
  
  // ДОПОЛНИТЕЛЬНЫЕ КВЕСТЫ - новые!
  { id: 'q22', name: 'Бустер', desc: 'Достигните 50,000/сек', target: 50000, type: 'perSecond', reward: 50000 },
  { id: 'q23', name: 'Магнат', desc: 'Достигните 100,000 за клик', target: 100000, type: 'perClick', reward: 100000 },
  { id: 'q24', name: 'Исследователь', desc: 'Проведите в игре 10 часов', target: 36000, type: 'playTime', reward: 25000 },
  { id: 'q25', name: 'Вселенский', desc: 'Накопите 1 квадриллион косаток', target: 1000000000000000, type: 'totalCoins', reward: 500000 },
  { id: 'q26', name: 'Коллекционер боксов', desc: 'Откройте 100 боксов', target: 100, type: 'boxesOpened', reward: 50000 },
  { id: 'q27', name: 'Мастер батлов', desc: 'Выиграйте 50 батлов', target: 50, type: 'battlesWon', reward: 75000 },
  { id: 'q28', name: 'Щедрый', desc: 'Пожертвуйте 10,000 косаток в клан', target: 10000, type: 'clanDonations', reward: 15000 },
  { id: 'q29', name: 'Лидер', desc: 'Создайте клан', target: 1, type: 'clanCreated', reward: 10000 },
  { id: 'q30', name: 'Командный игрок', desc: 'Вступите в 5 разных кланов', target: 5, type: 'clanJoins', reward: 8000 },
  
  // Ежедневные квесты (генерируются каждый день)
  { id: 'daily1', name: 'Утренняя зарядка', desc: 'Сделайте 500 кликов за день', target: 500, type: 'clicks', reward: 2000 },
  { id: 'daily2', name: 'Деньги любят счёт', desc: 'Заработайте 10,000 косаток за день', target: 10000, type: 'coins', reward: 3000 },
  { id: 'daily3', name: 'Онлайн марафон', desc: 'Проведите 2 часа в игре сегодня', target: 7200, type: 'playTime', reward: 1500 }
];

// Достижения
const achievementsData = [
  // Базовые достижения
  { id: 'a1', name: 'Дебютант', desc: 'Сделайте первый клик', icon: '👆' },
  { id: 'a2', name: 'Усердный', desc: 'Сделайте 100 кликов', icon: '💪' },
  { id: 'a3', name: 'Миллионер', desc: 'Накопите 1,000,000', icon: '💰' },
  { id: 'a4', name: 'Коллекционер', desc: 'Купите все улучшения', icon: '🏆' },
  { id: 'a5', name: 'Мастер клика', desc: 'Достигните 1000 за клик', icon: '⚡' },
  { id: 'a6', name: 'Пассивный доход', desc: 'Достигните 1000/сек', icon: '📈' },
  
  // Новые достижения - клики
  { id: 'a7', name: 'Разминка', desc: 'Сделайте 1,000 кликов', icon: '👐' },
  { id: 'a8', name: 'Трудяга', desc: 'Сделайте 10,000 кликов', icon: '🔨' },
  { id: 'a9', name: 'Клик-маньяк', desc: 'Сделайте 100,000 кликов', icon: '🤯' },
  { id: 'a10', name: 'Легенда', desc: 'Сделайте 1,000,000 кликов', icon: '👑' },
  
  // Новые достижения - монеты
  { id: 'a11', name: 'Богач', desc: 'Накопите 10,000 косаток', icon: '💵' },
  { id: 'a12', name: 'Олигарх', desc: 'Накопите 100,000,000 косаток', icon: '💎' },
  { id: 'a13', name: 'Властелин денег', desc: 'Накопите 1 триллион', icon: '🌟' },
  
  // Новые достижения - улучшения
  { id: 'a14', name: 'Шопоголик', desc: 'Купите 5 улучшений', icon: '🛒' },
  { id: 'a15', name: 'Инвестор', desc: 'Купите 10 улучшений', icon: '📊' },
  { id: 'a16', name: 'Меценат', desc: 'Купите все улучшения', icon: '💰' },
  
  // Новые достижения - эффекты
  { id: 'a17', name: 'Эстет', desc: 'Купите первый эффект', icon: '✨' },
  { id: 'a18', name: 'Художник', desc: 'Купите все эффекты', icon: '🎨' },
  
  // Новые достижения - время
  { id: 'a19', name: 'Постоянный игрок', desc: 'Проведите в игре 30 минут', icon: '⏰' },
  { id: 'a20', name: 'Ночной дожор', desc: 'Проведите в игре 3 часа', icon: '🌙' },
  
  // Новые достижения - бонусы
  { id: 'a21', name: 'Удача', desc: 'Найдите 10 бонусов', icon: '🍀' },
  { id: 'a22', name: 'Счастливчик', desc: 'Найдите 50 бонусов', icon: '🌈' },
  
  // Новые достижения - батлы
  { id: 'a23', name: 'Воин', desc: 'Выиграйте 5 батлов', icon: '⚔️' },
  { id: 'a24', name: 'Чемпион', desc: 'Выиграйте 20 батлов', icon: '🏆' },
  
  // Новые достижения - квесты
  { id: 'a25', name: 'Исполнитель', desc: 'Выполните 5 квестов', icon: '✅' },
  { id: 'a26', name: 'Мастер квестов', desc: 'Выполните все квесты', icon: '🎯' },
  
  // ДОПОЛНИТЕЛЬНЫЕ ДОСТИЖЕНИЯ - новые!
  { id: 'a27', name: 'Богоподобный', desc: 'Накопите 1 кватриллион косаток', icon: '🔥' },
  { id: 'a28', name: 'Кликер-бог', desc: 'Достигните 1,000,000 за клик', icon: '💥' },
  { id: 'a29', name: 'Авто-машина', desc: 'Достигните 1,000,000/сек', icon: '🤖' },
  { id: 'a30', name: 'Вечный', desc: 'Проведите в игре 100 часов', icon: '⚡' },
  { id: 'a31', name: 'Скин-коллекционер', desc: 'Откройте все скины из боксов', icon: '🎭' },
  { id: 'a32', name: 'Эффектный', desc: 'Купите 3 эффекта', icon: '🌟' },
  { id: 'a33', name: 'Бокс-хантер', desc: 'Откройте 50 боксов', icon: '📦' },
  { id: 'a34', name: 'Рыболов', desc: 'Откройте 25 рыбных боксов', icon: '🐟' },
  { id: 'a35', name: 'Вождь племени', desc: 'Создайте клан и наберите 10 участников', icon: '👑' },
  { id: 'a36', name: 'Дипломат', desc: 'Вступите в 3 клана', icon: '🤝' },
  { id: 'a37', name: 'Батл-рокстер', desc: 'Выиграйте 100 батлов подряд без поражений', icon: '🎸' },
  { id: 'a38', name: 'Миллионер кликов', desc: 'Сделайте 1,000,000 кликов', icon: '🖱️' },
  { id: 'a39', name: 'Генератор', desc: 'Накопите 100 миллиардов косаток', icon: '🏭' },
  { id: 'a40', name: 'Космический', desc: 'Достигните 50 уровня', icon: '🚀' }
];

// Эффекты (визуальные изменения + бонусы) - ВСЕ ТОЛЬКО ИЗ РЫБНЫХ БОКСОВ!
const effectsData = [
  { id: 'e1', name: 'Золотой клик', desc: 'Золотое свечение при клике', cost: 0, icon: '✨', bonus: { type: 'click', mult: 2 } },
  { id: 'e2', name: 'Неоновый свет', desc: 'Неоновое свечение', cost: 0, icon: '💡', bonus: { type: 'auto', mult: 1.5 } },
  { id: 'e3', name: 'Радужный след', desc: 'Радужный эффект при клике', cost: 0, icon: '🌈', bonus: { type: 'click', mult: 3 } },
  { id: 'e4', name: 'Частицы звёзд', desc: 'Звёздные частицы', cost: 0, icon: '⭐', bonus: { type: 'auto', mult: 2 } },
  { id: 'e5', name: 'Эффект волны', desc: 'Волновая анимация при клике', cost: 0, icon: '🌊', bonus: { type: 'click', mult: 5 } },
  { id: 'e6', name: 'Огненное сияние', desc: 'Огненное свечение при клике', cost: 0, icon: '🔥', bonus: { type: 'click', mult: 10 } },
  
  // ДОПОЛНИТЕЛЬНЫЕ ЭФФЕКТЫ - только из Рыбных боксов!
  { id: 'e7', name: 'Ледяной мороз', desc: 'Холодное голубое свечение', cost: 0, icon: '❄️', bonus: { type: 'auto', mult: 2.5 } },
  { id: 'e8', name: 'Темная материя', desc: 'Мрачный фиолетовый ореол', cost: 0, icon: '🌌', bonus: { type: 'click', mult: 8 } },
  { id: 'e9', name: 'Электрический шторм', desc: 'Молнии вокруг курсора', cost: 0, icon: '⚡', bonus: { type: 'click', mult: 6, type2: 'auto', mult2: 1.8 } },
  { id: 'e10', name: 'Призрачное сияние', desc: 'Мистический зелёный свет', cost: 0, icon: '👻', bonus: { type: 'auto', mult: 3 } }
];

// Расчет perClick (без навыков - только апгрейды из магазина)
function getPerClick() {
  const base = 1 + (game.basePerClick || 0);
  
  // Применяем множители эффектов только если они куплены И включены
  let mult = 1;
  if (game.effects && game.effects['e1'] && isEffectEnabled('e1')) mult *= 2;   // e1 - Золотой клик 2x
  if (game.effects && game.effects['e3'] && isEffectEnabled('e3')) mult *= 3;   // e3 - Радужный след 3x
  if (game.effects && game.effects['e5'] && isEffectEnabled('e5')) mult *= 5;   // e5 - Волновой эффект 5x
  if (game.effects && game.effects['e6'] && isEffectEnabled('e6')) mult *= 10;  // e6 - Огненное сияние 10x
  
  // Ограничение максимального множителя (макс 100x)
  mult = Math.min(mult, 100);
  
  // Защита от переполнения
  if (!Number.isFinite(base) || !Number.isFinite(mult)) {
    console.error('ERROR: Invalid base or mult in getPerClick!', { base, mult });
    return 1;
  }
  
  const result = base * mult;
  
  // Дополнительная защита
  if (!Number.isFinite(result) || result > 1e15) {
    console.error('CRITICAL: getPerClick result too large!', { base, mult, result, basePerClick: game.basePerClick, effects: game.effects });
    return Math.min(result, 1e15);
  }
  
  return result;
}

// Расчет perSecond (без навыков - только апгрейды из магазина)
function getPerSecond() {
  let base = (game.basePerSecond || 0);
  // Эффекты больше не дают бонусы - только визуальные
  let mult = 1;
  
  // Защита от переполнения
  if (!Number.isFinite(base) || !Number.isFinite(mult)) {
    console.error('ERROR: Invalid base or mult in getPerSecond!', { base, mult });
    return 0;
  }
  
  const result = base * mult;
  
  // Дополнительная защита
  if (!Number.isFinite(result) || result > 1e15) {
    console.error('CRITICAL: getPerSecond result too large!', { base, mult, result, basePerSecond: game.basePerSecond, effects: game.effects });
    return Math.min(result, 1e15);
  }
  
  // Лог для отладки
  // if (game.basePerSecond > 0 || result > 100) {
  //   console.log(`🔍 getPerSecond: base=${base}, mult=${mult}, result=${result}, effects=${JSON.stringify(game.effects)}`);
  // }
  return result;
}

// Проверка включен ли эффект
function isEffectEnabled(effectId) {
  return localStorage.getItem(`effect_${effectId}_enabled`) !== 'false';
}

// ==================== ПУТЬ К СЛАВЕ (Ранги) ====================
const RANKS = [
  { id: 'novice', name: 'Новичок', emoji: '🌱', minClicks: 0, reward: { coins: 100, type: 'coins' } },
  { id: 'apprentice', name: 'Ученик', emoji: '📚', minClicks: 5000, reward: { coins: 250, type: 'coins' } },
  { id: 'fighter', name: 'Боец', emoji: '⚔️', minClicks: 25000, reward: { coins: 500, type: 'coins' } },
  { id: 'veteran', name: 'Ветеран', emoji: '🛡️', minClicks: 100000, reward: { coins: 1000, type: 'coins' } },
  { id: 'expert', name: 'Эксперт', emoji: '💪', minClicks: 500000, reward: { coins: 2500, type: 'coins' } },
  { id: 'master', name: 'Мастер', emoji: '🏆', minClicks: 1000000, reward: { coins: 5000, type: 'coins' } },
  { id: 'grandmaster', name: 'Грандмастер', emoji: '⭐', minClicks: 5000000, reward: { coins: 10000, type: 'coins' } },
  { id: 'legend', name: 'Легенда', emoji: '👑', minClicks: 10000000, reward: { coins: 25000, type: 'coins' } },
  { id: 'mythic', name: 'Мифический', emoji: '🔥', minClicks: 50000000, reward: { coins: 50000, type: 'coins' } },
  { id: 'divine', name: 'Божественный', emoji: '✨', minClicks: 100000000, reward: { coins: 100000, type: 'coins' } }
];

// ==================== ЕЖЕДНЕВНАЯ СЕРИЯ ====================
const DAILY_REWARDS = [
  { day: 1, coins: 100, icon: '🎁' },
  { day: 2, coins: 150, icon: '🎁' },
  { day: 3, coins: 200, icon: '🎁' },
  { day: 4, coins: 250, icon: '🎁' },
  { day: 5, coins: 500, icon: '🎉' },
  { day: 6, coins: 750, icon: '🎉' },
  { day: 7, coins: 1500, icon: '👑' },
  { day: 14, coins: 3000, icon: '👑' },
  { day: 30, coins: 7500, icon: '💎' },
  { day: 60, coins: 15000, icon: '💎' },
  { day: 90, coins: 30000, icon: '💎' }
];

function getStreakReward(streak) {
  // Ищем награду для текущей серии
  let bestReward = DAILY_REWARDS[0];
  for (const reward of DAILY_REWARDS) {
    if (streak >= reward.day) {
      bestReward = reward;
    } else {
      break;
    }
  }
  return bestReward;
}

function getNextStreakReward(streak) {
  for (const reward of DAILY_REWARDS) {
    if (reward.day > streak) {
      return reward;
    }
  }
  return DAILY_REWARDS[DAILY_REWARDS.length - 1];
}

function checkDailyLogin() {
  const today = getCurrentDateString();
  const lastLogin = game.lastLoginDate;
  
  // Если уже заходил сегодня - ничего не делаем
  if (lastLogin === today) {
    return { isNewDay: false, reward: null, alreadyClaimed: true };
  }

  // Проверяем серию
  let newStreak = 1;
  let reward = DAILY_REWARDS[0];
  
  if (lastLogin) {
    const lastDate = new Date(lastLogin);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Продолжаем серию
      newStreak = (game.loginStreak || 0) + 1;
      reward = getStreakReward(newStreak);
    } else if (diffDays > 1) {
      // Серия прервана
      newStreak = 1;
      reward = DAILY_REWARDS[0];
    }
  }
  
  return { 
    isNewDay: true, 
    reward: reward,
    newStreak: newStreak,
    nextReward: getNextStreakReward(newStreak),
    alreadyClaimed: false
  };
}
  
function claimDailyReward(streak, reward) {
  const today = getCurrentDateString();
  
  // ПРОВЕРКА: уже получал награду сегодня?
  if (game.lastLoginDate === today) {
    console.warn('⚠️ Награда уже получена сегодня!');
    showNotification('⚠️ Награда уже получена сегодня. Заходите завтра!');
    return;
  }
  
  // Добавляем награду
  game.coins += reward.coins;
  game.lastLoginDate = today;
  game.loginStreak = streak;
  
  // Показываем награду
  showDailyRewardModal(reward, streak);
  
  // Сохраняем локально
  saveGame();
  
  // Отправляем на сервер
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ 
      type: 'claimDailyReward',
      streak: streak,
      coins: reward.coins
    }));
    console.log('📤 Отправлено на сервер: claimDailyReward streak=', streak);
  }
  
  // Обновляем UI
  updateDailyStreakUI();
}
  
function claimDailyStreak() {
  const loginCheck = checkDailyLogin();
  if (loginCheck.isNewDay && !loginCheck.alreadyClaimed) {
    claimDailyReward(loginCheck.newStreak, loginCheck.reward);
  }
}

function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connectionStatus');
  const dotEl = document.getElementById('connectionDot');
  const textEl = document.getElementById('connectionText');
  
  if (!statusEl || !textEl) return;
  
  if (status === 'connected') {
    statusEl.className = '';
    textEl.textContent = 'Подключено';
    if (dotEl) dotEl.style.animation = 'pulse 2s ease-in-out infinite';
  } else if (status === 'reconnecting') {
    statusEl.className = 'reconnecting';
    textEl.textContent = 'Переподключение...';
    if (dotEl) dotEl.style.animation = 'pulse 0.5s ease-in-out infinite';
  } else if (status === 'disconnected') {
    statusEl.className = 'disconnected';
    textEl.textContent = 'Нет подключения';
    if (dotEl) dotEl.style.animation = 'none';
  }
}

function updateDailyStreakUI() {
  const streakBtn = document.getElementById('dailyStreakBtn');
  const streakCount = document.getElementById('streakCount');
  const streakReward = document.getElementById('streakReward');
  
  if (!streakBtn || !streakCount || !streakReward) return;
  
  const today = getCurrentDateString();
  const hasClaimedToday = game.lastLoginDate === today;
  
  // Обновляем счётчик серии
  streakCount.textContent = game.loginStreak || 0;
  
  // Определяем текущую награду
  const currentReward = getStreakReward(game.loginStreak || 0);
  const nextReward = getNextStreakReward(game.loginStreak || 0);
  
  // Показываем следующую награду или текущую если ещё не получена
  if (hasClaimedToday) {
    streakReward.textContent = '+' + currentReward.coins;
    streakBtn.classList.add('claimed');
    streakBtn.disabled = true;
    streakBtn.querySelector('.streak-label').textContent = 'завтра';
  } else {
    streakReward.textContent = '+' + nextReward.coins;
    streakBtn.classList.remove('claimed');
    streakBtn.disabled = false;
    streakBtn.querySelector('.streak-label').textContent = 'дней';
  }
  
  console.log('📅 updateDailyStreakUI: lastLoginDate=', game.lastLoginDate, 'today=', today, 'hasClaimed=', hasClaimedToday);
}

function showDailyRewardModal(reward, streak) {
  // Уже получена сегодня - не показываем
  const today = getCurrentDateString();
  if (game.lastLoginDate === today) {
    console.warn('⚠️ Награда уже получена сегодня!');
    return;
  }

  // Удаляем старое модальное окно если есть
  const oldModal = document.querySelector('.daily-reward-modal');
  if (oldModal) oldModal.remove();
  
  // Если streak = 0, значит это первый вход - показываем как 1 день
  const displayStreak = streak || 1;
  
  const modal = document.createElement('div');
  modal.className = 'daily-reward-modal';
  modal.innerHTML = `
    <div class="daily-reward-overlay"></div>
    <div class="daily-reward-content">
      <div class="daily-reward-icon">${reward.icon || '🎁'}</div>
      <h2 class="daily-reward-title">Ежедневная награда!</h2>
      <div class="daily-reward-streak">
        <span class="streak-fire">🔥</span>
        <span class="streak-count">${displayStreak}</span>
        <span class="streak-days">дней подряд</span>
      </div>
      <div class="daily-reward-amount">
        +${formatNumber(reward.coins)} 🐋
      </div>
      ${getNextStreakReward(displayStreak).day > displayStreak ? `
        <div class="daily-reward-next">
          Следующая награда: <strong>${formatNumber(getNextStreakReward(displayStreak).coins)}</strong> 🐋
          <br>через <strong>${getNextStreakReward(displayStreak).day - displayStreak}</strong> дн.
        </div>
      ` : `
        <div class="daily-reward-next">
          🎉 Максимальная награда получена!
        </div>
      `}
      <button class="daily-reward-btn" onclick="claimAndCloseDailyReward(${reward.coins}, ${displayStreak})">Забрать</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Лог для отладки
  console.log(`📅 showDailyRewardModal: streak=${displayStreak}, reward=${reward.coins}, lastLoginDate=${game.lastLoginDate}`);
  
  // Небольшая задержка для анимации
  requestAnimationFrame(() => {
    modal.classList.add('show');
    playSound('bonusSound');
  });
}

// Обертка для начисления награды и закрытия модального окна
function claimAndCloseDailyReward(coins, streak) {
  // Начисляем награду
  const today = getCurrentDateString();
  
  console.log(`📅 claimAndCloseDailyReward: coins=${coins}, streak=${streak}, today=${today}, lastLoginDate=${game.lastLoginDate}`);
  
  // Двойная проверка чтобы не получить дважды
  if (game.lastLoginDate === today) {
    console.warn('⚠️ Награда уже получена!');
    const modal = document.querySelector('.daily-reward-modal');
    if (modal) modal.remove();
    return;
  }

  game.coins += coins;
  game.lastLoginDate = today;
  game.loginStreak = streak;
  
  console.log(`✅ После обновления: loginStreak=${game.loginStreak}, lastLoginDate=${game.lastLoginDate}`);
  
  // Сохраняем
  saveGame();
  
  // Отправляем на сервер
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'claimDailyReward',
      streak: streak,
      coins: coins
    }));
    console.log('📤 Отправлено на сервер: claimDailyReward');
  }
  
  // Обновляем UI
  updateDailyStreakUI();
  updateUI();
  
  // Закрываем модальное окно
  const modal = document.querySelector('.daily-reward-modal');
  if (modal) modal.remove();
  
  showNotification(`✅ Получено +${formatNumber(coins)} 🐋`);
}

// Экспорт в глобальную область видимости для onclick
window.claimAndCloseDailyReward = claimAndCloseDailyReward;
window.showDailyRewardModal = showDailyRewardModal;
window.getStreakReward = getStreakReward;
window.getNextStreakReward = getNextStreakReward;

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
let lastAutoClickTime = 0;
let autoClickIntervalCount = 0;

// Глобальный guestId для сохранения в localStorage
let guestId = null;

// Получаем или создаём guestId при загрузке страницы
try {
  const savedGuestId = localStorage.getItem('orca_guest_id');
  if (savedGuestId) {
    guestId = savedGuestId;
    console.log('👤 Восстановлен guestId из localStorage:', guestId);
  } else {
    guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('orca_guest_id', guestId);
    console.log('👤 Создан новый guestId:', guestId);
  }
} catch (e) {
  console.warn('⚠️ Ошибка работы с localStorage:', e);
  guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
}

// Буфер для кликов (отправляем пачками)
let clickBuffer = [];
let lastServerSync = Date.now();
const MAX_CLICKS_PER_SEC = 50; // Максимум 50 кликов в секунду для защиты от спама

// Глобальные переменные для обработчика клика
let lastClickTime = 0;
let clicksThisSecond = 0;

// КРИТИЧНО: флаг чтобы не перезаписывать прогресс от сервера после локальной загрузки
let dataLoadedFromStorage = false;
let serverDataTimestamp = 0;

// Убрали проверку dataLoadedFromStorage - всегда загружаем с сервера как источник истины

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

// Сохранение при закрытии вкладки (без диалога, чтобы работало на iOS)
let isSavingOnClose = false;

window.addEventListener('beforeunload', (e) => {
  // Только для авторизованных игроков
  if (typeof currentUser !== 'undefined' && currentUser && !isGuest && !isSavingOnClose) {
    isSavingOnClose = true;
    
    // Принудительное сохранение (неблокирующее)
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('💾 Автосохранение перед закрытием...');
      ws.send(JSON.stringify({ type: 'forceSaveAll' }));
      
      // Даем время на отправку (но не блокируем закрытие)
      setTimeout(() => {}, 1000);
    }
  }
  
  // УДАЛЕНИЕ гостевого аккаунта при закрытии
  if (typeof isGuest !== 'undefined' && isGuest && guestId && !isSavingOnClose) {
    isSavingOnClose = true;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('🗑️ Удаление гостевого аккаунта:', guestId);
      ws.send(JSON.stringify({
        type: 'deleteGuestAccount',
        playerId: guestId
      }));
    }
    
    // Очищаем guestId из localStorage
    try {
      localStorage.removeItem('orca_guest_id');
      console.log('✅ guestId удалён из localStorage');
    } catch (err) {
      console.warn('⚠️ Ошибка удаления guestId:', err);
    }
  }
  
  // Для некоторых браузеров нужно установить returnValue
  e.preventDefault();
  e.returnValue = '';
  return '';
});

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
    return 'ws://localhost:3003';
  }
  
  // Продакшен - используем WSS
  const guestId = localStorage.getItem('orca_guest_id') || 'guest_' + Math.random().toString(36).substr(2, 9);
  return `wss://косат.рф/?token=${encodeURIComponent(guestId)}`;
  //return `wss://orca-clicker-api.onrender.com/?token=${encodeURIComponent(guestId)}`;
  //return `ws://localhost:3003/?token=${encodeURIComponent(guestId)}`;
})();

// REST API базовый URL для Яндекс Игр
const REST_API_URL = 'https://косат.рф';

// Флаг: используем HTTP вместо WebSocket
const USE_HTTP_API = !WS_SERVER_URL;

async function wakeUpServer() {
    try {
        console.log('👉 Пробуждение сервера Render (попытка 1/3)...');
        const response = await fetch('https://orca-clicker-api.onrender.com/health', {
            method: 'GET',
            // mode: 'no-cors',
            cache: 'no-cache'
        });
        console.log('👋 Запрос отправлен, ждём 5 секунд для полной инициализации...');
        // Ждём 5 секунд чтобы сервер успеть полностью "проснуться"
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('✅ Сервер разбужен');
    } catch(e) {
        console.log('⚠️ Ошибка при пробуждении (попытка 1/3):', e.message);
        // Пробуем ещё 2 раза с задержкой
        for (let i = 2; i <= 3; i++) {
            console.log(`👉 Пробуждение сервера Render (попытка ${i}/3)...`);
            try {
                await fetch('https://orca-clicker-api.onrender.com/health', {
                    method: 'GET',
                    mode: 'no-cors',
                    cache: 'no-cache'
                });
                console.log('👋 Запрос отправлен, ждём 5 секунд...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                console.log('✅ Сервер разбужен');
                return;
            } catch(err) {
                console.log(`⚠️ Ошибка при пробуждении (попытка ${i}/3):`, err.message);
                if (i < 3) await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
}

function connectWebSocket() {
  // Очищаем старые интервалы перед подключением (защита от дублирования)
  cleanupIntervals();
  
  console.log('🔌 Подключение к WebSocket:', WS_SERVER_URL);
  console.log('📍 Hostname:', window.location.hostname);

  try {
    ws = new WebSocket(WS_SERVER_URL);
    window.ws = ws;
    console.log('🔹 WebSocket объект создан');
  } catch (error) {
    console.error('❌ Ошибка создания WebSocket:', error);
    console.warn('⚠️ Пробуем HTTP API как fallback...');
    showNotification('⚠️ WebSocket недоступен, используем оффлайн режим');
    return;
  }

  // Тайм-аут подключения - если за 5 секунд не подключилось, отключаемся
  const connectionTimeout = setTimeout(() => {
    if (ws && ws.readyState === WebSocket.CONNECTING) {
      console.warn('⚠️ WebSocket подключение заняло слишком долго, отключаемся...');
      ws.close();
      ws = null;
      window.ws = null;
      console.warn('⚠️ Используется оффлайн режим без синхронизации');
      showNotification('⚠️ Сервер недоступен, игра работает оффлайн');
    }
  }, 5000);
  
  ws.onopen = () => {
    clearTimeout(connectionTimeout);
    console.log('✅ WebSocket onopen сработал');
    console.log('✅ Подключено к серверу');
    console.log('🔍 guestId на момент onopen:', guestId);
    wsConnected = true;
    
    // Обновляем статус подключения
    updateConnectionStatus('connected');
    
    // Запускаем таймер ивента
    initEventTimer();
    
  // Отправляем данные для восстановления сессии или регистрации
  if (typeof window.currentUser !== 'undefined' && window.currentUser && !window.isGuest) {
    console.log('📤 Отправляем restoreSession:', window.currentUser);
    ws.send(JSON.stringify({ 
      type: 'restoreSession',
      accountId: window.currentUser.id,
      username: window.currentUser.username
    }));
  } else {
    // Гостевой режим - отправляем register с именем
    console.log('📤 Гостевой режим, отправляем register');
    ws.send(JSON.stringify({
      type: 'register',
      name: (typeof guestId !== 'undefined' && guestId) ? `Guest_${guestId}` : 'Guest'
    }));
  }
  
    ws.send(JSON.stringify({ type: 'getLeaderboard' }));
    ws.send(JSON.stringify({ type: 'getClans' }));
    ws.send(JSON.stringify({ type: 'getEventInfo' })); // Запрашиваем ивент сразу
    
    setTimeout(() => {
      if (game.clan && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getClanMembers' }));
      }
      if (document.getElementById('battleLobbyView')?.classList.contains('active')) {
        ws.send(JSON.stringify({ type: 'getBattleLobbies' }));
      }
    }, 500);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('📨 onmessage сработал:', data.type);
      handleServerMessage(data);
    } catch (e) {
      console.error('❌ Ошибка парсинга сообщения:', e);
    }
  };
  
  ws.onclose = (event) => {
    console.log('🔴 WebSocket onclose сработал:', event);
    console.log('⚠️ Отключено от сервера, переподключение через 3 секунды...');
    console.log('⚠️ Close code:', event.code, 'reason:', event.reason);
    wsConnected = false;
    
    // Обновляем статус подключения
    updateConnectionStatus('reconnecting');
    
    // Очищаем интервалы перед переподключением
    cleanupIntervals();
    
    // Обновляем UI лобби если открыто
    const container = document.getElementById('battleLobbyList');
    if (container && document.getElementById('battleLobbyView')?.classList.contains('active')) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:#ff6b6b">❌ Отключено от сервера. Переподключение...</p>';
    }
    
    // ПРОВЕРКА: если мы уже пытались 3 раза - прекращаем и переходим в оффлайн
    if (!window.wsRetryCount) window.wsRetryCount = 0;
    window.wsRetryCount++;
    
    if (window.wsRetryCount >= 3) {
      console.warn('⚠️ Превышено количество попыток подключения (3). Переход в постоянный оффлайн режим.');
      console.warn('⚠️ Яндекс Игры блокируют внешние WebSocket подключения.');
      updateConnectionStatus('disconnected');
      ws = null;
      window.ws = null;
      wsRetryCount = 0;
      showNotification('⚠️ Сервер недоступен (ограничение Яндекс Игр). Игра работает оффлайн.');
      return;
    }
    
    // Пробуем переподключиться через 3 секунды
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('❌ WebSocket onerror сработал:', error);
    console.error('❌ WebSocket error details:', error);
    wsConnected = false;
    
    // Обновляем статус подключения
    updateConnectionStatus('disconnected');
    
    // Если ошибка происходит при CONNECTING - пробуем HTTP fallback
    if (ws && ws.readyState === WebSocket.CONNECTING) {
      console.warn('⚠️ WebSocket не может подключиться, включаем оффлайн режим');
      ws = null;
      window.ws = null;
    }
  };
}

// Fallback на HTTP API если WebSocket не работает
async function httpApiCall(endpoint, data) {
  try {
    const response = await fetch(`${REST_API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error('❌ HTTP API error:', error);
    return null;
  }
}

function handleServerMessage(data) {
  // Печатаем ВСЕ сообщения для отладки
  console.log('📨 handleServerMessage получил:', data.type, data);
  
  // ОСОБАЯ обработка для registered (гости)
  if (data.type === 'registered') {
    console.log('🎯 registered получен! Обработка...');
  }
  
  // Обработка ответа на аутентификацию с аккаунтом (успех)
  if (data.type === 'authSuccess') {
    console.log(`✅ Аутентификация успешна: ${data.username}`);
    
    // СБРОС цен магазина к дефолтным перед загрузкой
    shopItems.forEach(item => {
      const catalogItem = SHOP_CATALOG?.find(i => i.id === item.id);
      if (catalogItem) {
        item.cost = catalogItem.baseCost;
      }
    });
    
    // Сохраняем информацию об аккаунте
    if (typeof currentUser === 'undefined' || !currentUser) {
      currentUser = { id: data.accountId, username: data.username };
    } else {
      currentUser.id = data.accountId;
      currentUser.username = data.username;
    }
    
    // Загружаем данные с сервера
    if (data.data) {
      const d = data.data;
      console.log(`📥 authSuccess data: coins=${d.coins}, totalCoins=${d.totalCoins}, type(coins)=${typeof d.coins}`);
      console.log(`📥 authSuccess data: clan=${d.clan}, type=${typeof d.clan}`);
      console.log(`📥 authSuccess data: level=${d.level}, perClick=${d.perClick}, perSecond=${d.perSecond}`);
      
      // Отладка проверки монет
      console.log(`📥 Проверка монет: Number.isFinite(d.coins)=${Number.isFinite(d.coins)}, d.coins>=0=${d.coins >= 0}`);
      
      game.coins = Number.isFinite(d.coins) && d.coins >= 0 ? d.coins : 0;
      game.totalCoins = Number.isFinite(d.totalCoins) && d.totalCoins >= 0 ? d.totalCoins : 0;
      
      console.log(`📥 После присваивания: game.coins=${game.coins}, game.totalCoins=${game.totalCoins}`);
      game.level = Number.isFinite(d.level) && d.level > 0 ? d.level : 1;
      game.basePerClick = Number.isFinite(d.basePerClick ?? d.perClick) ? (d.basePerClick ?? d.perClick) : 0;
      game.basePerSecond = Number.isFinite(d.basePerSecond ?? d.perSecond) ? (d.basePerSecond ?? d.perSecond) : 0;
      game.clicks = Number.isFinite(d.clicks) && d.clicks >= 0 ? d.clicks : 0;
      game.fish = Number.isFinite(d.fish) && d.fish >= 0 ? d.fish : 0;
      console.log(`📥 fish загружен: ${game.fish}`);
      game.effects = d.effects || {};
      game.achievements = d.achievements || [];
      game.skins = d.skins || { normal: true };
      game.currentSkin = d.currentSkin || 'normal';
      game.playTime = d.playTime || 0;
      
      // Загружаем данные ежедневной серии
      game.lastLoginDate = d.lastLoginDate || null;
      game.loginStreak = Number(d.loginStreak) || 0;
      
      // // Загружаем данные пути к славе (ранги)
      // game.totalRankClicks = Number(d.totalRankClicks) || Number(d.clicks) || 0;
      // game.currentRank = d.currentRank || 'novice';
      // if (d.rankRewardsClaimed) {
      //   game.rankRewardsClaimed = typeof d.rankRewardsClaimed === 'string' 
      //     ? JSON.parse(d.rankRewardsClaimed) 
      //     : d.rankRewardsClaimed;
      // } else {
      //   game.rankRewardsClaimed = [];
      // }
      
      // // Лог для отладки рангов
      // console.log(`🏆 Ранги загружены: totalClicks=${game.totalRankClicks}, currentRank=${game.currentRank}`);
      
      // // Проверяем доступные награды после загрузки
      // const availableRewards = checkRankRewards(game.totalRankClicks || 0);
      // if (availableRewards.length > 0) {
      //   console.log(`🎁 Доступны награды за ранги: ${availableRewards.length} шт.`);
      //   setTimeout(() => {
      //     showPathToGlory();
      //   }, 1000);
      // }
      
      // Проверяем ежедневный вход
      const dailyLogin = checkDailyLogin();
      if (dailyLogin.isNewDay && dailyLogin.reward) {
        console.log(`🎁 Новый день! Серия: ${dailyLogin.newStreak}, награда: ${dailyLogin.reward.coins}`);
        setTimeout(() => {
          showDailyRewardModal(dailyLogin.reward, dailyLogin.newStreak);
        }, 1500);
      }
      
// Загружаем данные для отслеживания кланов (для достижений)
      // Из skills._clanTracking загружаем историю вступлений и количество участников
      if (d.skills && d.skills._clanTracking) {
        game.skills = game.skills || {};
        game.skills._clanTracking = d.skills._clanTracking;
        console.log(`🏰 Загружен _clanTracking:`, d.skills._clanTracking);
        
        // Также загружаем clansJoinedHistory из _clanTracking в game.clansJoinedHistory
        if (d.skills._clanTracking.clansJoinedHistory && Array.isArray(d.skills._clanTracking.clansJoinedHistory)) {
          game.clansJoinedHistory = d.skills._clanTracking.clansJoinedHistory;
        }
        
        // Загружаем createdClanId если есть
        if (d.skills._clanTracking.createdClanId) {
          // Восстанавливаем данные созданного клана
        }
      } else if (d.skills && typeof d.skills === 'object') {
        // Если skills это объект - используем напрямую
        game.skills = d.skills;
        game.skills._clanTracking = game.skills._clanTracking || {};
      }
      
      // Также поддерживаем прямую загрузку clansJoinedHistory (для обратной совместимости)
      if (d.clansJoinedHistory && Array.isArray(d.clansJoinedHistory)) {
        // Если clansJoinedHistory пришёл напрямую - используем его
        game.clansJoinedHistory = d.clansJoinedHistory;
        // Синхронизируем в _clanTracking если ещё не установлено
        if (!game.skills._clanTracking) game.skills._clanTracking = {};
        if (!game.skills._clanTracking.clansJoinedHistory) {
          game.skills._clanTracking.clansJoinedHistory = [...d.clansJoinedHistory];
        }
      }
      
      // Если clansJoinedHistory всё ещё пустой - инициализируем пустым массивом
      if (!game.clansJoinedHistory || !Array.isArray(game.clansJoinedHistory)) {
        game.clansJoinedHistory = [];
      }
      
      // Также инициализируем ownedClanMemberCount если его нет
      if (d.ownedClanMemberCount !== undefined) {
        game.ownedClanMemberCount = d.ownedClanMemberCount;
      } else {
        game.ownedClanMemberCount = 0;
      }
      
      // Загружаем количество участников созданного клана
      if (d.ownedClanMemberCount !== undefined) {
        game.ownedClanMemberCount = d.ownedClanMemberCount;
      }
      
      // Лог для отладки
      console.log(`🏰 authSuccess - clansJoinedHistory:`, game.clansJoinedHistory);
      console.log(`🏰 authSuccess - skills._clanTracking:`, game.skills._clanTracking);
      // Обработка clan - может быть null, строкой (ID) или объектом
      if (d.clan) {
        if (typeof d.clan === 'string') {
          // Если это JSON строка - парсим
          try {
            const parsed = JSON.parse(d.clan);
            game.clan = typeof parsed === 'object' ? parsed.id || d.clan : d.clan;
          } catch (e) {
            // Если не JSON - это просто ID
            game.clan = d.clan;
          }
        } else if (typeof d.clan === 'object') {
          // Если это объект - берём ID
          game.clan = d.clan.id || d.clan;
        } else {
          game.clan = d.clan;
        }
      } else {
        game.clan = null;
      }
      console.log(`🏰 authSuccess: game.clan = ${game.clan}, type = ${typeof game.clan}`);
      game.multiplier = 1;
      game.updatedAt = data.data?.updatedAt || Date.now();
      
      if (d.pendingBoxes) {
        // Загружаем боксы - используем реальные ID из БД
        if (Array.isArray(d.pendingBoxes)) {
          pendingBoxes = d.pendingBoxes.filter(id => id && typeof id === 'string');
        } else {
          pendingBoxes = [];
        }
      }
      if (d.pendingFishBoxes) {
        // Загружаем рыбные боксы - если это массив ID, сохраняем как есть, иначе создаём заглушки
        if (Array.isArray(d.pendingFishBoxes)) {
          pendingFishBoxes = d.pendingFishBoxes.map(id => id || 'fishbox');
        } else {
          pendingFishBoxes = new Array(d.pendingFishBoxes).fill('fishbox');
        }
      }
      
      if (d.shopItems && Array.isArray(d.shopItems)) {
        d.shopItems.forEach(saved => {
          const item = shopItems.find(i => i.id === saved.id);
          if (item) {
            item.cost = saved.cost;
            console.log(`📦 shopItems загружены: ${item.id} = ${item.cost}`);
          }
        });
      }
      
      if (d.questProgress || d.dailyQuestIds) {
        initQuests({ progress: d.questProgress, dailyQuestDate: d.dailyQuestDate, dailyQuestIds: d.dailyQuestIds });
      } else {
        initQuests();
      }
      
      if (data.eventCoins) eventCoins = data.eventCoins;
      saveGame();
      updateClansUI();
    }
    
    playerId = data.accountId;
    wsConnected = true;
    
    // Устанавливаем текущего пользователя в auth-client
    if (typeof window.currentUser !== 'undefined') {
      window.currentUser = { id: data.accountId, username: data.username || 'Player' };
      window.isGuest = false;
      
      // Сохраняем в localStorage
      try {
        localStorage.setItem('orca_user', JSON.stringify(window.currentUser));
      } catch (e) {
        console.warn('⚠️ Ошибка сохранения аккаунта:', e);
      }
      
      if (typeof updateAccountDisplay === 'function') {
        updateAccountDisplay();
        console.log('✅ updateAccountDisplay вызван после authSuccess');
      }
      if (typeof closeAuthScreen === 'function') closeAuthScreen();
      showNotification(`✅ Добро пожаловать, ${window.currentUser.username}!`);
    }
    
    updateUI();
    renderShop();
    renderBoxes();
    applyEffects();
    updateEventUI();
    
    console.log('🔄 UI обновлён после authSuccess: updateUI, renderShop, renderBoxes, updateEventUI вызваны');
    
    // Запускаем таймер рыбалки
    setTimeout(() => {
      if (typeof startFishingTimer === 'function') {
        startFishingTimer();
        console.log('🎣 Таймер рыбалки запущен');
      }
    }, 1000);
    
    if (typeof updateAccountDisplay === 'function') updateAccountDisplay();
    if (typeof showGameScreen === 'function') showGameScreen();
    cleanupIntervals();
    setupAutoClickInterval();
    
    // Проверка ежедневного входа
    setTimeout(() => {
      const loginCheck = checkDailyLogin();
      if (loginCheck.isNewDay && !loginCheck.alreadyClaimed) {
        // Предлагаем получить награду
        console.log(`🎁 Доступна ежедневная награда! Серия: ${loginCheck.newStreak} дн., награда: ${loginCheck.reward.coins} 🐋`);
      }
      updateDailyStreakUI();
    }, 500);
    
    setTimeout(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getClans' }));
        ws.send(JSON.stringify({ type: 'getClanMembers' }));
        ws.send(JSON.stringify({ type: 'getBattleLobbies' }));
      }
    }, 500);
    
    return;
  }
  
  if (data.type === 'authError') {
    console.error('❌ Ошибка аутентификации:', data.message);
    if (typeof showAuthError === 'function') showAuthError(data.message);
    return;
  }

  // Обработка всех типов сообщений для отладки
  console.log('📨 Получено сообщение:', data.type, data);
  
  if (data.type === 'authSuccess') {
    // Успешная авторизация
    console.log('✅ Авторизация успешна:', data);
    window.currentUser = { id: data.accountId, username: data.username };
    window.isGuest = false;
    
    // Сохраняем в localStorage
    try {
      localStorage.setItem('orca_user', JSON.stringify(window.currentUser));
    } catch (e) {
      console.warn('⚠️ Ошибка сохранения аккаунта:', e);
    }
    
    if (typeof closeAuthScreen === 'function') closeAuthScreen();
    if (typeof showNotification === 'function') showNotification(`✅ Добро пожаловать, ${data.username}!`);
    if (typeof updateAccountDisplay === 'function') updateAccountDisplay();
    return;
  }
  
  if (data.type === 'authError') {
    console.error('❌ Ошибка аутентификации:', data.message);
    if (typeof showAuthError === 'function') showAuthError(data.message);
    return;
  }

  // Основной switch для обработки всех типов сообщений
  switch (data.type) {
    case 'connected':
      break;
    case 'registered':
      playerId = data.playerId;
      
      // Устанавливаем текущего пользователя при входе
      window.currentUser = { id: data.playerId, username: data.data?.username || 'Player' };
      window.isGuest = false;
      
      // Сохраняем в localStorage
      try {
        localStorage.setItem('orca_user', JSON.stringify(window.currentUser));
      } catch (e) {
        console.warn('⚠️ Ошибка сохранения аккаунта:', e);
      }
      
      if (typeof showNotification === 'function') showNotification(`✅ Добро пожаловать, ${window.currentUser.username}!`);
      if (typeof closeAuthScreen === 'function') closeAuthScreen();
      if (typeof updateAccountDisplay === 'function') updateAccountDisplay();
      
      if (data.data) {
        const oldCoins = game.coins;
        game.coins = Number.isFinite(data.data.coins) && data.data.coins >= 0 ? data.data.coins : 0;
        game.totalCoins = Number.isFinite(data.data.totalCoins) && data.data.totalCoins >= 0 ? data.data.totalCoins : 0;
        game.basePerClick = Number.isFinite(data.data.basePerClick ?? data.data.perClick) ? (data.data.basePerClick ?? data.data.perClick) : 0;
        game.basePerSecond = Number.isFinite(data.data.basePerSecond ?? data.data.perSecond) ? (data.data.basePerSecond ?? data.data.perSecond) : 0;
        game.clicks = Number.isFinite(data.data.clicks) && data.data.clicks >= 0 ? data.data.clicks : 0;
        game.level = Number.isFinite(data.data.level) && data.data.level > 0 ? data.data.level : 1;
        game.fish = Number.isFinite(data.data.fish) && data.data.fish >= 0 ? data.data.fish : 0;
        game.effects = data.data.effects || {};
        game.achievements = data.data.achievements || [];
        game.skins = data.data.skins || { normal: true };
        game.currentSkin = data.data.currentSkin || 'normal';
        game.playTime = data.data.playTime || 0;
        // Обработка клана для гостей
        game.clan = data.data.clan || null;
        if (data.data?.questProgress || data.data?.dailyQuestIds) {
          initQuests({ progress: data.data.questProgress, dailyQuestDate: data.data.dailyQuestDate, dailyQuestIds: data.data.dailyQuestIds });
        } else {
          initQuests();
        }
        if (data.data?.pendingBoxes) {
          if (Array.isArray(data.data.pendingBoxes)) {
            pendingBoxes = data.data.pendingBoxes.filter(id => id && typeof id === 'string');
} else {
  pendingBoxes = [];
}
        }
        if (data.data?.pendingFishBoxes) {
          if (Array.isArray(data.data.pendingFishBoxes)) {
            pendingFishBoxes = data.data.pendingFishBoxes.map(id => id || 'fishbox');
          } else {
            pendingFishBoxes = new Array(data.data.pendingFishBoxes).fill('fishbox');
          }
        }
        eventCoins = data.eventCoins || 0;
  
        // Загружаем данные ежедневной серии
        game.lastLoginDate = data.data.lastLoginDate || null;
        game.loginStreak = Number(data.data.loginStreak) || 0;
        
        if (game.coins > oldCoins + 1000) {
          showNotification(`💰 Награда ивента: +${formatNumber(game.coins - oldCoins)}!`);
          playSound('bonusSound');
        }
        game.updatedAt = data.data?.updatedAt || Date.now();
        saveGame();
        updateUI();
        renderShop();
        renderBoxes();
        applyEffects();
        
        // Проверка ежедневного входа для гостей
        setTimeout(() => {
          updateDailyStreakUI();
        }, 500);
        
        // Если игрок в клане - запрашиваем информацию о клане
        if (game.clan && ws?.readyState === WebSocket.OPEN) {
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'getClans' }));
            ws.send(JSON.stringify({ type: 'getClanMembers' }));
          }, 300);
        }
      }
      break;
    case 'eventInfo':
      eventInfo = data.event;
      eventCoins = data.event.eventCoins || 0;
      
      // Сохраняем endTime ивента в localStorage
      if (eventInfo && eventInfo.endDate) {
        window.eventEndTime = eventInfo.endDate;
        localStorage.setItem('orca_event_endTime', eventInfo.endDate);
        console.log('🎉 Ивент сохранён, конец:', new Date(eventInfo.endDate));
      }
      
      updateEventUI();
      renderEventLeaderboard();
      
      // Показать виджет ивента
      const eventWidget = document.getElementById('eventWidget');
      if (eventWidget && eventInfo) {
        eventWidget.classList.remove('hidden');
      }
      break;
    case 'leaderboard':
      updateLeaderboardUI(data.data);
      break;
    case 'clans':
      clansList = data.data || [];
      if (typeof game.clan !== 'undefined') updateClansUI();
      break;
    case 'clanMembers':
      if (data.clanId && !game.clan) {
        game.clan = data.clanId;
        saveGame();
      }
      if (window.updateClanMembersUI) window.updateClanMembersUI(data.members);
      updateClansUI();
      break;
    case 'clanCreated':
      showNotification(`🏰 Клан "${data.name}" создан!`);
      game.clan = data.clanId;
      saveGame();
      updateClansUI();
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'getClans' }));
          ws.send(JSON.stringify({ type: 'getClanMembers' }));
        }
      }, 200);
      break;
    case 'joinedClan':
      showNotification(`👥 Вы вступили в клан "${data.name}"!`);
      game.clan = data.clanId;
      saveGame();
      updateClansUI();
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'getClans' }));
          ws.send(JSON.stringify({ type: 'getClanMembers' }));
        }
      }, 200);
      break;
    case 'leftClan':
      showNotification('🚪 Вы вышли из клана');
      game.clan = null;
      saveGame();
      updateClansUI();
      break;
    case 'clanDeleted':
      showNotification('🗑️ Клан удалён');
      game.clan = null;
      saveGame();
      updateClansUI();
      break;
    case 'registered':
      console.log('✅ case registered сработал!');
      console.log('📊 Данные registered:', data);
      // Гость зарегистрирован
      // КРИТИЧНО: всегда загружаем данные с сервера (сервер - источник истины)
      
      // Устанавливаем текущего пользователя
      window.currentUser = { id: data.playerId, username: data.username || 'Player' };
      window.isGuest = false;
      
      // Сохраняем в localStorage
      try {
        localStorage.setItem('orca_user', JSON.stringify(window.currentUser));
      } catch (e) {
        console.warn('⚠️ Ошибка сохранения аккаунта:', e);
      }
      
      if (typeof showNotification === 'function') showNotification(`✅ Аккаунт создан! Добро пожаловать, ${data.username || 'Player'}!`);
      if (typeof closeAuthScreen === 'function') closeAuthScreen();
      if (typeof updateAccountDisplay === 'function') updateAccountDisplay();
      
      // Конец новой обработки
      
      playerId = data.playerId;
      if (data.data) {
        const oldCoins = game.coins;
        game.coins = Number.isFinite(data.data.coins) && data.data.coins >= 0 ? data.data.coins : 0;
        game.totalCoins = Number.isFinite(data.data.totalCoins) && data.data.totalCoins >= 0 ? data.data.totalCoins : 0;
        const guestBasePerClick = data.data.basePerClick ?? data.data.perClick;
        const guestBasePerSecond = data.data.basePerSecond ?? data.data.perSecond;
        game.basePerClick = Number.isFinite(guestBasePerClick) && guestBasePerClick >= 0 ? guestBasePerClick : 0;
        game.basePerSecond = Number.isFinite(guestBasePerSecond) && guestBasePerSecond >= 0 ? guestBasePerSecond : 0;
        if (!Number.isFinite(game.basePerSecond) || game.basePerSecond < 0) {
          console.warn(`WARNING: Invalid basePerSecond (guest): ${game.basePerSecond}, using 0`);
          game.basePerSecond = 0;
        }
        if (!Number.isFinite(game.basePerClick) || game.basePerClick < 0) {
          console.warn(`WARNING: Invalid basePerClick (guest): ${game.basePerClick}, using 0`);
          game.basePerClick = 0;
        }
        game.clicks = Number.isFinite(data.data.clicks) && data.data.clicks >= 0 ? data.data.clicks : 0;
        game.level = Number.isFinite(data.data.level) && data.data.level > 0 ? data.data.level : 1;
        game.fish = Number.isFinite(data.data.fish) && data.data.fish >= 0 ? data.data.fish : 0;
        game.effects = data.data.effects || {};
        game.achievements = data.data.achievements || [];
        game.skins = data.data.skins || { normal: true };
        game.currentSkin = data.data.currentSkin || 'normal';
        game.playTime = data.data.playTime || 0;
        // Обработка клана для гостей
        game.clan = data.data.clan || null;
        
        // Обновляем UI кланов
        updateClansUI();
        
        if (data.data?.questProgress || data.data?.dailyQuestIds) {
          initQuests({
            progress: data.data.questProgress,
            dailyQuestDate: data.data.dailyQuestDate,
            dailyQuestIds: data.data.dailyQuestIds
          });
        } else {
          initQuests();
        }
        if (data.data?.pendingBoxes) {
          if (Array.isArray(data.data.pendingBoxes)) {
            pendingBoxes = data.data.pendingBoxes.filter(id => id && typeof id === 'string');
} else {
  pendingBoxes = [];
}
        }
        if (data.data?.pendingFishBoxes) {
          if (Array.isArray(data.data.pendingFishBoxes)) {
            pendingFishBoxes = data.data.pendingFishBoxes.map(id => id || 'fishbox');
          } else {
            pendingFishBoxes = new Array(data.data.pendingFishBoxes).fill('fishbox');
          }
        }
        eventCoins = data.eventCoins || 0;
        
        // Загружаем данные ежедневной серии
        game.lastLoginDate = data.data.lastLoginDate || null;
        game.loginStreak = Number(data.data.loginStreak) || 0;
        
        if (game.coins > oldCoins + 1000) {
          showNotification(`💰 Награда ивента: +${formatNumber(game.coins - oldCoins)}!`);
          playSound('bonusSound');
        }
        
        game.updatedAt = data.data?.updatedAt || Date.now();
        saveGame();
        
        updateUI();
        renderShop();
        renderBoxes();
        applyEffects();
        updateEventUI();
        
        console.log('🔄 UI обновлён после registered (guest): updateUI, renderShop, renderBoxes, updateEventUI вызваны');
        
        // Проверка ежедневного входа для зарегистрированного гостя
        setTimeout(() => {
          updateDailyStreakUI();
        }, 500);
        
        // Если игрок в клане - запрашиваем информацию о клане
        if (game.clan && ws?.readyState === WebSocket.OPEN) {
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'getClans' }));
            ws.send(JSON.stringify({ type: 'getClanMembers' }));
          }, 300);
        }
      } else {
        console.log('⚠️ Нет данных с сервера для гостя');
      }
      break;
    case 'eventInfo':
      eventInfo = data.event;
      eventCoins = data.event.eventCoins || 0;
      // console.log(`🎫 eventInfo получено: eventCoins=${eventCoins}, topPlayers=${eventInfo.topPlayers?.length || 0}`);
      
      console.log('📅 eventInfo:', data.event);
      console.log('📅 eventInfo.endDate:', eventInfo.endDate);
      console.log('📅 Date.now():', Date.now());
      console.log('📅 Разница в днях:', Math.ceil((eventInfo.endDate - Date.now()) / (1000 * 60 * 60 * 24)));
      
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
      console.log(`📊 Получены кланы: ${data.data?.length || 0} шт.`, data.data);
      clansList = data.data || [];
      // Всегда обновляем UI когда приходят данные о кланах
      updateClansUI();
      break;
    case 'clanMembers':
      console.log(`👥 Получены участники клана: ${data.members?.length || 0} шт.`, data);
      
      // НЕ устанавливаем game.clan если игрок уже не в клане (например после выхода)
      // Если clanId в сообщении НЕ совпадает с game.clan - игрок вышел из этого клана
      const myClanId = game.clan ? (typeof game.clan === 'object' ? game.clan.id : String(game.clan)) : null;
      const msgClanId = data.clanId ? String(data.clanId) : null;
      
      // Только синхронизируем если clanId совпадает с моим текущим кланом
      if (msgClanId && msgClanId === myClanId) {
        console.log(`🏰 Синхронизирую участников клана: ${msgClanId}`);
        if (window.updateClanMembersUI) window.updateClanMembersUI(data.members);
      } else if (msgClanId && !myClanId) {
        // Если game.clan не установлен, но пришёл clanId - устанавливаем
        console.log(`🏰 Устанавливаю game.clan из clanMembers: ${msgClanId}`);
        game.clan = msgClanId;
        saveGame();
        if (window.updateClanMembersUI) window.updateClanMembersUI(data.members);
      } else {
        console.log(`⚠️ clanMembers для другого клана: msgClanId=${msgClanId}, myClanId=${myClanId}`);
      }
      
      // Всегда обновляем список кланов
      updateClansUI();
      break;
    case 'battleLobbies':
      // Кэшируем лобби для поиска по коду
      localStorage.setItem('battleLobbiesCache', JSON.stringify(data.lobbies || []));
      updateBattleLobbiesUI(data.lobbies);
      break;
    case 'rankRewardClaimed':
      showNotification(`✅ Награда получена: +${formatNumber(data.coins)} 🐋`);
      playSound('bonusSound');
      updateUI();
      renderShop();
      break;
    case 'dailyRewardClaimed':
      console.log(`🎁 dailyRewardClaimed получено:`, data);
      showNotification(`✅ Ежедневная награда получена: +${data.coins} 🐋`);
      
      // Обновляем UI серии
      updateDailyStreakUI();
      
      console.log('✅ dailyRewardClaimed обработка завершена');
      break;
case 'lobbyCreated':
      // Показываем код лобби если оно закрыто
      const lobbyMsg = data.lobbyCode 
        ? `🏠 Лобби создано! Код: ${data.lobbyCode}` 
        : '🏠 Лобби создано! Ожидание соперника...';
      showNotification(lobbyMsg);
      // Обновляем UI моего лобби
      updateMyLobbyUI({
        id: data.lobbyId,
        ownerName: data.ownerName,
        hasOpponent: false,
        opponentName: null,
        lobbyCode: data.lobbyCode || null,
        isOpen: data.isOpen
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
      console.log(`🏰 Клан создан: ${data.clanId}, name: ${data.name}`);
      game.clan = data.clanId;
      // Отслеживание для достижений
      game.skills = game.skills || {};
      game.skills._clanTracking = game.skills._clanTracking || {};
      game.skills._clanTracking.createdClanId = data.clanId;
      // НЕ добавляем созданный клан в clansJoinedHistory - это не "вступление"!
      // Достижение "Дипломат" считается только по вступлению в чужие кланы
      saveGame();
      updateClansUI();
      // Обновляем список кланов
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'getClans' }));
        }
      }, 200);
      break;
case 'joinedClan':
      showNotification(`👥 Вы вступили в клан "${data.name}"!`);
      console.log(`👥 Вступил в клан: ${data.clanId}, name: ${data.name}`);
      game.clan = data.clanId;
      // Отслеживание для достижений (добавляем в историю если новый клан)
      if (!game.clansJoinedHistory.includes(data.clanId)) {
        game.clansJoinedHistory.push(data.clanId);
      }
      game.skills = game.skills || {};
      game.skills._clanTracking = game.skills._clanTracking || {};
      if (!game.skills._clanTracking.clansJoinedHistory?.includes(data.clanId)) {
        game.skills._clanTracking.clansJoinedHistory = game.skills._clanTracking.clansJoinedHistory || [];
        game.skills._clanTracking.clansJoinedHistory.push(data.clanId);
      }
      saveGame();
      updateClansUI();
      // Обновляем список кланов
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'getClans' }));
        }
      }, 200);
      break;
    case 'leftClan':
      showNotification('🚪 Вы вышли из клана');
      game.clan = null;
      saveGame();
      updateClansUI();  // Обновляем UI сразу
      
      // Сбрасываем tracking если вышли из созданного клана
      if (game.skills?._clanTracking?.createdClanId) {
        game.skills._clanTracking.createdClanId = null;
        saveGame();
      }
      
      // Обновляем список кланов
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'getClans' }));
          // НЕ запрашиваем clanMembers после выхода!
        }
      }, 200);
      break;
    case 'clanDeleted':
      showNotification('🗑️ Клан удалён');
      game.clan = null;
      saveGame();
      updateClansUI();  // Обновляем UI сразу
      
      // Сбрасываем tracking если клан удалён
      if (game.skills?._clanTracking?.createdClanId) {
        game.skills._clanTracking.createdClanId = null;
        saveGame();
      }
      
      // Обновляем список кланов
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'getClans' }));
        }
      }, 200);
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
      console.log(`📦 Сервер подтвердил покупку бокса:`, data);
      if (data.boxId) {
        pendingBoxes.push(data.boxId);
        console.log(`📦 Добавлен бокс ${data.boxId}, всего боксов: ${pendingBoxes.length}`);
      }
      if (data.coins !== undefined) {
        if (Number.isFinite(data.coins) && data.coins >= 0) {
          game.coins = data.coins;
          console.log(`💰 Обновлен баланс: ${game.coins}`);
        } else {
          console.warn(`WARNING: Invalid coins from server: ${data.coins}`);
        }
      }
      updateUI();
      updateBoxUI();
      renderBoxes();
      saveGame();
      break;
    case 'fishBoxBought':
      // Сервер подтвердил покупку Рыбного бокса
      if (data.boxId) {
        pendingFishBoxes.push(data.boxId);
      }
      if (data.coins !== undefined) {
        if (Number.isFinite(data.coins) && data.coins >= 0) {
          game.coins = data.coins;
        } else {
          console.warn(`WARNING: Invalid coins from server: ${data.coins}`);
        }
      }
      if (data.pendingFishBoxes !== undefined) {
        pendingFishBoxes = new Array(data.pendingFishBoxes).fill(null).map((_, i) => `fishbox_${i}`);
      }
      updateUI();
      updateFishBoxUI();
      renderBoxes();
      saveGame();
      break;
    case 'boxOpened':
      console.log(`🎁 Catdrop открыт на сервере:`, data);
      console.log(`🎁 isOpeningBox = ${isOpeningBox}, catdropRarity = ${catdropRarity}`);
      
      // Если запущена Catdrop анимация - используем новый обработчик
      if (isOpeningBox) {
        // Сохраняем награду от сервера
        dataRewardFromServer = data.reward;
        
        // Устанавливаем редкость для анимации
        catdropRarity = data.reward?.rarity || 'common';
        
        // Обновляем количество боксов с сервера
        if (data.pendingBoxes !== undefined) {
          const newBoxCount = data.pendingBoxes;
          if (newBoxCount < pendingBoxes.length) {
            pendingBoxes.splice(0, 1);
          }
        }
        
        // Если Cutscene нет - создаём
        if (!activeBoxCutscene) {
          console.log('🎁 Создаю waiting screen...');
          showCatdropWaitingScreen();
        }
        
        // ПОСЛЕ установки редкости - обновляем Catdrop (убираем серый цвет)
        setTimeout(() => {
          const catdropEl = document.getElementById('catdropElement');
          if (catdropEl) {
            catdropEl.style.opacity = '1';
            catdropEl.style.filter = 'none';
            catdropEl.style.pointerEvents = 'auto';  // Разрешаем клики
            console.log(`✅ Catdrop разблокирован, редкость: ${catdropRarity}`);
          }
          
          // Добавляем SVG если нет
          const existingSvg = catdropEl?.querySelector('.catdrop-svg');
          if (!existingSvg && catdropEl) {
            const svgHTML = `
              <svg viewBox="0 0 200 200" class="catdrop-svg">
                <circle class="catdrop-progress-ring" cx="100" cy="100" r="90" 
                  stroke="rgba(255,215,0,0.5)" stroke-width="6" fill="transparent"
                  stroke-dasharray="565.48" stroke-dashoffset="565.48"
                  style="transition: stroke-dashoffset 0.1s linear"/>
                <circle class="catdrop-progress-ring-bg" cx="100" cy="100" r="90" 
                  stroke="rgba(255,255,255,0.1)" stroke-width="6" fill="transparent"/>
              </svg>
            `;
            const img = catdropEl.querySelector('img');
            if (img) img.insertAdjacentHTML('beforebegin', svgHTML);
          }
          
          const hint = document.querySelector('.catdrop-hint');
          if (hint) hint.textContent = 'Зажми чтобы открыть!';
        }, 50);
        
        // Тайм-аут отключаем - ждём когда пользователь зажимает
        if (currentBoxOpenTimeout) {
          clearTimeout(currentBoxOpenTimeout);
          currentBoxOpenTimeout = null;
          console.log('✅ Тайм-аут отключён, ждём зажатия');
        }
        
        console.log(`✅ Catdrop готов к открытию, редкость: ${catdropRarity}`);
        // Награда будет показана когда пользователь додержит до конца в catdropAnimationLoop
      } else {
        // Старый способ обработки (без анимации) или ошибка
        console.warn('⚠️ boxOpened получен, но isOpeningBox=false!');
        if (currentBoxOpenTimeout) {
          clearTimeout(currentBoxOpenTimeout);
          currentBoxOpenTimeout = null;
        }
        removeActiveCutscene('box');
        isOpeningBox = false;
        
        if (data.reward) {
          showBoxReward(data.reward);
          if (data.reward.type === 'skin') {
            game.skins[data.reward.skinId] = true;
          } else if (Number.isFinite(data.reward.amount) && data.reward.amount >= 0) {
            game.coins += data.reward.amount;
            game.totalCoins += data.reward.amount;
          }
        }
        
        if (data.pendingBoxes !== undefined) {
          const newBoxCount = data.pendingBoxes;
          if (newBoxCount < pendingBoxes.length) {
            pendingBoxes.splice(0, 1);
          }
        }
        updateUI();
        updateBoxUI();
        renderBoxes();
        saveGame();
      }
      break;
    case 'fishBoxOpened':
      if (currentFishBoxOpenTimeout) {
        clearTimeout(currentFishBoxOpenTimeout);
        currentFishBoxOpenTimeout = null;
      }
      removeActiveCutscene('fish');
      isOpeningFishBox = false;
      showFishBoxReward(data.reward);
      if (data.reward.type === 'visualEffect' && data.reward.effectId) {
        // Получаем визуальный эффект НАВСЕГДА
        if (!game.effects) game.effects = {};
        game.effects[data.reward.effectId] = true;
        showNotification(`✨ Получен эффект: ${data.reward.effectName}!`);
        applyEffects();
      } else if (data.reward.type === 'tempBuff' && data.reward.mult) {
        // Получаем временный бафф
        activateTemporaryMultiplier(data.reward.mult, data.reward.duration);
      }
      if (data.pendingFishBoxes !== undefined) {
        // Обновляем количество рыбных боксов, сохраняя массив пустым (ID не нужны)
        pendingFishBoxes = new Array(data.pendingFishBoxes).fill('fishbox');
      }
      updateUI();
      updateFishBoxUI();
      renderBoxes();
      saveGame();
      break;
    case 'itemBought':
      // Сервер подтвердил покупку предмета
      console.log('🛒 itemBought получено:', data);
      
      if (data.coins !== undefined) {
        if (Number.isFinite(data.coins) && data.coins >= 0) {
          game.coins = data.coins;
          console.log('💰 game.coins обновлён:', data.coins);
        } else {
          console.warn(`WARNING: Invalid coins from server: ${data.coins}`);
        }
      }
      if (data.perClick !== undefined) {
        if (Number.isFinite(data.perClick) && data.perClick >= 0) {
          game.basePerClick = data.perClick;
          console.log('👆 game.basePerClick обновлён:', data.perClick);
        } else {
          console.warn(`WARNING: Invalid perClick from server: ${data.perClick}`);
        }
      }
      if (data.perSecond !== undefined) {
        if (Number.isFinite(data.perSecond) && data.perSecond >= 0) {
          game.basePerSecond = data.perSecond;
          console.log('⚡ game.basePerSecond обновлён:', data.perSecond);
        } else {
          console.warn(`WARNING: Invalid perSecond from server: ${data.perSecond}`);
        }
      }
      if (data.itemCost !== undefined) {
        const item = shopItems.find(i => i.id === data.itemId);
        if (item) {
          item.cost = data.itemCost;
          console.log('🏷️ Цена товара обновлена:', item.id, '=', data.itemCost);
        }
      }
      showNotification(`✅ Куплено: ${data.itemName}`);
      playSound('buySound');
      
      console.log('🔄 Вызываю renderShop() и updateUI()');
      renderShop();
      updateUI();
      saveGame();
      
      console.log('✅ itemBought обработка завершена');
      break;
    case 'skinEquipped':
      // Сервер подтвердил выбор скина
      console.log('🎨 skinEquipped получено:', data);
      if (data.skinId) {
        game.currentSkin = data.skinId;
        console.log('🖼️ game.currentSkin обновлён:', data.skinId);
      }
      showNotification(`🎨 Скин "${skinsData.find(s => s.id === data.skinId)?.name || data.skinId}" выбран!`);
      
      console.log('🔄 Вызываю renderSkins() и updateUI()');
      renderSkins();
      updateUI();
      saveGame();
      
      console.log('✅ skinEquipped обработка завершена');
      break;
    case 'autoclickerBlocked':
      showNotification(`🚫 ${data.message || 'Доступ заблокирован'}`);
      try {
        document.getElementById('clicker')?.classList.add('locked');
      } catch (_) {}
      break;
    // 3x3 Рейдовые битвы
    case 'raidLobbyCreated':
      showNotification(`🎮 Рейдовое лобби создано! Код: ${data.lobbyCode}`);
      // Сохраняем текущее лобби
      if (data.lobby && data.lobby.team) {
        currentRaidLobby = data.lobby;
        showRaidTeamUI(data.lobby);
      }
      renderRaidLobbies();
      break;
    case 'joinedRaidLobby':
      showNotification('👥 Вы присоединились к рейду!');
      // Сохраняем текущее лобби - приоритет у lobby.team если есть
      if (data.lobby && data.lobby.team) {
        currentRaidLobby = data.lobby;
        showRaidTeamUI(data.lobby);
      } else if (data.team) {
        // Фоллбек если lobby нет
        currentRaidLobby = { lobbyId: data.lobbyId, team: data.team, teamSize: data.teamSize };
        showRaidTeamUI(currentRaidLobby);
      } else {
        renderRaidLobbies();
      }
      break;
    case 'playerJoinedRaidLobby':
      showNotification(`👤 ${data.playerName} присоединился к команде!`);
      // Обновляем команду - приоритет у team из данных
      if (data.team && Array.isArray(data.team)) {
        if (!currentRaidLobby) currentRaidLobby = {};
        currentRaidLobby.lobbyId = data.lobbyId;
        currentRaidLobby.team = data.team;
        currentRaidLobby.teamSize = data.team.length;
        renderRaidTeam();
      } else if (data.lobby && data.lobby.team) {
        currentRaidLobby = data.lobby;
        renderRaidTeam();
      }
      break;
    case 'raidRoleSelected':
      showNotification(`🎭 Роль выбрана: ${data.roleData?.emoji || '❓'} ${data.roleData?.name || data.role || 'Неизвестно'}`);
      // Обновляем команду - приоритет у team из данных
      if (data.team && Array.isArray(data.team)) {
        if (!currentRaidLobby) currentRaidLobby = {};
        currentRaidLobby.lobbyId = data.lobbyId;
        currentRaidLobby.team = data.team;
        currentRaidLobby.teamSize = data.team.length;
        renderRaidTeam();
      } else if (data.lobby && data.lobby.team) {
        currentRaidLobby = data.lobby;
        renderRaidTeam();
      }
      break;
    case 'raidBattleSearching':
      showNotification('🔍 ' + (data.message || 'Поиск соперника...'));
      // Оставляем окно рейда открытым
      break;
    case 'raidBattleStart':
      showRaidBattleUI(data);
      break;
    case 'raidBattleUpdate':
      updateRaidBattleUI(data);
      break;
    case 'raidBattleEvent':
      showRaidEvent(data.event);
      break;
    case 'raidBattleEnd':
      endRaidBattle(data);
      break;
    case 'raidTeamStatus':
      updateRaidTeamStatus(data);
      break;
    case 'raidLobbies':
      raidLobbiesList = data.lobbies || [];
      renderRaidLobbies();
      break;
    case 'forceSaveCompleted':
      if (window.handleForceSaveResponse) {
        window.handleForceSaveResponse(data);
      }
      break;
    case 'timersLoaded':
      // Сервер прислал сохранённые таймеры
      console.log('⏱️ Таймеры загружены с сервера:', data);
      if (data.eventEndTime !== undefined) {
        window.eventEndTime = data.eventEndTime;
        localStorage.setItem('orca_event_endTime', data.eventEndTime);
      }
      if (data.adLastView !== undefined) {
        window.adLastView = data.adLastView;
        localStorage.setItem('orca_ad_lastView', data.adLastView);
      }
      if (data.adViewCount !== undefined) {
        window.adViewCount = data.adViewCount;
        localStorage.setItem('orca_ad_viewCount', data.adViewCount);
      }
      if (data.lastLoginDate !== undefined) {
        game.lastLoginDate = data.lastLoginDate;
        localStorage.setItem('orca_dailyLoginDate', data.lastLoginDate);
      }
      if (data.loginStreak !== undefined) {
        game.loginStreak = data.loginStreak;
        localStorage.setItem('orca_loginStreak', data.loginStreak);
      }
      // Обновляем UI ежедневной награды после загрузки таймеров
      if (typeof updateDailyStreakUI === 'function') {
        updateDailyStreakUI();
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

// ==================== 3x3 РЕЙДОВЫЕ БИТВЫ ====================
let currentRaidBattle = null;
let raidLobbiesList = [];
let currentRaidLobby = null;
  
function hideAllViews() {
  // Закрываем все модальные окна
  closeAllModals();
  
  // Скрываем рейдовые виды
  const raidView = document.getElementById('raidView');
  const raidBattleView = document.getElementById('raidBattleView');
  
  if (raidView) raidView.classList.remove('active');
  if (raidBattleView) raidBattleView.classList.remove('active');
}

function showRaidView() {
  // Скрываем все виды
  hideAllViews();
  
  // Показываем вид рейда
  const raidView = document.getElementById('raidView');
  if (raidView) {
    raidView.classList.add('active');
  }
  
  // Показываем экран создания команды
  const createButtons = document.getElementById('raidCreateButtons');
  const lobbyList = document.getElementById('raidLobbyList');
  const teamPanel = document.getElementById('raidTeamPanel');
  
  if (createButtons) createButtons.style.display = 'block';
  if (lobbyList) lobbyList.style.display = 'none';
  if (teamPanel) teamPanel.style.display = 'none';
  
  console.log('🎮 Открыт экран рейда');
}
  
function showRaidPublicLobbies() {
  const createButtons = document.getElementById('raidCreateButtons');
  const lobbyList = document.getElementById('raidLobbyList');
  const container = document.getElementById('raidLobbiesContainer');
  
  if (createButtons) createButtons.style.display = 'none';
  if (lobbyList) lobbyList.style.display = 'block';
  
  // Запрашиваем список лобби
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'getRaidLobbies' }));
  } else {
    container.innerHTML = '<p style="text-align:center;padding:20px;color:#888">Подключение...</p>';
  }
}

function hideRaidLobbies() {
  const createButtons = document.getElementById('raidCreateButtons');
  const lobbyList = document.getElementById('raidLobbyList');
  
  if (createButtons) createButtons.style.display = 'block';
  if (lobbyList) lobbyList.style.display = 'none';
}

function renderRaidLobbies() {
  const container = document.getElementById('raidLobbiesContainer');
  if (!container) return;
  
  if (raidLobbiesList.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:20px;color:#888">Нет доступных команд</p>';
  } else {
    container.innerHTML = '';
    raidLobbiesList.forEach(lobby => {
      const div = document.createElement('div');
      div.className = 'raid-lobby-item';
      div.innerHTML = `
        <div class="raid-lobby-info">
          <h4>👑 ${lobby.captainName}</h4>
          <p>Команда: ${lobby.teamSize}/3 игрока</p>
        </div>
        <div class="raid-lobby-action">
          ${lobby.isOpen 
            ? '<button onclick="joinRaidLobby(\'' + lobby.lobbyId + '\')">Присоединиться</button>'
            : '<button onclick="joinRaidLobbyWithCode(\'' + lobby.lobbyId + '\')">Ввести код</button>'
          }
        </div>
      `;
      container.appendChild(div);
    });
  }
}
  
function createRaidLobby(isOpen = true) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'createRaidLobby', isOpen }));
  }
}

function joinRaidLobby(lobbyId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'joinRaidLobby', lobbyId }));
  }
}

function joinRaidLobbyWithCode(lobbyId) {
  const code = prompt('Введите код лобби:');
  if (code) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'joinRaidLobby', lobbyId, code }));
    }
  }
}

function leaveRaidLobby() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'leaveRaidLobby' }));
  }
}

function renderRaidTeam() {
  if (!currentRaidLobby) return;
  
  const panel = document.getElementById('raidTeamPanel');
  const members = document.getElementById('raidTeamMembers');
  
  if (!panel || !members) return;
  
  panel.style.display = 'block';
  members.innerHTML = '';
  
  currentRaidLobby.team.forEach((member) => {
    const div = document.createElement('div');
    div.className = 'raid-team-member';
    
    const role = RAID_ROLES_CLIENT[member.role] || { emoji: '❓', name: 'Выбор...' };
    const isSelected = member.role && member.role !== 'none';
    
    const roleButtons = Object.entries(RAID_ROLES_CLIENT).map(([key, r]) => 
      `<button class="raid-role-btn ${member.role === key ? 'selected' : ''}" 
               onclick="selectRaidRole('${key}')">${r.emoji} ${r.name}</button>`
    ).join('');
    
    div.innerHTML = `
      <div>
        <h4>${isSelected ? `${role.emoji} ` : ''}${member.name}${isSelected ? '' : ' (нет роли)'}</h4>
        <div class="raid-role-selection">${roleButtons}</div>
      </div>
    `;
    
    members.appendChild(div);
  });
  
  // Обновляем кнопку старта - только если команда полная
  const startBtn = document.querySelector('.raid-start-btn');
  if (startBtn) {
    const isFull = currentRaidLobby.team.length >= 3;
    startBtn.disabled = !isFull;
    startBtn.textContent = isFull ? '⚔️ Начать поиск соперников' : `Нужно ещё игроков (${currentRaidLobby.team.length}/3)`;
  }
}

function showRaidTeamUI(lobbyData) {
  currentRaidLobby = lobbyData;
  renderRaidTeam();
}

function updateRaidTeamStatus(data) {
  if (!currentRaidLobby || data.lobbyId !== currentRaidLobby.lobbyId) return;
  
  // Если пришли данные о команде - обновляем полностью
  if (data.team && Array.isArray(data.team)) {
    currentRaidLobby.team = data.team;
    currentRaidLobby.teamSize = data.team.length;
    renderRaidTeam();
  } else {
    // Просто обновляем счётчик
    currentRaidLobby.teamSize = data.teamSize;
    
    const membersEl = document.getElementById('raidTeamMembers');
    if (membersEl) {
      const countEl = membersEl.querySelector('.team-count');
      if (countEl) {
        countEl.textContent = `${data.teamSize}/3 игрока`;
      }
    }
    
    // Обновляем кнопку старта
    const startBtn = document.querySelector('.raid-start-btn');
    if (startBtn) {
      const isFull = data.teamSize >= 3;
      startBtn.disabled = !isFull;
      startBtn.textContent = isFull ? '⚔️ Начать поиск соперников' : `Нужно ещё игроков (${data.teamSize}/3)`;
    }
  }
  
  // Показываем уведомление если команда заполнилась
  if (data.teamSize === 3) {
    showNotification('✅ Команда собрана! Можно начинать поиск!');
  }
}
  
function selectRaidRole(role) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'selectRaidRole', role }));
  }
}

function selectRaidStratagem(stratagem) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'selectRaidStratagem', stratagem }));
  }
}

function startRaidBattle() {
  if (!currentRaidLobby || !currentRaidLobby.lobbyId) {
    showNotification('❌ Ошибка: лобби не найдено!');
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'startRaidBattle', lobbyId: currentRaidLobby.lobbyId }));
  }
}
  
function showRaidBattleUI(data) {
  currentRaidBattle = {
    battleId: data.battleId,
    team: data.team,
    opponentTeam: data.opponentTeam || [],
    duration: data.duration,
    timeLeft: data.duration
  };
  
  // Скрываем все виды
  hideAllViews();
  
  // Показываем UI боя
  const battleView = document.getElementById('raidBattleView');
  if (battleView) {
    battleView.classList.add('active');
  }
  
  renderRaidBattleTeam();
  startRaidBattleTimer();
}
  
function renderRaidBattleTeam() {
  const container = document.getElementById('raidBattleTeam');
  if (!container || !currentRaidBattle) return;
  
  container.innerHTML = '';
  
  // Показываем нашу команду
  const teamHeader = document.createElement('div');
  teamHeader.style.cssText = 'grid-column: 1/-1; text-align: center; color: #4fc3f7; margin-bottom: 10px;';
  teamHeader.innerHTML = '<h3>🐋 Наша команда</h3>';
  container.appendChild(teamHeader);
  
  currentRaidBattle.team.forEach((player, index) => {
    const role = RAID_ROLES_CLIENT[player.role] || { emoji: '❓', name: player.role };
    const div = document.createElement('div');
    div.className = 'raid-battle-player';
    div.id = `raidPlayer_${index}`;
    div.innerHTML = `
      <div class="raid-player-role">${role.emoji} ${role.name}</div>
      <div class="raid-player-name">${player.name}</div>
      <div class="raid-player-clicks" id="raidClicks_${index}">0</div>
      <div class="raid-player-score" id="raidScore_${index}">0</div>
    `;
    container.appendChild(div);
  });
  
  // Показываем команду соперника
  if (currentRaidBattle.opponentTeam && currentRaidBattle.opponentTeam.length > 0) {
    const opponentHeader = document.createElement('div');
    opponentHeader.style.cssText = 'grid-column: 1/-1; text-align: center; color: #ff5252; margin: 20px 0 10px;';
    opponentHeader.innerHTML = '<h3>⚔️ Соперники</h3>';
    container.appendChild(opponentHeader);
    
    currentRaidBattle.opponentTeam.forEach((player, index) => {
      const role = RAID_ROLES_CLIENT[player.role] || { emoji: '❓', name: player.role };
      const div = document.createElement('div');
      div.className = 'raid-battle-player';
      div.style.opacity = '0.7';
      div.innerHTML = `
        <div class="raid-player-role">${role.emoji} ${role.name}</div>
        <div class="raid-player-name">${player.name}</div>
        <div class="raid-player-clicks" id="raidOppClicks_${index}">0</div>
        <div class="raid-player-score" id="raidOppScore_${index}">0</div>
      `;
      container.appendChild(div);
    });
  }
  
  // Кликер для боя
  const clickerContainer = document.getElementById('raidClickerContainer');
  if (clickerContainer) {
    clickerContainer.innerHTML = `
      <div id="raidClicker" class="raid-clicker">
        <img src="orca.png" alt="Orca" style="width:200px;height:200px;">
      </div>
      <div id="raidTimer" class="raid-timer">60</div>
    `;
    
    const raidClicker = document.getElementById('raidClicker');
    if (raidClicker) {
      raidClicker.addEventListener('click', handleRaidClick);
    }
  }
}
  
function updateRaidBattleUI(data) {
  if (!currentRaidBattle || data.battleId !== currentRaidBattle.battleId) return;
  
  // Находим индекс игрока в нашей команде
  const playerIndex = currentRaidBattle.team.findIndex(p => p.id === data.playerId);
  if (playerIndex >= 0) {
    const clicksEl = document.getElementById(`raidClicks_${playerIndex}`);
    const scoreEl = document.getElementById(`raidScore_${playerIndex}`);
    if (clicksEl) clicksEl.textContent = formatNumber(data.clicks);
    if (scoreEl) scoreEl.textContent = formatNumber(data.score);
  }
  
  // Обновляем общий счёт команды
  const teamScoreEl = document.getElementById('raidTeamScore');
  if (teamScoreEl) {
    teamScoreEl.textContent = formatNumber(data.teamScore);
  }
}

function showRaidEvent(event) {
  showNotification(`🎭 ${event.name}: ${event.description}`);
  
  const eventEl = document.getElementById('raidCurrentEvent');
  if (eventEl) {
    eventEl.textContent = event.name;
    eventEl.classList.add('active');
    setTimeout(() => eventEl.classList.remove('active'), 5000);
  }
}

function startRaidBattleTimer() {
  if (raidBattleTimer) clearInterval(raidBattleTimer);
  
  raidBattleTimer = setInterval(() => {
    if (!currentRaidBattle) {
      clearInterval(raidBattleTimer);
      return;
    }
    
    currentRaidBattle.timeLeft--;
    
    const timerEl = document.getElementById('raidTimer');
    if (timerEl) {
      timerEl.textContent = currentRaidBattle.timeLeft;
    }
    
    if (currentRaidBattle.timeLeft <= 0) {
      clearInterval(raidBattleTimer);
    }
  }, 1000);
}
  
function endRaidBattle(data) {
  showNotification(`✅ Рейдовая битва завершена! Счёт: ${formatNumber(data.teamScore)}`);
  
  currentRaidBattle = null;
  if (raidBattleTimer) {
    clearInterval(raidBattleTimer);
    raidBattleTimer = null;
  }
  
  // Возвращаемся к главному экрану через 3 секунды
  setTimeout(() => {
    if (typeof showGameScreen === 'function') {
      showGameScreen();
    } else {
      // Фоллбек если showGameScreen нет
      hideAllViews();
      const gameScreen = document.getElementById('gameScreen');
      if (gameScreen) gameScreen.classList.add('active');
      updateUI();
    }
  }, 3000);
}

function handleRaidClick() {
  if (!currentRaidBattle || !ws || ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    type: 'raidClick',
    battleId: currentRaidBattle.battleId,
    clicks: 1
  }));
}

// Данные ролей для клиента
const RAID_ROLES_CLIENT = {
  assassin: { emoji: '🔪', name: 'Ассасин' },
  tank: { emoji: '🛡️', name: 'Танк' },
  shooter: { emoji: '🏹', name: 'Стрелок' },
  mage: { emoji: '🔮', name: 'Маг' },
  healer: { emoji: '💚', name: 'Хилер' },
  leader: { emoji: '👑', name: 'Лидер' }
};

let raidBattleTimer = null;

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
  
// Функция для установки автокликера (может быть вызвана несколько раз)
function setupAutoClickInterval() {
  // Сначала очищаем старый интервал если есть
  if (autoClickInterval) {
    clearInterval(autoClickInterval);
  }
  
  lastAutoClickTime = 0;
  autoClickIntervalCount = 0;
  
  autoClickInterval = setInterval(() => {
    autoClickIntervalCount++;
    const now = Date.now();
    // Защита от дублирования интервалов
    if (now - lastAutoClickTime < 900) return; // минимум 900мс между вызовами
    lastAutoClickTime = now;
    
    const perSecond = getPerSecond();
    if (perSecond > 0) {
      // Валидация перед расчетом
      if (!Number.isFinite(perSecond)) {
        console.error('ERROR: perSecond is invalid!', { perSecond });
        return;
      }
      
      const oldCoins = game.coins;
      // multiplier НЕ применяется - множители эффектов уже внутри getPerSecond()
      const earned = perSecond;
      
      // Проверка что результат не NaN и не Infinity
      if (!Number.isFinite(earned)) {
        console.error('CRITICAL ERROR: earned is NaN or Infinity!', { perSecond, earned });
        return;
      }
      
      game.coins += earned;
      game.totalCoins += earned;
      
      // КРИТИЧЕСКАЯ проверка: если монеты начали расти в научной нотации - сбрасываем
      if (game.coins > 1e30 || !Number.isFinite(game.coins)) {
        console.error('CRITICAL ERROR: coins exceeded limits!', game.coins);
        game.coins = oldCoins;  // Откатываем последние изменения
        return;
      }
      
      // Лог для отладки если монеты растут слишком быстро
      if (earned > 10000) {
        console.warn(`WARNING: High earned: ${earned}, perSecond: ${perSecond}, intervals: ${autoClickIntervalCount}`);
      }
      
      updateUI();
      checkQuests();
      // фиксируем автодоход "в реальном времени" (сервер), локалку не спамим
      scheduleServerSave();
    }
  }, 1000);
  
  console.log('✅ Интервал автодохода установлен');
}

// Инициализируем интервал на старте
setupAutoClickInterval();

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
    console.log(`🧹 Интервал автодохода очищен (было вызвано ${autoClickIntervalCount} раз)`);
    autoClickIntervalCount = 0;
  }
}

function handleClick(e) {
  const now = Date.now();

  // Ранги PvP отключены: функция-заглушка (чтобы не падал скрипт)
  // checkRankProgress() оставляем пустым.
  if (typeof checkRankProgress !== 'function') {
    window.checkRankProgress = function() {};
  }
  if (now - lastClickTime >= 1000) {
    clicksThisSecond = 0;
    lastClickTime = now;
  }
  clicksThisSecond++;

  if (clicksThisSecond > MAX_CLICKS_PER_SEC) {
    return;
  }

  const perClick = getPerClick();
  let earned = perClick * game.multiplier;
  
  if (!Number.isFinite(earned) || earned > 1e15) {
    earned = Math.min(perClick, 1e15);
  }
  
  const coinsBefore = game.coins;
  game.coins += earned;
  game.totalCoins += earned;
  game.clicks++;
  
  // Обновляем ежедневный прогресс
  if (!game.dailyProgress) game.dailyProgress = { clicks: 0, coins: 0, playTime: 0 };
  game.dailyProgress.clicks++;
  game.dailyProgress.coins += earned;
  
  if (!Number.isFinite(game.coins)) {
    game.coins = 0;
  }
  
  const rect = clicker.getBoundingClientRect();
  const x = e.clientX || (rect.left + rect.width / 2);
  const y = e.clientY || (rect.top + rect.height / 2);
  const text = `+${formatNumber(earned)}`;
  const color = '#4fc3f7';
  showFloatingText(x, y, text, color);
  
  playSound('clickSound');
  
  clicker.style.transform = 'scale(0.95)';
  setTimeout(() => {
    clicker.style.transform = 'scale(1)';
  }, 100);
  
  if (game.effects && game.effects['e4'] && isEffectEnabled('e4')) {
    createStarParticles(x, y);
  }
  
  if (game.effects && game.effects['e5'] && isEffectEnabled('e5')) {
    createWaveEffect(e);
  }
  
  // Обновляем прогресс пути к славе
  game.totalRankClicks = (game.totalRankClicks || 0) + 1;
  checkRankProgress();
  
  updateUI();
  checkAchievements();
  checkQuests();
  
  clickBuffer.push({
    t: now,
    clicks: game.clicks,
    coins: game.coins,
    totalCoins: game.totalCoins
  });
  
  if (clickBuffer.length >= 5 || Date.now() - lastServerSync > 2000) {
    flushClickBuffer();
  }
  
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
  
  // Валидация
  if (!Number.isFinite(bonusValue)) {
    console.warn(`WARNING: Invalid bonus value: ${bonusValue}`);
    return;
  }
  
  // Лог для отладки
  console.log(`🎁 Бонус: perClick=${perClick}, bonusValue=${bonusValue}, coins before=${game.coins}`);
  
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
  
  // Валидация
  if (!Number.isFinite(fishValue)) {
    console.warn(`WARNING: Invalid fish value: ${fishValue}`);
    return;
  }
  
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
  
// ==================== МИНИ-ИГРА "РЫБАЛКА" ====================
let fishingGameActive = false;
let fishingTimer = null;
let fishingSpawnInterval = null;
let fishingCountdown = null;
let nextFishingTime = null;

// Запускаем таймер ожидания мини-игры
function startFishingTimer() {
  if (nextFishingTime) return;
  
  const delay = (2 + Math.random() * 2) * 60 * 1000; // 2-4 минуты
  nextFishingTime = Date.now() + delay;
  
  console.log(`🎣 Следующая рыбалка через ${Math.round(delay / 1000)} сек`);
  
  setTimeout(() => {
    startFishingGame();
    nextFishingTime = null;
  }, delay);
}

// Начало мини-игры
function startFishingGame() {
  if (fishingGameActive) return;
  
  fishingGameActive = true;
  const gameEl = document.getElementById('fishingGame');
  const area = document.getElementById('fishingArea');
  const timerEl = document.getElementById('fishingTimer');
  
  if (!gameEl || !area) {
    fishingGameActive = false;
    startFishingTimer();
    return;
  }

  gameEl.classList.remove('hidden');
  area.innerHTML = '';
  
  let timeLeft = 15;
  timerEl.textContent = timeLeft;
  
  // Спавним рыбок каждые 400-800мс
  fishingSpawnInterval = setInterval(() => {
    if (!fishingGameActive) return;
    spawnFishingFish(area);
  }, 400 + Math.random() * 400);
  
  // Обратный отсчёт
  fishingCountdown = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    
    if (timeLeft <= 0) {
      closeFishingGame();
    }
  }, 1000);
  
  showNotification('🎣 Рыбалка началась! Лови рыбок!');
  playSound('bonusSound');
}
  
// Спавн рыбки в мини-игре
function spawnFishingFish(area) {
  if (!area || !fishingGameActive) return;
  
  const fish = document.createElement('div');
  fish.className = 'fishing-fish';
  
  const maxX = area.clientWidth - 60;
  const maxY = area.clientHeight - 60;
  
  fish.style.left = `${20 + Math.random() * maxX}px`;
  fish.style.top = `${20 + Math.random() * maxY}px`;
  
  // Разная редкость рыбок
  const rarity = Math.random();
  let fishAmount = 1;
  let fishImg = 'fish.png';
  
  if (rarity > 0.9) {
    fishAmount = 3;
    fishImg = 'fish.png'; // Легендарная
    fish.classList.add('legendary');
  } else if (rarity > 0.7) {
    fishAmount = 2;
    fishImg = 'fish.png'; // Редкая
    fish.classList.add('rare');
  } else {
    fish.classList.add('common');
  }
  
  fish.innerHTML = `<img src="${fishImg}" alt="🐟" onerror="this.parentElement.textContent='🐟';this.style.fontSize='36px'">`;
  
  fish.addEventListener('click', (e) => {
    e.stopPropagation();
    catchFishingFish(fish, fishAmount, e.clientX, e.clientY);
  });
  
  area.appendChild(fish);
  
  // Удаляем рыбку через 4 секунды если не поймана
  setTimeout(() => {
    if (fish.parentElement && !fish.classList.contains('caught')) {
      fish.style.opacity = '0';
      fish.style.transform = 'scale(0)';
      setTimeout(() => fish.remove(), 300);
    }
  }, 4000);
}

// Ловля рыбки
function catchFishingFish(fishEl, amount, x, y) {
  if (!fishingGameActive) return;
  
  fishEl.classList.add('caught');
  
  game.fish = (game.fish || 0) + amount;
  
  // Плавающий текст
  const text = document.createElement('div');
  text.className = 'fish-catch-text';
  text.textContent = `+${amount} 🐟`;
  text.style.left = `${x - 20}px`;
  text.style.top = `${y - 40}px`;
  document.body.appendChild(text);
  
  setTimeout(() => text.remove(), 1000);
  
  playSound('clickSound');
  updateUI();
  saveGame();
  
  setTimeout(() => fishEl.remove(), 400);
}

// Закрытие мини-игры
function closeFishingGame() {
  fishingGameActive = false;
  
  if (fishingSpawnInterval) {
    clearInterval(fishingSpawnInterval);
    fishingSpawnInterval = null;
  }
  if (fishingCountdown) {
    clearInterval(fishingCountdown);
    fishingCountdown = null;
  }
  
  const gameEl = document.getElementById('fishingGame');
  if (gameEl) gameEl.classList.add('hidden');
  
  showNotification(`🎣 Рыбалка окончена! У тебя ${game.fish || 0} 🐟`);
  
  // Запускаем таймер следующей игры
  setTimeout(startFishingTimer, 5000);
}

// Обмен рыбок на косатки
function exchangeFishForCoins() {
  const fishCount = game.fish || 0;
  
  if (fishCount < 100) {
    showNotification(`❌ Нужно минимум 100 🐟 для обмена! У тебя: ${fishCount}`);
    return;
  }
  
  // Сначала закрываем старую модалку если есть
  closeExchangeModal();
  setTimeout(() => {
    // Рассчитываем награду (растёт с уровнемом)
    const minReward = 50 + (game.level * 10);
    const maxReward = 150 + (game.level * 25);
    const reward = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
    
    // Создаём модалку обмена
    const overlay = document.createElement('div');
    overlay.className = 'exchange-modal-overlay';
    overlay.id = 'exchangeModalOverlay';
    overlay.innerHTML = `
      <div class="exchange-modal">
        <h3>🔄 Обмен рыбок</h3>
        <div class="fish-amount">🐟 × ${fishCount}</div>
        <p>Обменять 100 рыбок на случайное количество косаток?</p>
        <div class="reward-info">
          <p>Возможная награда:</p>
          <strong>${formatNumber(minReward)} - ${formatNumber(maxReward)} 🐋</strong>
          <p style="font-size:12px;margin-top:8px;opacity:0.7">Чем выше уровень, тем больше награда!</p>
        </div>
        <div class="exchange-modal-buttons">
          <button class="exchange-confirm-btn" onclick="confirmFishExchange()">✅ Обменять</button>
          <button class="exchange-cancel-btn" onclick="closeExchangeModal()">❌ Отмена</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    // Принудительно показываем
    overlay.style.display = 'block';
    setTimeout(() => {
      overlay.classList.add('active');
    }, 10);
  }, 100);
}

// Подтверждение обмена
function confirmFishExchange() {
  const fishCount = game.fish || 0;
  if (fishCount < 100) {
    closeExchangeModal();
    showNotification('❌ Недостаточно рыбок! Нужно минимум 100 🐟');
    return;
  }

  const minReward = 50 + (game.level * 10);
  const maxReward = 150 + (game.level * 25);
  const reward = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
  
  console.log(`🔄 Обмен рыбок: -100 🐟 → +${reward} 🐋`);
  
  // Списываем рыбок
  game.fish = fishCount - 100;
  
  // Добавляем косатки
  game.coins += reward;
  game.totalCoins += reward;
  
  // Закрываем модалку ПЕРЕД уведомлениями
  closeExchangeModal();
  
  // Даем небольшую задержку чтобы модалка закрылась
  setTimeout(() => {
    showNotification(`🎉 Обмен совершён! +${formatNumber(reward)} 🐋`);
    showFloatingText(
      window.innerWidth / 2,
      window.innerHeight / 2,
      `+${formatNumber(reward)} 🐋`,
      '#00d4ff'
    );
    
    playSound('levelSound');
    updateUI();
    saveGame();
  }, 350);
}

// Закрытие модалки обмена
function closeExchangeModal() {
  const modal = document.getElementById('exchangeModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    // Принудительно скрываем модалку
    const innerModal = modal.querySelector('.exchange-modal');
    if (innerModal) {
      innerModal.style.display = 'none';
      innerModal.classList.remove('active');
    }
    modal.style.display = 'none';
    // Удаляем сразу без анимации
    setTimeout(() => {
      if (modal && modal.parentNode) {
        modal.remove();
      }
    }, 50);
  }
}
  
// ==================== UI ОБНОВЛЕНИЯ ====================
function updateUI() {
  // Используем функции расчета с учётом навыков (без x2 бонуса)
  const perClick = getPerClick();
  const perSecond = getPerSecond();
  
  // Валидация coins перед отображением
  if (!Number.isFinite(game.coins)) {
    console.error('❌ CRITICAL: game.coins is invalid in updateUI!', game.coins);
    game.coins = 0;
  }
  if (!Number.isFinite(game.totalCoins)) {
    console.error('❌ CRITICAL: game.totalCoins is invalid in updateUI!', game.totalCoins);
    game.totalCoins = 0;
  }
  
  coinsEl.textContent = formatNumber(Math.floor(game.coins));
  levelEl.textContent = game.level;
  // Показываем базовые значения (множитель x2 применяется только к монетам, не к статам)
  perClickEl.textContent = formatNumber(perClick);
  perSecondEl.textContent = formatNumber(perSecond);
  
  // Обновляем счётчик рыбок
  const fishCountEl = document.getElementById('fishCount');
  const exchangeBtn = document.getElementById('exchangeFishBtn');
  if (fishCountEl) {
    fishCountEl.textContent = formatNumber(game.fish || 0);
  }
  if (exchangeBtn) {
    if ((game.fish || 0) >= 100) {
      exchangeBtn.classList.remove('hidden');
    } else {
      exchangeBtn.classList.add('hidden');
    }
  }
  
  // Расчет уровня с защитой
  const newLevel = Math.floor(Math.log10(Math.max(1, game.totalCoins) + 1)) + 1;
  if (newLevel > game.level && newLevel < 1000) {  // Защита от аномального уровня
    const oldLevel = game.level;
    game.level = newLevel;
    console.log(`🎉 Level up: ${oldLevel} → ${newLevel} (totalCoins=${game.totalCoins})`);
    showNotification(`🎉 Новый уровень: ${game.level}!`);
    playSound('levelSound');
  } else if (newLevel >= 1000) {
    console.error(`🚨 CRITICAL: Level too high! newLevel=${newLevel}, totalCoins=${game.totalCoins}`);
    game.level = Math.min(game.level, 100);
  }
  
  // Обновление скина
  updateSkin();
}

function updateSkin() {
  const skin = skinsData.find(s => s.id === game.currentSkin);
  if (skin && orcaImg) {
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
    
  }
}
  
function formatNumber(num) {
  // Преобразуем строки в числа
  if (typeof num === 'string') {
    num = Number(num);
  }
  
  if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
    console.warn(`WARNING: formatNumber received invalid value: ${num}`);
    return '0';
  }
  
  // Защита от переполнения
  if (num > Number.MAX_SAFE_INTEGER) {
    console.error(`CRITICAL: Number exceeds MAX_SAFE_INTEGER: ${num}`);
    return '∞';
  }
  
  if (num >= 1000000000000000) return (num / 1000000000000000).toFixed(2) + 'Qa';
  if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + 'T';
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B'
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
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
    div.addEventListener('click', () => buyItem(item));
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    container.appendChild(div);
  });
    
  renderSkins();
}

function renderBoxes() {
  const container = document.getElementById('shopBoxes');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Catdrop (бывший обычный бокс)
  const catdropDiv = document.createElement('div');
  catdropDiv.className = 'box-item';
  catdropDiv.innerHTML = `
    <div class="box-icon">
      <img src="catdrop.png" alt="Catdrop" style="width:80px;height:80px;object-fit:contain;">
    </div>
    <h4>Catdrop</h4>
    <p>Скины, косатки и эффекты навсегда!</p>
    <div class="box-price">🐋 ${formatNumber(8500)}</div>
    <button class="box-buy-btn" onclick="buyBox()">Купить</button>
    <div class="box-inventory">
      <p>У вас есть: <strong id="boxCount">${pendingBoxes.length}</strong> Catdrop(s)</p>
      <button class="box-open-btn" onclick="tryOpenBox()" ${pendingBoxes.length === 0 ? 'disabled' : ''}>Открыть</button>
    </div>
  `;
  container.appendChild(catdropDiv);
}
  
function tryOpenBox() {
  if (isOpeningBox || pendingBoxes.length === 0) return;
  openBox(pendingBoxes[0]);
}

function buyBox() {
  if (isOpeningBox) {
    console.log('⚠️ Покупка Catdrop отменена: уже открыт Catdrop');
    return;
  }
  
  const boxPrice = 8500;
  if (game.coins < boxPrice) {
    showNotification('❌ Недостаточно косаток');
    return;
  }

  console.log(`🎁 Покупка Catdrop: баланс=${game.coins}, цена=${boxPrice}`);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'buyBox' }));
    console.log('📤 Отправлен запрос на покупку Catdrop');
  } else {
    console.error('❌ Нет соединения с сервером');
    showNotification('❌ Нет соединения с сервером');
  }
}
  
// Catdrop награда
function showCatdropReward(reward) {
  if (!reward) {
    console.error('❌ showCatdropReward вызван без награды!');
    showNotification('❌ Ошибка получения награды');
    return;
  }

  const rewardModal = document.getElementById('catdropRewardModal');
  if (!rewardModal) {
    console.error('❌ Модальное окно награды не найдено!');
    showNotification('❌ Ошибка отображения награды');
    return;
  }

  // Очищаем предыдущее содержимое
  rewardModal.innerHTML = '';
  
  const rarityColors = {
    common: 'linear-gradient(145deg, rgba(34,197,94,0.3), rgba(22,163,74,0.2))',
    rare: 'linear-gradient(145deg, rgba(59,130,246,0.3), rgba(37,99,235,0.2))',
    epic: 'linear-gradient(145deg, rgba(168,85,247,0.3), rgba(124,58,237,0.2))',
    legendary: 'linear-gradient(145deg, rgba(255,107,107,0.3), rgba(205,44,44,0.2))'
  };
  
  const rarityGlow = {
    common: '0 0 40px rgba(34,197,94,0.6)',
    rare: '0 0 40px rgba(59,130,246,0.6)',
    epic: '0 0 50px rgba(168,85,247,0.7)',
    legendary: '0 0 60px rgba(255,107,107,0.8)'
  };
  
  const rarityTitles = {
    common: 'Обычное',
    rare: 'Редкое',
    epic: 'Эпическое',
    legendary: 'Легендарное'
  };
  
  let icon = '🎁';
  let title = 'Награда';
  let value = '';
  let description = 'Поздравляем!';
  let skin = null;
  
  if (reward.type === 'skin') {
    icon = '🎨';
    title = 'Новый скин!';
    value = reward.skinName;
    description = 'Скин добавлен в вашу коллекцию!';
    const skinData = skinsData.find(s => s.id === reward.skinId);
    if (skinData) skin = skinData;
  } else if (reward.type === 'coins') {
    icon = '🐋';
    title = 'Косатки получены!';
    value = `+${formatNumber(reward.amount)}`;
    description = 'Отличный улов!';
  } else if (reward.type === 'visualEffect') {
    icon = '✨';
    title = 'Визуальный эффект!';
    value = getEffectName(reward.effectId);
    description = 'Эффект добавлен навсегда!';
  } else if (reward.type === 'tempBuff') {
    icon = '⚡';
    title = 'Временный бафф!';
    value = `X${reward.mult} на ${reward.duration} сек`;
    description = 'Множитель активирован!';
  }
  
  rewardModal.innerHTML = `
    <div class="catdrop-reward-overlay"></div>
    <div class="catdrop-reward-content" style="box-shadow: ${rarityGlow[reward.rarity] || rarityGlow.common}">
      <div class="catdrop-reward-icon" style="background: ${rarityColors[reward.rarity] || rarityColors.common}; box-shadow: 0 0 30px ${rarityColors[reward.rarity] || rarityColors.common}">${icon}</div>
      <h2 class="catdrop-reward-title ${reward.rarity}">${title}</h2>
      <p class="catdrop-reward-value">${value}</p>
      <p class="catdrop-reward-rarity ${reward.rarity}">${rarityTitles[reward.rarity] || reward.rarity}</p>
      <p class="catdrop-reward-desc">${description}</p>
      ${skin ? `<img class="catdrop-reward-skin" src="${skin.image}" alt="${skin.name}" onerror="this.style.display='none'">` : ''}
    </div>
  `;
  
  rewardModal.style.display = 'flex';
  setTimeout(() => {
    rewardModal.classList.add('show');
  }, 10);
  
  console.log('✅ Награда показана:', reward);
  
  // Автоматически закрываем через 3 секунды
  setTimeout(() => {
    closeCatdropReward();
  }, 3000);
}

function closeCatdropReward() {
  const rewardModal = document.getElementById('catdropRewardModal');
  if (rewardModal) {
    rewardModal.classList.remove('show');
    setTimeout(() => {
      rewardModal.style.display = 'none';
      // Очищаем награду
      dataRewardFromServer = null;
    }, 300);
  }
}
  
function tryOpenFishBox() {
  if (isOpeningFishBox || pendingFishBoxes.length === 0) return;
  // Открываем первый рыбный бокс из массива
  openFishBox(pendingFishBoxes[0]);
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
  
  // Добавляем заголовок
  const header = document.createElement('div');
  header.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 20px; background: rgba(255,215,0,0.1); border: 2px solid rgba(255,215,0,0.3); border-radius: 16px; margin-bottom: 20px;';
  header.innerHTML = `
    <p style="font-size: 18px; color: var(--accent); margin-bottom: 10px;">🎁 Все скины получаются из Catdrop!</p>
    <p style="font-size: 14px; opacity: 0.8;">Откройте Catdrop чтобы получить новые скины навсегда.</p>
  `;
  container.appendChild(header);
  
  skinsData.forEach(skin => {
    const unlocked = skin.id === 'normal' || !!game.skins[skin.id];
    const div = document.createElement('div');
    
    // Скрываем Richi пока не получен
    if (skin.id === 'richi' && !unlocked) {
      div.className = 'skin-item locked-skin hidden-skin';
      div.innerHTML = `
        <div class="hidden-skin-placeholder">
          <span style="font-size: 40px;">❓</span>
          <p>???</p>
          <p>???</p>
        </div>
      `;
    } else if (!unlocked && skin.id !== 'normal') {
      // Закрытый скин (не richi) - показываем заглушку без названия и картинки
      div.className = 'skin-item locked-skin';
      div.innerHTML = `
        <div class="hidden-skin-placeholder">
          <span style="font-size: 40px;">🔒</span>
          <p>???</p>
          <p>🎁 Из бокса</p>
        </div>
      `;
    } else {
      // Открытый скин
      div.className = `skin-item ${game.currentSkin === skin.id ? 'active' : ''}`;
      div.innerHTML = `
        <img src="${skin.image}" alt="${skin.name}" onerror="this.style.display='none'">
        <p>${skin.name}</p>
        <p>✅</p>
      `;
      div.onclick = () => buyOrEquipSkin(skin);
    }
  
    container.appendChild(div);
  });
}

function buyOrEquipSkin(skin) {
  const unlocked = skin.id === 'normal' || !!game.skins[skin.id];
  
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
    // Скины ТОЛЬКО из Catdrop!
    showNotification('🎁 Скины можно получить только из Catdrop!');
  }
}

// ==================== КВЕСТЫ ====================
function getCurrentDateString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function pickRandomDailyQuestIds(savedDate, savedIds) {
  const today = getCurrentDateString();
  if (savedDate === today && Array.isArray(savedIds) && savedIds.length === 3 && new Set(savedIds).size === 3) {
    return savedIds.slice();
  }

  const availableIds = questsData.map(q => q.id);
  const selected = [];
  const pool = [...availableIds];
  while (selected.length < 3 && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

function initQuests(savedQuestState) {
  const today = getCurrentDateString();
  let savedProgress = [];
  let savedDate = null;
  let savedIds = null;

  if (Array.isArray(savedQuestState)) {
    savedProgress = savedQuestState;
  } else if (savedQuestState && typeof savedQuestState === 'object') {
    savedProgress = Array.isArray(savedQuestState.progress) ? savedQuestState.progress : [];
    savedDate = savedQuestState.dailyQuestDate || null;
    savedIds = Array.isArray(savedQuestState.dailyQuestIds) ? savedQuestState.dailyQuestIds : null;
  }

  // Сброс ежедневного прогресса если наступил новый день
  if (savedDate !== today) {
    game.dailyProgress = { clicks: 0, coins: 0, playTime: 0 };
  }

  const dailyQuestIds = pickRandomDailyQuestIds(savedDate, savedIds);
  game.dailyQuestDate = today;
  game.dailyQuestIds = dailyQuestIds;

  game.quests = dailyQuestIds.map(id => {
    const questTemplate = questsData.find(q => q.id === id) || { id, name: 'Неизвестный квест', desc: '', target: 0, type: 'clicks', reward: 0 };
    const saved = savedProgress.find(p => p.id === id);
    return {
      ...questTemplate,
      completed: saved ? !!saved.completed : getQuestProgress(questTemplate) >= questTemplate.target
    };
  });

  if (!savedIds || savedDate !== today) {
    saveGame();
  }

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
  // Для ежедневных квестов - используем dailyProgress, для постоянных - общую статистику
  const isDaily = game.dailyQuestIds && game.dailyQuestIds.includes(quest.id);
  
  if (isDaily) {
    // Ежедневный квест - считаем с начала дня
    if (quest.type === 'clicks') return (game.dailyProgress && game.dailyProgress.clicks) || 0;
    if (quest.type === 'coins') return (game.dailyProgress && game.dailyProgress.coins) || 0;
    if (quest.type === 'playTime') return (game.dailyProgress && game.dailyProgress.playTime) || 0;
  }
  
  // Постоянный квест или неподдерживаемый тип
  if (quest.type === 'clicks') return game.clicks;
  if (quest.type === 'coins') return game.coins;
  if (quest.type === 'totalCoins') return game.totalCoins;
  if (quest.type === 'perClick') return getPerClick();
  if (quest.type === 'perSecond') return getPerSecond();
  if (quest.type === 'playTime') return game.playTime;
  return 0;
}

function checkQuests() {
  game.quests.forEach(quest => {
    // КРИТИЧНО: проверяем что квест ещё не завершён И ещё не был награждён
    if (!quest.completed && getQuestProgress(quest) >= quest.target) {
      quest.completed = true;
      
      // Валидация награды
      if (Number.isFinite(quest.reward) && quest.reward >= 0) {
        game.coins += quest.reward;
        showNotification(`🎉 Квест выполнен: ${quest.name}! +${formatNumber(quest.reward)}`);
      } else {
        console.warn(`WARNING: Invalid quest reward: ${quest.reward}`);
        showNotification(`🎉 Квест выполнен: ${quest.name}!`);
      }
      
      playSound('bonusSound');
      renderQuests();
      
      // Сохраняем сразу после выполнения
      saveGame();
    }
  });
}

// ==================== ЭФФЕКТЫ ====================
// Применение визуальных эффектов
function applyEffects() {
  const clicker = document.getElementById('clicker');
  if (!clicker || !game.effects) return;
  
  // Сброс всех эффектов
  clicker.classList.remove('effect-gold', 'effect-neon', 'effect-fire', 'effect-ice', 'effect-shadow', 'effect-electric', 'effect-ghost');
  clicker.style.removeProperty('--rainbow-gradient');
  
  // Золотой клик (e1)
  if (game.effects['e1'] && isEffectEnabled('e1')) {
    clicker.classList.add('effect-gold');
  }
  
  // Неоновый свет (e2)
  if (game.effects['e2'] && isEffectEnabled('e2')) {
    clicker.classList.add('effect-neon');
  }
  
  // Радужный след (e3)
  if (game.effects['e3'] && isEffectEnabled('e3')) {
    clicker.classList.add('effect-rainbow');
  }
  
  // Огненное сияние (e6)
  if (game.effects['e6'] && isEffectEnabled('e6')) {
    clicker.classList.add('effect-fire');
  }
  
  // Ледяной мороз (e7)
  if (game.effects['e7'] && isEffectEnabled('e7')) {
    clicker.classList.add('effect-ice');
  }
  
  // Темная материя (e8)
  if (game.effects['e8'] && isEffectEnabled('e8')) {
    clicker.classList.add('effect-shadow');
  }
  
  // Электрический шторм (e9)
  if (game.effects['e9'] && isEffectEnabled('e9')) {
    clicker.classList.add('effect-electric');
  }
  
  // Призрачное сияние (e10)
  if (game.effects['e10'] && isEffectEnabled('e10')) {
    clicker.classList.add('effect-ghost');
  }
}

function getEffectName(effectId) {
  const effectNames = {
    e1: 'Золотой клик',
    e2: 'Неоновый свет',
    e3: 'Радужный след',
    e4: 'Частицы звёзд',
    e5: 'Волновой эффект',
    e6: 'Огненное сияние',
    e7: 'Ледяной мороз',
    e8: 'Темная материя',
    e9: 'Электрический шторм',
    e10: 'Призрачное сияние'
  };
  return effectNames[effectId] || effectId;
}
  
function isEffectEnabled(effectId) {
  return localStorage.getItem(`effect_${effectId}_enabled`) !== 'false';
}

function syncEffectsTogglesUI() {
  const ids = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'];

  ids.forEach(id => {
    const enabled = isEffectEnabled(id);
    
    // Синхронизируем кнопки в Настройках
    const settingsOnBtn = document.querySelector('#settings .effect-toggle-btn[data-effect-id="' + id + '"][data-effect-enabled="true"]');
    const settingsOffBtn = document.querySelector('#settings .effect-toggle-btn[data-effect-id="' + id + '"][data-effect-enabled="false"]');
    
    if (settingsOnBtn) settingsOnBtn.classList.toggle('is-active', enabled);
    if (settingsOffBtn) settingsOffBtn.classList.toggle('is-active', !enabled);
  });

  // Синхронизируем мастер-чекбокс в Настройках
  const settingsMaster = document.querySelector('#settings #effectsToggle');
  
  if (settingsMaster) {
    const states = ids.map(id => isEffectEnabled(id));
    const allOn = states.every(Boolean);
    const allOff = states.every(v => !v);
    const indeterminate = !allOn && !allOff;
    
    settingsMaster.indeterminate = indeterminate;
    settingsMaster.checked = allOn;
  }
}

// Включение/выключение отдельного эффекта (по состоянию чекбокса)
function setEffectEnabled(effectId, enabled) {
  localStorage.setItem(`effect_${effectId}_enabled`, enabled ? 'true' : 'false');
  syncEffectsTogglesUI();
  applyEffects();
  if (enabled) showNotification(`✨ ${getEffectName(effectId)} включен`);
  else showNotification(`🔇 ${getEffectName(effectId)} отключен`);
}

function toggleEffectsSettings() {
  const toggle = document.getElementById('effectsToggle');
  if (!toggle) return;
  
  // Включаем/выключаем все эффекты сразу
  const enabled = toggle.checked;
  ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'].forEach(id => {
    localStorage.setItem(`effect_${id}_enabled`, enabled ? 'true' : 'false');
  });
  
  syncEffectsTogglesUI();
  applyEffects();
  
  if (enabled) {
    showNotification('✨ Все визуальные эффекты включены');
  } else {
    showNotification('🔇 Все визуальные эффекты отключены');
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
function createWaveEffect(e) {
  // Используем координаты клика
  const x = e.clientX || window.innerWidth / 2;
  const y = e.clientY || window.innerHeight / 2;
  
  const wave = document.createElement('div');
  wave.className = 'wave-particle';
  wave.style.left = x + 'px';
  wave.style.top = y + 'px';
  document.body.appendChild(wave);
  setTimeout(() => wave.remove(), 800);
}

function renderEffects() {
  // Инициализация если нет
  if (!game.effects) game.effects = {};
  
  // Рендер в отдельном модальном окне Effects
  const effectsModalContainer = document.getElementById('effectsList');
  if (effectsModalContainer) {
    effectsModalContainer.innerHTML = '';
    
    effectsData.forEach(effect => {
      const bought = !!game.effects[effect.id];
      const div = document.createElement('div');
      div.className = `effect-item ${bought ? 'bought' : 'locked'}`;
      div.innerHTML = `
        <div class="effect-icon">${effect.icon}</div>
        <div class="effect-info">
          <h4>${effect.name}</h4>
          <p>${effect.desc}</p>
        </div>
        <div class="effect-price">${bought ? '✅ Получен' : '🐟 Из бокса'}</div>
      `;
      effectsModalContainer.appendChild(div);
    });
  }
}

function buyEffect(effect) {
  // Эффекты теперь ТОЛЬКО из Рыбного бокса - нельзя купить в магазине
  showNotification('🐟 Эффекты можно получить только из Рыбного бокса!');
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
    // Базовые
    { id: 'a1', check: () => game.clicks >= 1 },
    { id: 'a2', check: () => game.clicks >= 100 },
    { id: 'a3', check: () => game.totalCoins >= 1000000 },
    { id: 'a4', check: () => shopItems.every(i => i.cost >= 1000) },
    { id: 'a5', check: () => getPerClick() >= 1000 },
    { id: 'a6', check: () => getPerSecond() >= 1000 },
    
    // Новые достижения - клики
    { id: 'a7', check: () => game.clicks >= 1000 },
    { id: 'a8', check: () => game.clicks >= 10000 },
    { id: 'a9', check: () => game.clicks >= 100000 },
    { id: 'a10', check: () => game.clicks >= 1000000 },
    
    // Новые достижения - монеты
    { id: 'a11', check: () => game.coins >= 10000 },
    { id: 'a12', check: () => game.coins >= 100000000 },
    { id: 'a13', check: () => game.coins >= 1000000000000 },
    
    // Новые достижения - улучшения
    { id: 'a14', check: () => shopItems.filter(i => i.cost < 100000).length >= 5 },
    { id: 'a15', check: () => shopItems.filter(i => i.cost < 100000).length >= 10 },
    { id: 'a16', check: () => shopItems.every(i => i.cost >= 100000) },
    
    // Новые достижения - эффекты
    { id: 'a17', check: () => Object.keys(game.effects || {}).length >= 1 },
    { id: 'a18', check: () => Object.keys(game.effects || {}).length >= 6 },
    
    // Новые достижения - время
    { id: 'a19', check: () => game.playTime >= 1800 },
    { id: 'a20', check: () => game.playTime >= 10800 },
    
    // Новые достижения - бонусы (пример - нужно добавить счётчик)
    { id: 'a21', check: () => game.clicks >= 1000 },
    { id: 'a22', check: () => game.clicks >= 5000 },
    
    // Новые достижения - батлы (пример - нужно добавить счётчик побед)
    { id: 'a23', check: () => game.clicks >= 10000 },
    { id: 'a24', check: () => game.clicks >= 50000 },
    
    // Новые достижения - квесты
    { id: 'a25', check: () => game.quests.filter(q => q.completed).length >= 5 },
    { id: 'a26', check: () => game.quests.every(q => q.completed) },
    
    // ДОПОЛНИТЕЛЬНЫЕ ДОСТИЖЕНИЯ - новые!
    { id: 'a27', check: () => game.coins >= 1000000000000000 },
    { id: 'a28', check: () => getPerClick() >= 1000000 },
    { id: 'a29', check: () => getPerSecond() >= 1000000 },
    { id: 'a30', check: () => game.playTime >= 360000 },
    { id: 'a31', check: () => Object.keys(game.skins || {}).length >= 7 },
    { id: 'a32', check: () => Object.keys(game.effects || {}).length >= 3 },
    { id: 'a33', check: () => game.clicks >= 10000 }, // Placeholder для боксов
    { id: 'a34', check: () => game.clicks >= 5000 },  // Placeholder для рыбных боксов
// Достижения кланов - правильные проверки
    { id: 'a35', check: () => {
      // Вождь племени: создал клан И в клане >= 10 участников
      const tracking = game.skills?._clanTracking || {};
      const createdClanId = tracking.createdClanId;
      const myClanId = typeof game.clan === 'object' ? game.clan?.id : game.clan;
      return createdClanId && myClanId === createdClanId && game.ownedClanMemberCount >= 10;
    } },
    { id: 'a36', check: () => {
      // Дипломат: вступил в 3 разных клана
      const history = game.skills?._clanTracking?.clansJoinedHistory || game.clansJoinedHistory || [];
      return history.length >= 3;
    } },
    { id: 'a37', check: () => game.clicks >= 100000 }, // Placeholder для батлов
    { id: 'a38', check: () => game.clicks >= 1000000 },
    { id: 'a39', check: () => game.coins >= 100000000000 },
    { id: 'a40', check: () => game.level >= 50 }
  ];
  
  let anyNewAchievement = false;

  checks.forEach(({ id, check }) => {
    if (!game.achievements.includes(id) && check()) {
      game.achievements.push(id);
      anyNewAchievement = true;
      const ach = achievementsData.find(a => a.id === id);
      showNotification(`🏆 Достижение: ${ach.name}!`);
      playSound('bonusSound');
    }
  });

  if (anyNewAchievement) {
    renderAchievements();
    saveGame();
  }

  unlockSecretRichiSkin();
}

// ==================== ЛИДЕРБОРД ====================
function updateLeaderboardUI(data) {
  const tbody = document.querySelector('#leaderboardTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px">Пока нет игроков</td></tr>';
    return;
  }

  data.slice(0, 100).forEach((player, i) => {
    const row = document.createElement('tr');
    // Валидация coins - защита от переполнения
    let coins = player.coins;
    if (!Number.isFinite(coins) || coins < 0) {
      coins = 0;
      console.warn(`WARNING: Invalid coins for player ${player.name}: ${player.coins}`);
    }
    if (coins > Number.MAX_SAFE_INTEGER) {
      coins = Number.MAX_SAFE_INTEGER;
      console.warn(`WARNING: Coins exceed MAX_SAFE_INTEGER for ${player.name}: ${player.coins}`);
    }
    
    // Улучшаем отображение имени - если это гость, показываем truncated ID
    let displayName = player.name;
    if (player.id) {
      // Если у игрока есть ID - показываем его
      if (displayName && displayName.startsWith('Player_')) {
        displayName = '👤 Guest_' + player.id.slice(-4);
      } else if (!displayName || displayName === 'Player') {
        displayName = '👤 Гость #' + player.id.slice(-4);
      }
    } else if (displayName && displayName.startsWith('Player_')) {
      displayName = '👤 Guest_' + displayName.slice(-4);
    } else if (!displayName || displayName === 'Player') {
      displayName = '👤 Гость ' + (i + 1);
    }
    
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(displayName)}</td>
      <td>${formatNumber(Math.floor(coins))}</td>
    `;
    tbody.appendChild(row);
  });
}

// ==================== PvP БАТТЛ ====================
let myBattleClicks = 0;
let myBattleCPS = 0;
let battleClickTimer = null;
let currentLobbyId = null;

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

  // Получаем выбранный тип лобби
  const lobbyTypeRadio = document.querySelector('input[name="lobbyType"]:checked');
  const isOpen = lobbyTypeRadio ? lobbyTypeRadio.value === 'open' : true;
  
  ws.send(JSON.stringify({ type: 'createBattleLobby', isOpen }));
}

// Присоединение к лобби (поддерживает ID или код для закрытых лоби)
function joinBattleLobby(lobbyIdOrCode, code = null) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }

  // Если передан код - используем его для поиска лобби
  if (code) {
    ws.send(JSON.stringify({ type: 'joinBattleLobby', lobbyId: lobbyIdOrCode, code: code }));
  } else {
    ws.send(JSON.stringify({ type: 'joinBattleLobby', lobbyId: lobbyIdOrCode }));
  }
}

// Вступление по коду лобби (показывает модальное окно со списком закрытых лобби)
function showClosedLobbiesModal() {
  const modal = document.getElementById('closedLobbiesModal');
  if (!modal) return;
  
  // Получаем список закрытых лобби из кэша
  const lobbies = JSON.parse(localStorage.getItem('battleLobbiesCache') || '[]');
  const closedLobbies = lobbies.filter(l => !l.isOpen && !l.hasOpponent);
  
  const listContainer = document.getElementById('closedLobbiesList');
  if (!listContainer) return;
  
  if (closedLobbies.length === 0) {
    listContainer.innerHTML = '<p style="text-align:center;padding:20px;color:#888">Нет доступных закрытых лобби</p>';
  } else {
    listContainer.innerHTML = closedLobbies.map(lobby => `
      <div class="lobby-item" style="margin-bottom:15px;border:2px solid rgba(255,215,0,0.3);">
        <div class="lobby-info">
          <p><strong>${escapeHtml(lobby.ownerName)}</strong> создаёт лобби</p>
          <small>Создано ${new Date(lobby.createdAt).toLocaleTimeString()}</small>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
          <input type="text" id="code-${lobby.id}" placeholder="Код" style="flex:1;padding:8px;border-radius:8px;border:1px solid #444;background:#1a1a2e;color:#fff;text-align:center;">
          <button class="action-btn" onclick="joinClosedLobby('${lobby.id}')">Вступить</button>
        </div>
      </div>
    `).join('');
  }
  
  modal.classList.add('active');
}

// Вступление в конкретное закрытое лобби (из списка лобби)
function joinClosedLobby(lobbyId) {
  const codeInput = document.getElementById(`code-${lobbyId}`);
  const code = codeInput?.value?.trim();
  
  if (!code) {
    showNotification('⚠️ Введите код лобби');
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }

  // Отправляем запрос на вступление с кодом
  ws.send(JSON.stringify({ type: 'joinBattleLobby', lobbyId: lobbyId, code: code }));
  showNotification('🔑 Попытка вступления в лобби...');
}

// Вступление по коду лобби (показывает модальное окно со списком закрытых лобби)

// Выход из моего лобби
function leaveMyLobby() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }

  ws.send(JSON.stringify({ type: 'leaveBattleLobby' }));
}

// Удаление моего лобби (только владелец)
function deleteMyLobby() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  
  if (confirm('Вы уверены что хотите УДАЛИТЬ это лобби? Соперник будет отключён!')) {
    ws.send(JSON.stringify({ type: 'deleteBattleLobby' }));
  }
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
    
    const lockIcon = lobby.isOpen ? '🔓' : '🔒';
    const statusText = lobby.isOpen ? 'Открытое' : 'Закрытое';
    
    if (lobby.hasOpponent) {
      div.classList.add('full');
      div.innerHTML = `
        <div class="lobby-info">
          <p><strong>${escapeHtml(lobby.ownerName)}</strong> и <strong>${escapeHtml(lobby.opponentName)}</strong></p>
          <small>${statusText} лобби</small>
        </div>
        <span style="color:#ffd700;font-weight:600">${lockIcon}</span>
      `;
    } else {
      div.innerHTML = `
        <div class="lobby-info">
          <p><strong>${escapeHtml(lobby.ownerName)}</strong> ищет соперника</p>
          <small>${statusText} • Создано ${new Date(lobby.createdAt).toLocaleTimeString()}</small>
        </div>
        ${lobby.isOpen ? 
          `<button class="action-btn" onclick="joinBattleLobby('${lobby.id}')" style="margin-bottom:0">Вступить</button>` : 
          `<div style="margin-bottom:0;display:flex;gap:8px;">
            <input type="text" id="code-${lobby.id}" placeholder="Код" style="flex:1;padding:8px;border-radius:8px;border:1px solid #444;background:#1a1a2e;color:#fff;text-align:center;">
            <button class="action-btn" onclick="joinClosedLobby('${lobby.id}')">Вступить</button>
          </div>`
        }
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
  
  // Показываем код лобби если оно закрытое (только владельцу)
  const codeEl = document.getElementById('myLobbyCode');
  const codeValueEl = document.getElementById('lobbyCodeValue');
  const currentUserId = ws.accountId || ws.playerId;
  
  if (codeEl && codeValueEl && lobby.lobbyCode) {
    codeValueEl.textContent = lobby.lobbyCode;
    // Показываем код только владельцу закрытого лобби
    codeEl.style.display = (lobby.owner === currentUserId && lobby.isOpen === false) ? 'block' : 'none';
  } else if (codeEl) {
    codeEl.style.display = 'none';
  }
  
  // Показываем кнопку удаления только для закрытого лобби
  const deleteBtn = document.getElementById('deleteLobbyBtn');
  if (deleteBtn) {
    deleteBtn.style.display = lobby.isOpen === false ? 'inline-block' : 'none';
  }
  
  // Блокируем кнопку запуска если нет соперника
  const startBtn = document.getElementById('startBattleBtn');
  if (startBtn) {
    startBtn.disabled = !lobby.hasOpponent;
    startBtn.textContent = lobby.hasOpponent ? '⚔️ Начать батл' : 'Ожидание соперника...';
  }
}

function startBattleUI(data) {
  battleId = data.battleId;
  myBattleClicks = 0;
  myBattleCPS = 0;
  currentLobbyId = data.lobbyId || null;
  
  // Скрываем все UI лобби (с проверками)
  const battleLobbyView = document.getElementById('battleLobbyView');
  const myBattleLobby = document.getElementById('myBattleLobby');
  const battleLobby = document.getElementById('battleLobby');
  const battleArena = document.getElementById('battleArena');
  
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
  
  // Валидация призов
  if (Number.isFinite(data.prize) && data.prize >= 0) {
    game.coins += data.prize;
    game.totalCoins += data.prize;
  } else {
    console.warn(`WARNING: Invalid prize from server: ${data.prize}`);
  }
  updateUI();
  saveGame();
  
  setTimeout(() => {
    // Скрываем арену и все UI лобби (с проверками)
    const battleArena = document.getElementById('battleArena');
    const battleLobbyView = document.getElementById('battleLobbyView');
    const myBattleLobby = document.getElementById('myBattleLobby');
    const battleLobby = document.getElementById('battleLobby');
    const btn = document.getElementById('battleClickBtn');
    
    if (battleArena) {
      battleArena.classList.add('hidden');
      // Удаляем badge ранга
      const rankBadge = document.getElementById('myBattleRank');
      if (rankBadge) rankBadge.remove();
    }
    if (battleLobbyView) battleLobbyView.classList.add('hidden');
    if (myBattleLobby) myBattleLobby.classList.add('hidden');
    if (battleLobby) battleLobby.classList.remove('hidden');
    
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
  if (name) ws.send(JSON.stringify({ type: 'createClan', name }));
};

window.leaveClan = function() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  console.log('🚪 leaveClan вызван, game.clan:', game.clan);
  if (confirm('Вы уверены, что хотите выйти из клана?')) {
    ws.send(JSON.stringify({ type: 'leaveClan' }));
    console.log('📤 Отправлен запрос leaveClan');
  }
};

window.joinClan = function(clanId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  ws.send(JSON.stringify({ type: 'joinClan', clanId }));
};

window.deleteClan = function() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  console.log('🗑️ deleteClan вызван, game.clan:', game.clan);
  if (confirm('Вы уверены, что хотите УДАЛИТЬ свой клан? Это действие необратимо!')) {
    ws.send(JSON.stringify({ type: 'deleteClan', clanId: game.clan }));
    console.log('📤 Отправлен запрос deleteClan:', game.clan);
  }
};
  
function updateClansUI() {
  const container = document.getElementById('clanList');
  const leaveBtn = document.getElementById('leaveClanBtn');
  const deleteBtn = document.getElementById('deleteClanBtn');
  const createBtn = document.getElementById('createClanBtn');
  const membersContainer = document.getElementById('clanMembersList');
  
  if (!container) return;
  
  // game.clan может быть null, строкой (clanId) или объектом
  const myClanId = game.clan ? (typeof game.clan === 'object' ? game.clan.id : String(game.clan)) : null;
  
  console.log(`🏰 updateClansUI: myClanId=${myClanId}, game.clan=${JSON.stringify(game.clan)}, clansList.length=${clansList.length}`);
  console.log(`  leaveBtn: ${!!leaveBtn}, deleteBtn: ${!!deleteBtn}, createBtn: ${!!createBtn}`);
  
  if (leaveBtn) leaveBtn.style.display = myClanId ? 'inline-block' : 'none';
  if (deleteBtn) deleteBtn.style.display = myClanId ? 'inline-block' : 'none';
  if (createBtn) createBtn.style.display = myClanId ? 'none' : 'inline-block';
  
  console.log(`  Кнопки: leave=${leaveBtn?.style.display}, delete=${deleteBtn?.style.display}, create=${createBtn?.style.display}`);
  
  container.innerHTML = '';
  
  if (!clansList || clansList.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:20px">Пока нет кланов. Создайте первый!</p>';
    if (membersContainer) membersContainer.innerHTML = '<p style="text-align:center;color:#888">Нет участников</p>';
    return;
  }

  clansList.forEach(clan => {
    const div = document.createElement('div');
    div.className = 'clan-item';
    
    const clanId = String(clan.id || '');
    const isMyClan = myClanId && myClanId === clanId;
    
    // console.log(`  🏰 Clan: ${clan.name}, id=${clanId}, isMyClan=${isMyClan}`);
    
    let actionBtn = '';
    if (isMyClan) {
      actionBtn = `<span style="color:#4caf50">✓ Ваш клан</span>`;
    } else {
      actionBtn = `<button onclick="joinClan('${clan.id}')">Вступить</button>`;
    }
    
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(clan.name)}</strong>
        <small>(${clan.memberCount || 0} участников)</small>
      </div>
      <div>${actionBtn}</div>
    `;
    container.appendChild(div);
  });
  
  // Обновляем участников клана если есть
  if (myClanId && window.updateClanMembersUI) {
    // Запрашиваем участников если не получали
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'getClanMembers' }));
    }
  } else if (membersContainer) {
    membersContainer.innerHTML = '<p style="text-align:center;color:#888">Вы не в клане</p>';
  }
}

window.updateClanMembersUI = function(members) {
  const container = document.getElementById('clanMembersList');
  if (!container) return;
  
  container.innerHTML = '';
  if (!members || members.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#888">Нет участников</p>';
    return;
  }

  // Проверяем что игрок всё ещё в клане
  const myClanId = typeof game.clan === 'object' ? game.clan?.id : game.clan;
  const tracking = game.skills?._clanTracking || {};
  const createdClanId = tracking.createdClanId;
  
  // Обновляем ownedClanMemberCount ТОЛЬКО если игрок владелец И в клане
  if (myClanId === createdClanId && members.some(m => m.id === window.currentUser?.id)) {
    // Игрок владелец созданного клана - обновляем количество участников
    const newCount = members.length;
    if (game.ownedClanMemberCount !== newCount) {
      game.ownedClanMemberCount = newCount;
      console.log(`👥 Обновлено ownedClanMemberCount: ${newCount}`);
      saveGame();
      // Проверяем достижения после обновления
      checkAchievements();
    }
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
  updateEventUI();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'addEventCoins', amount }));
  }
}

function updateEventUI() {
  const eventCoinsDisplay = document.getElementById('eventCoinsDisplay');
  if (eventCoinsDisplay) {
    eventCoinsDisplay.textContent = formatNumber(eventCoins);
  }
  
  const eventTimerEl = document.getElementById('eventTimer');
  
  // Используем eventEndTime если eventInfo ещё не загружен
  let endDate = eventInfo?.endDate;
  if (!endDate && window.eventEndTime) {
    endDate = Number(window.eventEndTime);
  }
  
  if (eventTimerEl && endDate) {
    const msLeft = Math.max(0, endDate - Date.now());
    const secondsLeft = Math.ceil(msLeft / 1000);
    if (secondsLeft > 60) {
      const minutesLeft = Math.ceil(secondsLeft / 60);
      eventTimerEl.textContent = `${minutesLeft} мин.`;
    } else {
      eventTimerEl.textContent = `${secondsLeft} сек.`;
    }
  }
  
  const eventTimerDisplay = document.getElementById('eventTimerDisplay');
  if (eventTimerDisplay && endDate) {
    const msLeft = Math.max(0, endDate - Date.now());
    const secondsLeft = Math.ceil(msLeft / 1000);
    if (secondsLeft > 60) {
      const minutesLeft = Math.ceil(secondsLeft / 60);
      eventTimerDisplay.textContent = `${minutesLeft} мин.`;
    } else {
      eventTimerDisplay.textContent = `${secondsLeft} сек.`;
    }
  }
  
  // Обновляем виджет ивента на главном экране
  const eventWidget = document.getElementById('eventWidget');
  const eventWidgetTimer = document.getElementById('eventWidgetTimer');
  if (eventWidget && eventWidgetTimer && endDate) {
    const msLeft = Math.max(0, endDate - Date.now());
    const secondsLeft = Math.ceil(msLeft / 1000);
    
    // Показываем виджет если ивент активен
    if (msLeft > 0) {
      eventWidget.classList.remove('hidden');
      
      if (secondsLeft > 60) {
        const minutesLeft = Math.ceil(secondsLeft / 60);
        eventWidgetTimer.textContent = `${minutesLeft} мин`;
      } else {
        eventWidgetTimer.textContent = `${secondsLeft} сек`;
      }
    } else {
      eventWidget.classList.add('hidden');
    }
  }
}
  
  const eventTimerEl = document.getElementById('eventTimer');
  if (eventTimerEl && eventInfo) {
    const msLeft = Math.max(0, eventInfo.endDate - Date.now());
    const secondsLeft = Math.ceil(msLeft / 1000);
    if (secondsLeft > 60) {
      const minutesLeft = Math.ceil(secondsLeft / 60);
      eventTimerEl.textContent = `${minutesLeft} мин.`;
    } else {
      eventTimerEl.textContent = `${secondsLeft} сек.`;
    }
  }
  
  const eventTimerDisplay = document.getElementById('eventTimerDisplay');
  if (eventTimerDisplay && eventInfo) {
    const msLeft = Math.max(0, eventInfo.endDate - Date.now());
    const secondsLeft = Math.ceil(msLeft / 1000);
    if (secondsLeft > 60) {
      const minutesLeft = Math.ceil(secondsLeft / 60);
      eventTimerDisplay.textContent = `${minutesLeft} мин.`;
    } else {
      eventTimerDisplay.textContent = `${secondsLeft} сек.`;
    }
  }


// Динамическое обновление таймера ивента каждую секунду
let eventTimerInterval = null;
function startEventTimer() {
  if (eventTimerInterval) clearInterval(eventTimerInterval);
  eventTimerInterval = setInterval(() => {
    if (eventInfo) {
      updateEventUI();
    }
  }, 1000);
}

function stopEventTimer() {
  if (eventTimerInterval) {
    clearInterval(eventTimerInterval);
    eventTimerInterval = null;
  }
}

// Запускаем таймер ивента сразу при загрузке (фоновый режим)
function initEventTimer() {
  // Запрашиваем данные ивента и запускаем таймер
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'getEventInfo' }));
  }
  
  // Инициализация eventEndTime если не загружен
  if (window.eventEndTime === undefined) {
    window.eventEndTime = localStorage.getItem('orca_event_endTime') || null;
  }
  
  startEventTimer();
}

function renderEventLeaderboard() {
  const container = document.getElementById('eventLeaderboard');
  if (!container || !eventInfo) return;
  
  const topPlayers = eventInfo.topPlayers || [];
  container.innerHTML = '';
  topPlayers.forEach((player, index) => {
    const medals = ['🥇', '🥈', '🥉'];
    
    // Улучшаем отображение имени - если это гость, показываем truncated ID
    let displayName = player.name;
    if (player.id) {
      // Если у игрока есть ID - показываем его
      if (displayName && displayName.startsWith('Player_')) {
        displayName = '👤 Guest_' + player.id.slice(-4);
      } else if (!displayName || displayName === 'Player') {
        displayName = '👤 Гость #' + player.id.slice(-4);
      }
    } else if (displayName && displayName.startsWith('Player_')) {
      displayName = '👤 Guest_' + displayName.slice(-4);
    } else if (!displayName || displayName === 'Player') {
      displayName = '👤 Гость ' + (index + 1);
    }
    
    const div = document.createElement('div');
    div.className = 'event-player';
    div.innerHTML = `
      <span>${medals[index] || `${index + 1}.`} ${escapeHtml(displayName)}</span>
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
  // Таймер уже запущен в фоне, не нужно запускать снова
}

// ==================== БОКСЫ ====================
let pendingBoxes = [];  // Catdrops
let isOpeningBox = false;
let activeBoxCutscene = null;
let currentBoxOpenTimeout = null;

// Переменные для Catdrop анимации
let catdropAnimation = null;
let catdropMouseDownTime = null;
let catdropScale = 1;
let catdropTargetScale = 1;
let catdropRarity = null;

function buyBox() {
  if (isOpeningBox) {
    console.log('⚠️ Покупка бокса отменена: уже открывается бокс');
    return;
  }

  const boxPrice = 8500;
  if (game.coins < boxPrice) {
    showNotification('❌ Недостаточно косаток');
    return;
  }

  console.log(`📦 Покупка бокса: баланс=${game.coins}, цена=${boxPrice}`);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'buyBox' }));
    console.log('📤 Отправлен запрос на покупку бокса');
  } else {
    console.error('❌ Нет соединения с сервером');
    showNotification('❌ Нет соединения с сервером');
  }
}
  
function openBox(boxId) {
  if (isOpeningBox) {
    console.log('⚠️ Открытие отменено: Catdrop уже открывается');
    return;
  }

  const boxIndex = pendingBoxes.indexOf(boxId);
  if (boxIndex === -1) {
    console.error('❌ Catdrop не найден!', { boxId, pendingBoxes });
    showNotification('⚠️ Catdrop не найден');
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('❌ Нет подключения к серверу!');
    showNotification('⚠️ Нет подключения к серверу');
    return;
  }
  
  // Сбрасываем старые состояния если есть
  if (currentBoxOpenTimeout) {
    clearTimeout(currentBoxOpenTimeout);
    currentBoxOpenTimeout = null;
  }
  if (catdropAnimation) {
    cancelAnimationFrame(catdropAnimation);
    catdropAnimation = null;
  }
  if (activeBoxCutscene) {
    activeBoxCutscene.remove();
    activeBoxCutscene = null;
  }
  
  // Сбрасываем переменные анимации
  catdropRarity = null;
  dataRewardFromServer = null;
  catdropMouseDownTime = null;
  catdropScale = 1;
  
  // Устанавливаем флаг СРАЗУ
  isOpeningBox = true;
  const openingBoxId = boxId;
  const openingBoxIndex = boxIndex;

  console.log('🎁 ОТКРЫТИЕ CATDROP:', { boxId, boxIndex, isOpeningBox });
  
  // Отправляем запрос на сервер
  ws.send(JSON.stringify({ type: 'openBox', boxId: openingBoxId }));

  // Показываем экран с Catdrop и ждём ответа от сервера
  showCatdropWaitingScreen();

  // Тайм-аут если сервер не ответит (30 секунд)
  if (currentBoxOpenTimeout) clearTimeout(currentBoxOpenTimeout);
  currentBoxOpenTimeout = setTimeout(() => {
    if (isOpeningBox) {
      console.error('⚠️ Тайм-аут открытия Catdrop!');
      stopCatdropWaitingScreen();
      
      // Возвращаем Catdrop в инвентарь
      if (pendingBoxes.indexOf(openingBoxId) === -1) {
        pendingBoxes.splice(openingBoxIndex, 0, openingBoxId);
      }
      
      // Сбрасываем все переменные
      isOpeningBox = false;
      currentBoxOpenTimeout = null;
      catdropRarity = null;
      dataRewardFromServer = null;
      catdropMouseDownTime = null;
      catdropAnimation = null;
      
      renderBoxes();
      updateBoxUI();
      showNotification('⚠️ Ошибка открытия. Catdrop возвращён. Попробуйте снова.');
    }
  }, 30000);
}

// ==================== CATDROP АНИМАЦИЯ ====================

let dataRewardFromServer = null;  // Храним награду от сервера

function showCatdropWaitingScreen() {
  // Удаляем старую если есть
  if (activeBoxCutscene) {
    activeBoxCutscene.remove();
    activeBoxCutscene = null;
  }
  
  // Удаляем все старые обработчики чтобы избежать дублирования
  document.removeEventListener('mouseup', stopCatdropHold);
  document.removeEventListener('touchend', stopCatdropHold);
  
  // Создаем контейнер для ожидания
  const cutscene = document.createElement('div');
  cutscene.className = 'catdrop-cutscene';
  cutscene.style.cssText = 'position: fixed; inset: 0; z-index: 20000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.9);';
  cutscene.innerHTML = `
    <div class="catdrop-cutscene-bg" style="position: absolute; inset: 0; background: radial-gradient(circle, #2c3e50 0%, #000000 100%);"></div>
    <div class="catdrop-container" style="position: relative; display: flex; flex-direction: column; align-items: center;">
      <div class="catdrop" id="catdropElement" style="opacity: 0.5; filter: grayscale(100%); transform: scale(1); cursor: pointer; transition: none;">
        <img src="catdrop.png" alt="Catdrop" style="width: 200px; height: 200px; display: block;">
      </div>
      <div class="catdrop-hint" style="margin-top: 30px; color: #fff; font-size: 18px; text-align: center;">🎁 Catdrop готов! Зажми чтобы открыть!</div>
    </div>
  `;
  document.body.appendChild(cutscene);
  activeBoxCutscene = cutscene;

  // Получаем элемент Catdrop
  const catdropEl = document.getElementById('catdropElement');
  if (!catdropEl) {
    console.error('❌ Не удалось найти catdropElement!');
    return;
  }
  
  // Удаляем старые обработчики с элемента
  const newCatdropEl = catdropEl.cloneNode(true);
  catdropEl.parentNode.replaceChild(newCatdropEl, catdropEl);
  
  // Добавляем новые обработчики для зажатия
  newCatdropEl.addEventListener('mousedown', startCatdropHold, { passive: false });
  newCatdropEl.addEventListener('touchstart', (e) => { 
    e.preventDefault();
    e.stopPropagation();
    startCatdropHold(e); 
  }, { passive: false });
  
  // Добавляем глобальные обработчики отпускания
  document.addEventListener('mouseup', stopCatdropHold, { passive: false });
  document.addEventListener('touchend', stopCatdropHold, { passive: false });
  
  console.log('✅ Catdrop waiting screen показан, обработчики установлены');
}

function stopCatdropWaitingScreen() {
  if (activeBoxCutscene) {
    activeBoxCutscene.remove();
    activeBoxCutscene = null;
  }
  
  document.removeEventListener('mouseup', stopCatdropHold);
  document.removeEventListener('touchend', stopCatdropHold);
}
  
function startCatdropAnimation() {
  // Обновляем существующий экран - убираем серый цвет и добавляем SVG
  const cutscene = activeBoxCutscene;
  if (!cutscene) return;
  
  // Проверяем есть ли уже SVG
  let catdropEl = document.getElementById('catdropElement');
  if (!catdropEl) return;
  
  // Проверяем есть ли уже SVG
  const existingSvg = catdropEl.querySelector('.catdrop-svg');
  if (!existingSvg) {
    // Добавляем SVG обводку
    const svgHTML = `
      <svg viewBox="0 0 200 200" class="catdrop-svg">
        <!-- Прогресс бар обводки -->
        <circle class="catdrop-progress-ring" cx="100" cy="100" r="90" 
          stroke="rgba(255,215,0,0.5)" stroke-width="6" fill="transparent"
          stroke-dasharray="565.48" stroke-dashoffset="565.48"
          style="transition: stroke-dashoffset 0.1s linear"/>
        <circle class="catdrop-progress-ring-bg" cx="100" cy="100" r="90" 
          stroke="rgba(255,255,255,0.1)" stroke-width="6" fill="transparent"/>
      </svg>
    `;
    
    // Вставляем SVG перед img
    const img = catdropEl.querySelector('img');
    if (img) {
      img.insertAdjacentHTML('beforebegin', svgHTML);
    }
  }
  
  // Убираем серый цвет
  catdropEl.style.opacity = '1';
  catdropEl.style.filter = 'none';
  
  const hint = document.querySelector('.catdrop-hint');
  if (hint) hint.textContent = 'Зажми чтобы открыть!';
}

function startCatdropHold(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Сбрасываем предыдущее состояние если было
  if (catdropAnimation) {
    cancelAnimationFrame(catdropAnimation);
    catdropAnimation = null;
  }
    
  catdropMouseDownTime = Date.now();
  catdropScale = 1;
  catdropTargetScale = 1.5;  // Максимальный масштаб
  
  const catdropEl = document.getElementById('catdropElement');
  if (!catdropEl) {
    console.error('❌ Catdrop элемент не найден!');
    return;
  }

  // Убеждаемся что элемент виден
  catdropEl.style.opacity = '1';
  catdropEl.style.pointerEvents = 'auto';
  
  // Запускаем анимацию увеличения
  catdropAnimation = requestAnimationFrame(catdropAnimationLoop);
  
  // Скрываем подсказку
  const hint = document.querySelector('.catdrop-hint');
  if (hint) hint.style.display = 'none';
  
  console.log('🖱️ Catdrop зажат, начало анимации');
}

function catdropAnimationLoop() {
  if (!catdropMouseDownTime || !catdropRarity) {
    // Если награда ещё не получена - просто анимируем зажатие
    const timeHeld = Date.now() - catdropMouseDownTime;
    
    // Получаем базовое время для редкости
    let baseTime = 2000;  // common = 2 сек
    if (catdropRarity === 'rare') baseTime = 4000;   // 4 сек
    else if (catdropRarity === 'epic') baseTime = 5000;   // 5 сек
    else if (catdropRarity === 'legendary') baseTime = 7000;  // 7 сек
    
    if (timeHeld < baseTime) {
      const progress = timeHeld / baseTime;
      
      // Замедление ближе к концу (ease-out эффект)
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      catdropScale = 1 + (easedProgress * 0.5);
      
      // Оптимизация: обновляем transform через CSS transition вместо каждого кадра
      const catdropEl = document.getElementById('catdropElement');
      if (catdropEl) {
        // Используем CSS transition для плавности
        catdropEl.style.transform = `scale(${catdropScale})`;
        
        // Обновляем прогресс бар обводки (только если элемент существует)
        const progressRing = catdropEl.querySelector('.catdrop-progress-ring');
        if (progressRing && timeHeld % 50 < 16) {  // Ограничиваем обновления до ~60 FPS
          const circumference = 2 * Math.PI * 90;
          const offset = circumference - (progress * circumference);
          progressRing.style.strokeDashoffset = offset;
        }
      }
      
      catdropAnimation = requestAnimationFrame(catdropAnimationLoop);
    }
    return;
  }

  // Если награда получена - анимируем раскрытие в зависимости от редкости
  const timeHeld = Date.now() - catdropMouseDownTime;
  
  // Получаем базовое время для редкости
  let baseTime = 2000;  // common = 2 сек
  if (catdropRarity === 'rare') baseTime = 4000;   // 4 сек
  else if (catdropRarity === 'epic') baseTime = 5000;   // 5 сек
  else if (catdropRarity === 'legendary') baseTime = 7000;  // 7 сек
  
  // Замедление ближе к концу
  if (timeHeld < baseTime && catdropScale < catdropTargetScale) {
    const progress = timeHeld / baseTime;
    const easedProgress = 1 - Math.pow(1 - progress, 2);
    catdropScale = 1 + (easedProgress * 0.5);
    
    const catdropEl = document.getElementById('catdropElement');
    if (catdropEl) {
      catdropEl.style.transform = `scale(${catdropScale}) rotate(${Math.sin(progress * Math.PI) * 10}deg)`;
      
      // Обновляем прогресс бар (ограничен до 60 FPS)
      const progressRing = catdropEl.querySelector('.catdrop-progress-ring');
      if (progressRing && timeHeld % 50 < 16) {
        const circumference = 2 * Math.PI * 90;
        const offset = circumference - (progress * circumference);
        progressRing.style.strokeDashoffset = offset;
      }
    }
    
    catdropAnimation = requestAnimationFrame(catdropAnimationLoop);
  } else {
    // Достигли максимального размера - показываем награду
    cancelAnimationFrame(catdropAnimation);
    catdropAnimation = null;
    
    const catdropEl = document.getElementById('catdropElement');
    if (catdropEl) {
      catdropEl.style.transition = 'transform 0.3s ease-out';
      catdropEl.style.transform = `scale(${catdropTargetScale})`;
    }
    
    // Небольшая задержка перед показом награды
    setTimeout(() => {
      if (catdropRarity && activeBoxCutscene) {
        showCatdropExplosion(catdropRarity);
        
        // Показываем награду после взрыва
        setTimeout(() => {
          // Применяем награду
          const reward = dataRewardFromServer;
          if (reward) {
            if (reward.type === 'skin') {
              game.skins[reward.skinId] = true;
              console.log(`🎨 Получен скин: ${reward.skinName}`);
            } else if (reward.type === 'visualEffect') {
              if (!game.effects) game.effects = {};
              game.effects[reward.effectId] = true;
              console.log(`✨ Получен эффект: ${reward.effectId}`);
            } else if (reward.type === 'coins' && Number.isFinite(reward.amount)) {
              game.coins += reward.amount;
              game.totalCoins += reward.amount;
              console.log(`💰 Получено: ${reward.amount} косаток`);
            } else if (reward.type === 'tempBuff') {
              activateTemporaryMultiplier(reward.mult, reward.duration);
            }
          }
          
          if (reward) {
            showCatdropReward(reward);
            // Оптимизация: НЕ вызываем renderBoxes(), просто обновляем счётчик
            updateBoxUI();
          } else {
            console.error('❌ Награда не получена от сервера!');
            showNotification('❌ Ошибка получения награды');
          }
          
          isOpeningBox = false;
          updateUI();
          // Оптимизация: отложенное сохранение чтобы не блокировать UI
          setTimeout(saveGame, 500);
        }, 500);
      } else {
        // Ошибка - нет редкости или анимации
        console.error('❌ Catdrop анимация прервана!');
        showNotification('⚠️ Ошибка открытия. Попробуйте снова.');
        isOpeningBox = false;
        stopCatdropAnimation();
      }
    }, 300);
  }
}
  
function stopCatdropHold(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  // Если анимация ещё не закончена - сбрасываем
  if (catdropAnimation) {
    cancelAnimationFrame(catdropAnimation);
    catdropAnimation = null;
    
    // Возвращаем Catdrop в исходное состояние
    const catdropEl = document.getElementById('catdropElement');
    if (catdropEl) {
      catdropEl.style.transition = 'transform 0.2s ease-out';
      catdropEl.style.transform = 'scale(1) rotate(0deg)';
    }
    
    // Сбрасываем переменные
    catdropMouseDownTime = null;
    catdropScale = 1;
    catdropTargetScale = 1.5;
    
    // Если награда ещё не получена - оставляем isOpeningBox = true
    // чтобы пользователь мог попробовать снова
    if (!dataRewardFromServer) {
      const hint = document.querySelector('.catdrop-hint');
      if (hint) hint.textContent = 'Отпусти и зажми снова!';
      setTimeout(() => {
        if (hint) hint.textContent = 'Зажми чтобы открыть!';
      }, 1500);
    } else {
      // Награда уже получена - ждём когда анимация завершится
      console.log('✅ Отпускание после получения награды');
    }
  }
}

function stopCatdropAnimation() {
  if (catdropAnimation) {
    cancelAnimationFrame(catdropAnimation);
    catdropAnimation = null;
  }
  
  if (activeBoxCutscene) {
    activeBoxCutscene.remove();
    activeBoxCutscene = null;
  }
  
  // Убираем обработчики
  document.removeEventListener('mouseup', stopCatdropHold);
  document.removeEventListener('touchend', stopCatdropHold);
  
  // Сбрасываем все переменные
  catdropMouseDownTime = null;
  catdropRarity = null;
  catdropScale = 1;
  catdropTargetScale = 1;
  dataRewardFromServer = null;
  isOpeningBox = false;  // КРИТИЧНО: сбрасываем флаг
  currentBoxOpenTimeout = null;
  
  console.log('✅ Catdrop анимация остановлена, isOpeningBox=false');
}

function showCatdropExplosion(rarity) {
  const catdropEl = document.getElementById('catdropElement');
  if (catdropEl) {
    catdropEl.style.transition = 'transform 0.1s ease-in, opacity 0.3s ease-in';
    catdropEl.style.transform = 'scale(2)';
    catdropEl.style.opacity = '0';
  }
  
  // Создаем эффект взрыва
  const cutscene = activeBoxCutscene;
  if (cutscene) {
    const bg = cutscene.querySelector('.catdrop-cutscene-bg');
    if (bg) {
      bg.style.transition = 'background 0.3s ease-out';
      
      const colors = {
        legendary: 'radial-gradient(circle, #ff6b6b 0%, #8b0000 70%)',
        epic: 'radial-gradient(circle, #a855f7 0%, #4a148c 70%)',
        rare: 'radial-gradient(circle, #3b82f6 0%, #0d47a1 70%)',
        common: 'radial-gradient(circle, #22c55e 0%, #1b5e20 70%)'
      };
      bg.style.background = colors[rarity] || colors.common;
    }
  }
  
  // Создаем частицы взрыва
  createExplosionParticles(rarity);
  
  // Звук взрыва
  playSound('bonusSound');
  
  // Добавляем мерцающие искры
  createSparkles(rarity);
  
  // Удаляем анимацию и показываем награду
  setTimeout(() => {
    if (activeBoxCutscene) {
      activeBoxCutscene.remove();
      activeBoxCutscene = null;
    }
    // Награда уже показана в handleOpenBoxResponse
  }, 500);
}

// Создание частиц взрыва
function createExplosionParticles(rarity) {
  const rect = document.getElementById('catdropElement')?.getBoundingClientRect();
  const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  
  // Оптимизация: уменьшаем количество частиц для производительности
  const particleCount = rarity === 'legendary' ? 50 : rarity === 'epic' ? 35 : rarity === 'rare' ? 25 : 15;
  
  const colors = {
    legendary: ['#ff6b6b', '#ffd700', '#ff8c00', '#ffffff', '#ff4500'],
    epic: ['#a855f7', '#ec4899', '#8b5cf6', '#ffffff', '#06b6d4'],
    rare: ['#3b82f6', '#06b6d4', '#0ea5e9', '#ffffff', '#22c55e'],
    common: ['#22c55e', '#84cc16', '#16a34a', '#ffffff', '#fbbf24']
  };
  
  // Добавляем стили анимации если их нет
  if (!document.getElementById('explosion-styles')) {
    const style = document.createElement('style');
    style.id = 'explosion-styles';
    style.textContent = `
      @keyframes explosionParticle {
        0% {
          transform: translate(0, 0) scale(1);
          opacity: 1;
        }
        100% {
          transform: translate(var(--tx), --ty) scale(0);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Создаём частицы с задержкой чтобы не блокировать UI
  for (let i = 0; i < particleCount; i++) {
    setTimeout(() => {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 10000;
        background: ${colors[rarity][Math.floor(Math.random() * colors[rarity].length)]};
        border-radius: 50%;
        width: ${3 + Math.random() * 6}px;
        height: ${3 + Math.random() * 6}px;
        left: ${centerX}px;
        top: ${centerY}px;
        box-shadow: 0 0 ${5 + Math.random() * 10}px currentColor;
        animation: explosionParticle ${0.5 + Math.random() * 0.5}s ease-out forwards;
      `;
      
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5);
      const velocity = 80 + Math.random() * 200;
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity;
      
      particle.style.setProperty('--tx', `${tx}px`);
      particle.style.setProperty('--ty', `${ty}px`);
      
      document.body.appendChild(particle);
      
      setTimeout(() => particle.remove(), 1500);
    }, i * 10);  // Задержка 10мс между частицами
  }
}
  
// Создание мерцающих искр
function createSparkles(rarity) {
  const rect = document.getElementById('catdropElement')?.getBoundingClientRect();
  const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  
  // Оптимизация: уменьшаем количество искр
  const sparkleCount = rarity === 'legendary' ? 25 : rarity === 'epic' ? 18 : rarity === 'rare' ? 12 : 8;
  
  // Добавляем стили анимации искр если их нет
  if (!document.getElementById('sparkle-styles')) {
    const style = document.createElement('style');
    style.id = 'sparkle-styles';
    style.textContent = `
      @keyframes sparkleFloat {
        0% {
          transform: translateY(0) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(-100px) rotate(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Создаём искры с большей задержкой чтобы не блокировать UI
  for (let i = 0; i < sparkleCount; i++) {
    setTimeout(() => {
      const sparkle = document.createElement('div');
      sparkle.textContent = '✨';
      sparkle.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 10000;
        font-size: ${12 + Math.random() * 15}px;
        left: ${centerX + (Math.random() - 0.5) * 300}px;
        top: ${centerY + (Math.random() - 0.5) * 300}px;
        animation: sparkleFloat ${0.8 + Math.random() * 0.5}s ease-out forwards;
        text-shadow: 0 0 15px currentColor;
      `;
      
      document.body.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 1500);
    }, i * 20);  // Задержка 20мс между искрами
  }
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
    document.getElementById('battleLobbyView').classList.remove('hidden');
    document.getElementById('battleLobbyView').classList.add('active');
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
    // Запрашиваем участников только если мы в клане
    const myClanId = game.clan ? (typeof game.clan === 'object' ? game.clan.id : String(game.clan)) : null;
    if (myClanId) {
      ws.send(JSON.stringify({ type: 'getClanMembers' }));
    }
  }
  if (id === 'eventModal') {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'getEventInfo' }));
    updateEventUI();
    renderEventLeaderboard();
  }
  if (id === 'effectsModal') renderEffects();
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById('modalOverlay').classList.remove('active');
  // Не останавливаем таймер - он работает постоянно в фоне
}

function switchShopTab(tab, btn) {
  // Скрываем все вкладки
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  // Скрываем все панели
  document.getElementById('shopUpgrades').style.display = 'none';
  document.getElementById('shopSkins').style.display = 'none';
  document.getElementById('shopBoxes').style.display = 'none';
  
  // Показываем нужную
  if (tab === 'upgrades') {
    document.getElementById('shopUpgrades').style.display = 'block';
    renderShop();
  } else if (tab === 'skins') {
    document.getElementById('shopSkins').style.display = 'block';
    renderSkins();
  } else if (tab === 'boxes') {
    document.getElementById('shopBoxes').style.display = 'block';
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
    console.log('🗑️ Сброс игры...');
    // Данные удаляются на сервере через API
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
      fish: game.fish || 0,
      effects: game.effects || {},
      skins: game.skins || {},
      currentSkin: game.currentSkin || 'normal',
      achievements: game.achievements || [],
      playTime: game.playTime || 0,
      pendingBoxes: pendingBoxes || [],
      shopItems: shopItems.map(i => ({ id: i.id, cost: i.cost })),
      questProgress: game.quests.map(q => ({ id: q.id, completed: q.completed })),
      dailyQuestDate: game.dailyQuestDate,
      dailyQuestIds: game.dailyQuestIds || [],
      clan: game.clan || null,
      // Добавляем поля для отслеживания кланов
      clansJoinedHistory: game.clansJoinedHistory || [],
      ownedClanMemberCount: game.ownedClanMemberCount || 0,
      skills: game.skills || {},
      updatedAt: game.updatedAt || Date.now(),
      // Путь к славе
      totalRankClicks: game.totalRankClicks || 0,
      currentRank: game.currentRank || 'novice',
      rankRewardsClaimed: game.rankRewardsClaimed || [],
      // Ежедневная серия
      lastLoginDate: game.lastLoginDate,
      loginStreak: game.loginStreak || 0,
      // Таймеры (сохраняем в localStorage для простоты)
      adLastView: localStorage.getItem('orca_ad_lastView'),
      adViewCount: localStorage.getItem('orca_ad_viewCount'),
      eventEndTime: localStorage.getItem('orca_event_endTime')
    }
  }));
}

function saveGame() {
  // Сохраняем daily streak в localStorage для оффлайн режима
  try {
    localStorage.setItem('orca_dailyLoginDate', game.lastLoginDate || null);
    localStorage.setItem('orca_loginStreak', game.loginStreak || 0);
  } catch (e) {
    console.warn('⚠️ Ошибка сохранения daily streak:', e);
  }
  
  // Сохраняем таймеры СРАЗУ в localStorage (не ждём сервера)
  try {
    if (window.adLastView !== undefined) localStorage.setItem('orca_ad_lastView', window.adLastView);
    if (window.adViewCount !== undefined) localStorage.setItem('orca_ad_viewCount', window.adViewCount);
    if (window.eventEndTime !== undefined) localStorage.setItem('orca_event_endTime', window.eventEndTime);
  } catch (e) {
    console.warn('⚠️ Ошибка сохранения таймеров:', e);
  }
  
  // Отправляем таймеры на сервер для долговременного хранения
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'saveTimers',
      adLastView: window.adLastView,
      adViewCount: window.adViewCount,
      eventEndTime: window.eventEndTime,
      lastLoginDate: game.lastLoginDate,
      loginStreak: game.loginStreak || 0
    }));
  }
  
  // Серверное сохранение (остальные данные)
  scheduleServerSave();
}

function loadGame() {
  // Загружаем daily streak из localStorage для оффлайн режима
  try {
    const savedDate = localStorage.getItem('orca_dailyLoginDate');
    const savedStreak = localStorage.getItem('orca_loginStreak');
    
    if (savedDate) game.lastLoginDate = savedDate;
    if (savedStreak) game.loginStreak = Number(savedStreak) || 0;
    
    console.log('📅 Локальный daily streak загружен:', { lastLoginDate: game.lastLoginDate, loginStreak: game.loginStreak });
  } catch (e) {
    console.warn('⚠️ Ошибка загрузки daily streak:', e);
  }
  
  // Данные загружаются с сервера при подключении
  console.log('🔄 Ожидание загрузки данных с сервера...');
  game.dailyProgress = { clicks: 0, coins: 0, playTime: 0 };
  initQuests();
  
  // Инициализация таймеров (будут перезаписаны с сервера при подключении)
  try {
    window.adLastView = localStorage.getItem('orca_ad_lastView') || null;
    window.adViewCount = Number(localStorage.getItem('orca_ad_viewCount')) || 0;
    window.eventEndTime = localStorage.getItem('orca_event_endTime') || null;
    console.log('⏱️ Таймеры инициализированы из localStorage:', { adLastView: window.adLastView, adViewCount: window.adViewCount, eventEndTime: window.eventEndTime });
  } catch (e) {
    console.warn('⚠️ Ошибка инициализации таймеров:', e);
  }
}

function resetGame() {
  if (confirm('Вы уверены? Весь прогресс будет потерян!')) {
    console.log('🗑️ Сброс игры...');
    // Данные удаляются на сервере через API
    location.reload();
  }
}

// Ручная функция для отладки
window.debugResetGame = function() {
  if (confirm('⚠️ DEBUG: Сброс всех данных?')) {
    console.log('🗑️ DEBUG: Полный сброс игры...');
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
  // Очищаем только bg-классы
  document.body.classList.remove('bg-ocean', 'bg-white', 'bg-dark', 'bg-sunny');
  document.body.classList.add(bgClass);
  document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  localStorage.setItem('bgClass', bgClass);
  
  // 🎨 Фон изменён на
}

function loadSettings() {
  const bgMusicEnabled = localStorage.getItem('bgMusicEnabled') === 'true';
  const sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false';
  const volume = localStorage.getItem('volume') || 50;
  const bgClass = localStorage.getItem('bgClass') || 'bg-sunny';
  
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

  // Загрузка настроек эффектов
  for (let i = 1; i <= 6; i++) {
    const effectId = `e${i}`;
    const toggle = document.getElementById(`effect_${effectId}_toggle`);
    if (toggle) {
      toggle.checked = localStorage.getItem(`effect_${effectId}_enabled`) !== 'false';
    }
  }
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
  
  // Инициализация UI ежедневной серии
  updateDailyStreakUI();
  
  // Явная привязка кнопок кланов
  const leaveClanBtn = document.getElementById('leaveClanBtn');
  const deleteClanBtn = document.getElementById('deleteClanBtn');
  const createClanBtn = document.getElementById('createClanBtn');
  
  if (leaveClanBtn) leaveClanBtn.onclick = () => window.leaveClan();
  if (deleteClanBtn) deleteClanBtn.onclick = () => window.deleteClan();
  if (createClanBtn) createClanBtn.onclick = () => window.createClan();
  
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

