// ==================== СИСТЕМА АККАУНТОВ ====================

window.currentUser = null;
window.isGuest = true; // По умолчанию играем как гость

// Восстанавливаем состояние из localStorage
try {
  const savedUser = localStorage.getItem('orca_user');
  if (savedUser) {
    window.currentUser = JSON.parse(savedUser);
    window.isGuest = false;
    console.log('👤 Восстановлен аккаунт из localStorage:', window.currentUser.username);
  }
} catch (e) {
  console.warn('⚠️ Ошибка восстановления аккаунта:', e);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  // Никогда не показываем экран авторизации автоматически!
  // Игрок сразу начинает в гостевом режиме
  startGameAsGuest();
  setupAuthListeners();
});

// Запуск игры в гостевом режиме
function startGameAsGuest() {
  window.isGuest = true;
  window.currentUser = null;
  console.log('👤 Игра началась в гостевом режиме');
  
  // Скрываем экран авторизации если есть
  closeAuthScreen();
  
  // Обновляем отображение
  updateAccountDisplay();
  
  // Показываем уведомление о преимуществах авторизации (необязательно)
  showGuestModeNotification();
}

// Уведомление о преимуществах авторизации
function showGuestModeNotification() {
  // Создаём плавающее уведомление с кнопкой "Узнать больше"
  const notification = document.createElement('div');
  notification.id = 'guestModeNotification';
  notification.className = 'guest-mode-notification';
  notification.innerHTML = `
    <div class="guest-mode-content">
      <div class="guest-mode-icon">💾</div>
      <div class="guest-mode-text">
        <strong>Вы играете в гостевом режиме</strong>
        <p>Прогресс сохранится только на этом устройстве</p>
      </div>
      <button class="guest-mode-btn" onclick="showAuthModal()">Узнать больше</button>
      <button class="guest-mode-close" onclick="document.getElementById('guestModeNotification').remove()">×</button>
    </div>
  `;
  
  // Добавляем только если его ещё нет
  if (!document.getElementById('guestModeNotification')) {
    document.body.appendChild(notification);
    
    // Автоматически скрываем через 10 секунд
    setTimeout(() => {
      const notif = document.getElementById('guestModeNotification');
      if (notif) {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 300);
      }
    }, 10000);
  }
}

// Показать модальное окно с информацией об авторизации
function showAuthModal() {
  // Удаляем старое модальное окно если есть
  const oldModal = document.querySelector('.auth-info-modal');
  if (oldModal) oldModal.remove();
  
  const modal = document.createElement('div');
  modal.className = 'auth-info-modal';
  modal.innerHTML = `
    <div class="auth-info-overlay"></div>
    <div class="auth-info-content">
      <button class="auth-info-close" onclick="this.closest('.auth-info-modal').remove()">×</button>
      
      <div class="auth-info-header">
        <div class="auth-info-icon">👤</div>
        <h2>Авторизация в игре</h2>
      </div>
      
      <div class="auth-info-body">
        <p class="auth-info-intro">
          Вы можете создать аккаунт, чтобы сохранить прогресс и получить дополнительные возможности!
        </p>
        
        <div class="auth-info-benefits">
          <h3>✨ Преимущества авторизации:</h3>
          
          <div class="auth-info-benefit">
            <div class="benefit-icon">💾</div>
            <div class="benefit-text">
              <strong>Облачное сохранение</strong>
              <p>Ваш прогресс будет сохраняться автоматически и доступен на любом устройстве</p>
            </div>
          </div>
          
          <div class="auth-info-benefit">
            <div class="benefit-icon">🎁</div>
            <div class="benefit-text">
              <strong>Ежедневные награды</strong>
              <p>Получайте бонусы за ежедневный вход и сохраняйте серию даже после смены устройства</p>
            </div>
          </div>
          
          <div class="auth-info-benefit">
            <div class="benefit-icon">🏆</div>
            <div class="benefit-text">
              <strong>Участие в лидерборде</strong>
              <p>Соревнуйтесь с другими игроками и становитесь лучшими!</p>
            </div>
          </div>
          
          <div class="auth-info-benefit">
            <div class="benefit-icon">👥</div>
            <div class="benefit-text">
              <strong>Кланы и PvP баттлы</strong>
              <p>Создавайте кланы, вступайте в команды и сражайтесь с другими игроками онлайн</p>
            </div>
          </div>
          
          <div class="auth-info-benefit">
            <div class="benefit-icon">🎮</div>
            <div class="benefit-text">
              <strong>Участие в событиях</strong>
              <p>Получайте доступ к специальным ивентам и сезонным наградам</p>
            </div>
          </div>
        </div>
        
        <div class="auth-info-actions">
          <button class="auth-info-btn-primary" onclick="showAuthForms()">
            Создать аккаунт
          </button>
          <button class="auth-info-btn-secondary" onclick="this.closest('.auth-info-modal').remove()">
            Продолжить без аккаунта
          </button>
        </div>
        
        <p class="auth-info-note">
          💡 Вы можете создать аккаунт в любой момент во время игры!
        </p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
}

// Показать формы входа/регистрации
function showAuthForms() {
  const modal = document.querySelector('.auth-info-modal');
  if (modal) modal.remove();
  
  // Создаём экран авторизации если его нет
  let authScreen = document.getElementById('authScreen');
  if (!authScreen) {
    authScreen = document.createElement('div');
    authScreen.id = 'authScreen';
    authScreen.className = 'auth-screen active';
    authScreen.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <h1>🐋 Косатка Клик</h1>
            <p>Сохраняй свой прогресс в аккаунте</p>
          </div>
          
          <div id="authForms">
            <!-- Форма входа -->
            <form id="loginForm" class="auth-form active">
              <h2>Вход в Аккаунт</h2>
              <div class="form-group">
                <label for="loginUsername">Имя пользователя:</label>
                <input type="text" id="loginUsername" placeholder="Введите имя" required>
              </div>
              <div class="form-group">
                <label for="loginPassword">Пароль:</label>
                <input type="password" id="loginPassword" placeholder="Введите пароль" required>
              </div>
              <button type="submit" class="auth-btn">Войти</button>
              <p class="auth-toggle">Нет аккаунта? <a href="#" onclick="toggleAuthForms()">Создать</a></p>
              <div id="authError" class="auth-error" style="display: none;"></div>
            </form>
            
            <!-- Форма регистрации -->
            <form id="registerForm" class="auth-form">
              <h2>Создать Аккаунт</h2>
              <div class="form-group">
                <label for="regUsername">Имя пользователя:</label>
                <input type="text" id="regUsername" placeholder="3-16 символов" required minlength="3" maxlength="16">
              </div>
              <div class="form-group">
                <label for="regPassword">Пароль:</label>
                <input type="password" id="regPassword" placeholder="Минимум 4 символа" required minlength="4">
              </div>
              <div class="form-group">
                <label for="regPasswordConfirm">Повторить пароль:</label>
                <input type="password" id="regPasswordConfirm" placeholder="Повторите пароль" required>
              </div>
              <button type="submit" class="auth-btn">Создать</button>
              <p class="auth-toggle">Уже есть аккаунт? <a href="#" onclick="toggleAuthForms()">Войти</a></p>
              <div id="authError" class="auth-error" style="display: none;"></div>
            </form>
            
            <!-- Форма пропуска (локальная игра) -->
            <div class="auth-form auth-guest">
              <h2>Или продолжи без аккаунта</h2>
              <p style="margin-bottom: 20px; opacity: 0.8;">Прогресс сохранится только локально на этом устройстве</p>
              <button onclick="closeAuthScreen()" class="auth-btn-guest">Играть без аккаунта</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(authScreen);
  }
  
  authScreen.classList.add('active');
  authScreen.style.display = 'flex';
  
  // Убедимся что форма входа активна
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm) loginForm.classList.add('active');
  if (registerForm) registerForm.classList.remove('active');
  
  // Очистить ошибки
  document.querySelectorAll('.auth-error').forEach(err => err.style.display = 'none');
  
  // УСТАНОВКА СЛУШАТЕЛЕЙ (теперь когда формы существуют!)
  if (loginForm) {
    // Удаляем старые слушители если есть
    const newLoginForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newLoginForm, loginForm);
    
    newLoginForm.addEventListener('submit', (e) => {
      console.log('🛡️ submit event для loginForm');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('🔐 Вызываю handleLogin()');
      handleLogin();
      return false;
    });
    
    console.log('✅ Слушатель для loginForm установлен');
  }
  
  if (registerForm) {
    // Удаляем старые слушители если есть
    const newRegisterForm = registerForm.cloneNode(true);
    registerForm.parentNode.replaceChild(newRegisterForm, registerForm);
    
    newRegisterForm.addEventListener('submit', (e) => {
      console.log('🛡️ submit event для registerForm');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('🔐 Вызываю handleRegister()');
      handleRegister();
      return false;
    });
    
    console.log('✅ Слушатель для registerForm установлен');
  }
}

// Показ экрана авторизации
function showAuthScreen() {
  let authScreen = document.getElementById('authScreen');
  if (!authScreen) {
    // Создаём если нет
    authScreen = document.createElement('div');
    authScreen.id = 'authScreen';
    authScreen.className = 'auth-screen';
    document.body.appendChild(authScreen);
  }
  
  authScreen.classList.add('active');
  authScreen.style.display = 'flex';
  
  // Убедимся что форма входа активна
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm) loginForm.classList.add('active');
  if (registerForm) registerForm.classList.remove('active');
  
  // Очистить ошибки
  document.querySelectorAll('.auth-error').forEach(err => err.style.display = 'none');
  
  // УСТАНОВКА СЛУШАТЕЛЕЙ
  if (loginForm && !loginForm.hasAttribute('data-listener')) {
    loginForm.setAttribute('data-listener', 'true');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleLogin();
      return false;
    });
  }
  
  if (registerForm && !registerForm.hasAttribute('data-listener')) {
    registerForm.setAttribute('data-listener', 'true');
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleRegister();
      return false;
    });
  }
}

// Закрыть экран авторизации
function closeAuthScreen() {
  const authScreen = document.getElementById('authScreen');
  if (authScreen) {
    authScreen.classList.remove('active');
    authScreen.style.display = 'none';
  }
}

// Установка слушателей
function setupAuthListeners() {
  console.log('🔧 setupAuthListeners вызван (заглушка)');
  // Слушатели будут установлены в showAuthForms() когда формы появятся
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
    
    // Убедимся что слушатели установлены
    if (loginForm && !loginForm.hasAttribute('data-listener')) {
      loginForm.setAttribute('data-listener', 'true');
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
        return false;
      });
    }
    
    if (registerForm && !registerForm.hasAttribute('data-listener')) {
      registerForm.setAttribute('data-listener', 'true');
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleRegister();
        return false;
      });
    }
  }
}

// Обработка входа
function handleLogin() {
  const username = document.getElementById('loginUsername')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  
  console.log('🔐 handleLogin вызван');
  console.log('👤 Username:', username);
  console.log('🔑 Password length:', password?.length);
  
  if (!username || !password) {
    console.error('❌ Пустые данные');
    showAuthError('Заполните все поля');
    return;
  }
  
  if (password.length < 4) {
    console.error('❌ Пароль слишком короткий');
    showAuthError('Пароль минимум 4 символа');
    return;
  }
  
  console.log('📤 Отправка на сервер...');
  console.log('WebSocket state:', window.ws?.readyState);
  
  // Отправляем на WebSocket сервер
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    // Блокируем кнопку чтобы не было двойного клика
    const forms = document.querySelectorAll('.auth-form.active button');
    forms.forEach(btn => {
      btn.disabled = true;
      console.log('🔒 Кнопка заблокирована');
    });
    
    const authMessage = {
      type: 'authRequest',
      username,
      password
    };
    
    console.log('📨 Отправляем:', authMessage);
    ws.send(JSON.stringify(authMessage));
    console.log('✅ Сообщение отправлено');
  } else {
    console.error('❌ WebSocket не подключён!');
    showAuthError('Ошибка подключения к серверу');
    forms?.forEach(btn => btn.disabled = false);
  }
}

// Обработка регистрации
function handleRegister() {
  const username = document.getElementById('regUsername')?.value.trim();
  const password = document.getElementById('regPassword')?.value;
  const confirmPassword = document.getElementById('regPasswordConfirm')?.value;
  
  if (!username || !password || !confirmPassword) {
    showAuthError('Заполните все поля');
    return;
  }
  
  if (username.length < 3 || username.length > 16) {
    showAuthError('Имя пользователя: 3-16 символов');
    return;
  }
  
  if (password.length < 4) {
    showAuthError('Пароль минимум 4 символа');
    return;
  }
  
  if (password !== confirmPassword) {
    showAuthError('Пароли не совпадают');
    return;
  }
  
  // Отправляем на WebSocket сервер
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    // Блокируем кнопку чтобы не было двойного клика
    const forms = document.querySelectorAll('.auth-form.active button');
    forms.forEach(btn => btn.disabled = true);
    
    ws.send(JSON.stringify({
      type: 'register',
      username,
      password
    }));
  } else {
    showAuthError('Ошибка подключения к серверу');
    forms?.forEach(btn => btn.disabled = false);
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
  const logoutBtn = document.getElementById('logoutBtn');
  const authBtnSmall = document.getElementById('authBtnSmall');
  
  console.log('👤 updateAccountDisplay:', {
    currentUser: window.currentUser,
    isGuest: window.isGuest,
    guestId: guestId,
    accountNameDisplay: !!accountNameDisplay,
    logoutBtn: !!logoutBtn,
    authBtnSmall: !!authBtnSmall
  });
  
  if (accountNameDisplay) {
    if (window.currentUser && window.currentUser.username) {
      accountNameDisplay.textContent = `👤 ${window.currentUser.username}`;
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      if (authBtnSmall) authBtnSmall.style.display = 'none';
    } else if (window.isGuest) {
      // Показываем guestId вместо "Гость"
      const guestName = guestId ? guestId.slice(-8) : 'Гость';
      accountNameDisplay.textContent = `👤 Гость ${guestName}`;
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (authBtnSmall) authBtnSmall.style.display = 'inline-block';
    } else {
      accountNameDisplay.textContent = '👤 Неизвестный';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (authBtnSmall) authBtnSmall.style.display = 'inline-block';
    }
  }
}
    
// Выход из аккаунта
function logout() {
  if (window.isGuest) {
    showNotification('👤 Вы играете в гостевом режиме');
    return;
  }
  
  if (confirm('Вы уверены что хотите выйти?')) {
    // Сохраняем прогресс перед выходом
    if (window.ws && window.ws.readyState === WebSocket.OPEN && window.currentUser) {
      saveGameData();
    }
    
    // Очищаем сессию
    window.currentUser = null;
    window.isGuest = true;
    
    // Возвращаемся в игру
    closeAuthScreen();
    
    // Очищаем формы
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (loginForm) loginForm.classList.add('active');
    if (registerForm) registerForm.classList.remove('active');
    
    // Обновляем отображение
    updateAccountDisplay();
    
    console.log('👤 Вы вернулись в гостевой режим');
    showNotification('👤 Вы играете в гостевом режиме');
  }
}

// Выход из гостевого режима (удаление guestId)
function exitGuestMode() {
  if (!window.isGuest) return;
  
  if (confirm('Вы хотите перейти в режим аккаунта? Гостевой прогресс может быть потерян.')) {
    // Удаляем guestId
    try {
      localStorage.removeItem('orca_guest_id');
    } catch (e) {
      console.warn('⚠️ Ошибка удаления guestId:', e);
    }
    
    // Обновляем состояние
    window.isGuest = false;
    window.currentUser = null;
    
    // Перезагружаем страницу чтобы переподключиться с новым аккаунтом
    window.location.reload();
  }
}

// Экспорт в global scope
window.exitGuestMode = exitGuestMode;

// Сохранение игровых данных на сервер
function saveGameData() {
  if (!window.currentUser || !window.ws || window.ws.readyState !== WebSocket.OPEN) return;
  
  if (typeof game === 'undefined') return;
  
  ws.send(JSON.stringify({
    type: 'savePlayerData',
    accountId: window.currentUser.id,
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
  if (window.currentUser && !window.isGuest) {
    saveGameData();
  }
}, 30000);

// Сохранение перед закрытием вкладки
window.addEventListener('beforeunload', () => {
  if (window.currentUser && !window.isGuest) {
    saveGameData();
  }
});

// Блокируем случайную перезагрузку страницы
window.addEventListener('DOMContentLoaded', () => {
  // Проверяем есть ли другие обработчики form submit
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      if (form.id === 'loginForm' || form.id === 'registerForm') {
        console.log('🛡️ Защитный блок формы:', form.id);
      }
    }, true);
  });
});

// Отключаем location.reload() для отладки
const originalReload = window.location.reload;
window.location.reload = function() {
  console.error('⛔ ПЫТАЮТСЯ ПЕРЕЗАГРУЗИТЬ СТРАНИЦУ!');
  console.trace('Стек вызовов reload()');
  // originalReload.call(window.location); // Раскомментируйте если нужно разрешить
};

