// ==================== СИСТЕМА АККАУНТОВ ====================

let currentUser = null;
let isGuest = false;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  setupAuthListeners();
});

// Проверка статуса аутентификации
function checkAuthStatus() {
  const authScreen = document.getElementById('authScreen');
  const gameScreen = document.getElementById('gameScreen');
  
  // Сессия теперь только в памяти, всегда показываем экран входа
  console.log('🔐 Ожидание входа в аккаунт...');
}

// Установка слушателей
function setupAuthListeners() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }
  
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }
}

// Переключение формы входа/регистрации
function toggleAuthForms() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  if (loginForm && registerForm) {
    loginForm.classList.toggle('active');
    registerForm.classList.toggle('active');
    
    // Очистка ошибок
    const errors = document.querySelectorAll('.auth-error');
    errors.forEach(err => err.style.display = 'none');
  }
}

// Обработка входа
function handleLogin() {
  const isRegister = document.getElementById('registerForm')?.classList.contains('active');
  
  let username, password;
  
  if (isRegister) {
    username = document.getElementById('regUsername')?.value.trim();
    password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regPasswordConfirm')?.value;
    
    if (password !== confirmPassword) {
      showAuthError('Пароли не совпадают');
      return;
    }
  } else {
    username = document.getElementById('loginUsername')?.value.trim();
    password = document.getElementById('loginPassword')?.value;
  }
  
  if (!username || !password) {
    showAuthError('Заполните все поля');
    return;
  }
  
  if (password.length < 4) {
    showAuthError('Пароль минимум 4 символа');
    return;
  }
  
  // Отправляем на WebSocket сервер
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'authRequest',
      username,
      password
    }));
  } else {
    showAuthError('Ошибка подключения к серверу');
  }
}

// Показать ошибку
function showAuthError(message) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  const activeForm = loginForm?.classList.contains('active') ? loginForm : registerForm;
  const errorDiv = activeForm?.querySelector('.auth-error');
  
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

// Переход на экран игры
function showGameScreen() {
  const authScreen = document.getElementById('authScreen');
  const gameScreen = document.getElementById('gameScreen');
  
  if (authScreen && gameScreen) {
    authScreen.classList.remove('active');
    gameScreen.classList.add('active');
  }
  
  updateAccountDisplay();
}

// Обновление отображения аккаунта
function updateAccountDisplay() {
  const accountNameDisplay = document.getElementById('accountNameDisplay');
  
  if (accountNameDisplay) {
    if (currentUser && currentUser.username) {
      accountNameDisplay.textContent = `👤 ${currentUser.username}`;
    } else if (isGuest) {
      accountNameDisplay.textContent = '👤 Гость';
    } else {
      accountNameDisplay.textContent = '👤 Неизвестный';
    }
  }
}

// Выход из аккаунта
function logout() {
  if (confirm('Вы уверены что хотите выйти?')) {
    // Сохраняем прогресс перед выходом
    if (window.ws && window.ws.readyState === WebSocket.OPEN && currentUser) {
      saveGameData();
    }
    
    // Очищаем сессию
    currentUser = null;
    isGuest = false;
    
    // Возвращаемся на экран входа
    const authScreen = document.getElementById('authScreen');
    const gameScreen = document.getElementById('gameScreen');
    
    if (authScreen && gameScreen) {
      gameScreen.classList.remove('active');
      authScreen.classList.add('active');
    }
    
    // Очищаем формы
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (loginForm) loginForm.classList.add('active');
    if (registerForm) registerForm.classList.remove('active');
    
    console.log('👋 Вы вышли из аккаунта');
    showNotification('👋 Вы вышли из аккаунта');
  }
}

// Игра без аккаунта
function playAsGuest() {
  isGuest = true;
  currentUser = null;
  console.log('👤 Игра в режиме Гостя (без синхронизации)');
  showGameScreen();
}

// Сохранение игровых данных на сервер
function saveGameData() {
  if (!currentUser || !window.ws || window.ws.readyState !== WebSocket.OPEN) return;
  
  if (typeof game === 'undefined') return;
  
  ws.send(JSON.stringify({
    type: 'savePlayerData',
    accountId: currentUser.id,
    gameData: {
      coins: Math.floor(game.coins),
      totalCoins: Math.floor(game.totalCoins),
      level: game.level,
      perClick: game.perClick,
      perSecond: game.perSecond,
      clicks: game.clicks,
      skills: game.skills,
      achievements: game.achievements,
      skins: game.skins,
      currentSkin: game.currentSkin,
      playTime: game.playTime,
      multiplier: game.multiplier,
      questsProgress: game.questsProgress
    }
  }));
}

// Автосохранение каждые 30 секунд
setInterval(() => {
  if (currentUser && !isGuest) {
    saveGameData();
  }
}, 30000);

// Сохранение перед закрытием вкладки
window.addEventListener('beforeunload', () => {
  if (currentUser && !isGuest) {
    saveGameData();
  }
});

// Функция уведомления
if (typeof showNotification === 'undefined') {
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
}
