// ==================== Яндекс Игры SDK ====================

let ysdk = null;
let yandexPlayer = null;

// Вспомогательная функция для получения даты (YYYY-MM-DD)
function getCurrentDateString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// Инициализация Яндекс SDK
function initYandexGames() {
  console.log('📺 Инициализация Яндекс Игр SDK...');
  
  if (typeof YaGames === 'undefined') {
    console.warn('⚠️ Яндекс SDK не загружен (локальный режим?)');
    return;
  }
  
  YaGames.init()
    .then(ysdkInstance => {
      console.log('✅ Яндекс Игры SDK инициализирован');
      ysdk = ysdkInstance;
      
      // Инициализация лидерамбоарда
      initYandexLeaderboard();
      
      // Показываем рекламу при загрузке (опционально)
      // showYandexAd('interstitial');
    })
    .catch(err => {
      console.error('❌ Ошибка инициализации Яндекс SDK:', err);
    });
}

// Показ рекламы с наградой (видео с вознаграждением)
function watchYandexAd() {
  if (!ysdk) {
    console.warn('⚠️ Яндекс SDK не инициализирован');
    // Для локального режима даем награду без рекламы
    giveAdReward();
    return;
  }
  
  // Проверка лимита: максимум 5 раз в день
  const adData = getAdLimitData();
  const today = getCurrentDateString();
  
  if (adData.date !== today) {
    // Новый день - сброс счетчика
    adData.count = 0;
    adData.date = today;
    saveAdLimitData(adData);
  }
  
  if (adData.count >= 5) {
    showNotification('⏰ Сегодня лимит рекламы исчерпан. Заходите завтра!');
    return;
  }
  
  // Проверка кулдауна: 30 минут между просмотрами
  if (adData.lastAd && Date.now() - adData.lastAd < 30 * 60 * 1000) {
    const remaining = Math.ceil((30 * 60 * 1000 - (Date.now() - adData.lastAd)) / 60000);
    showNotification(`⏳ Подождите ${remaining} мин. перед следующим просмотром`);
    return;
  }
  
  showNotification('📺 Запуск рекламы...');
  
  // Используем rewarded video вместо интерстишиала
  ysdk.adv.showRewardedVideo({
    callbacks: {
      onOpen: () => {
        console.log('📺 Открытие видеорекламы');
      },
      onRewarded: () => {
        console.log('✅ Награда за рекламу');
        // Увеличиваем счетчик
        adData.count++;
        adData.lastAd = Date.now();
        saveAdLimitData(adData);
        giveAdReward();
      },
      onClose: () => {
        console.log('📺 Закрытие видеорекламы');
      },
      onError: (e) => {
        console.error('❌ Ошибка видеорекламы:', e);
        showNotification('❌ Не удалось показать рекламу');
      }
    }
  });
}

function getAdLimitData() {
  try {
    const data = localStorage.getItem('orca_ad_limits');
    return data ? JSON.parse(data) : { date: null, count: 0, lastAd: 0 };
  } catch (e) {
    return { date: null, count: 0, lastAd: 0 };
  }
}

function saveAdLimitData(data) {
  try {
    localStorage.setItem('orca_ad_limits', JSON.stringify(data));
  } catch (e) {
    console.warn('⚠️ Ошибка сохранения лимитов рекламы:', e);
  }
}

// Выдача награды за рекламу
function giveAdReward() {
  const level = game.level || 1;
  const rewardCoins = 1000 * level;
  
  // Даем награду
  game.coins += rewardCoins;
  
  // Сохраняем
  saveGame();
  
  // Отправляем на сервер
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'updateScore',
      coins: game.coins,
      perClick: game.perClick,
      perSecond: game.perSecond
    }));
  }
  
  // Показываем награду
  showAdRewardModal(rewardCoins);
  
  // Сохраняем прогресс в Яндекс Облако
  saveYandexProgress();
}

// Модальное окно награды за рекламу
function showAdRewardModal(amount) {
  const modal = document.createElement('div');
  modal.className = 'daily-reward-modal';
  modal.innerHTML = `
    <div class="daily-reward-overlay"></div>
    <div class="daily-reward-content">
      <div class="daily-reward-icon">📺</div>
      <h2 class="daily-reward-title">Спасибо за просмотр!</h2>
      <div class="daily-reward-streak">
        <span class="streak-fire">💰</span>
        <span class="streak-days">Награда</span>
      </div>
      <div class="daily-reward-amount">
        +${formatNumber(amount)} 🐋
      </div>
      <div class="daily-reward-next">
        Смотреть рекламу можно каждые 30 минут<br>
        <small>Максимум 5 раз в день</small>
      </div>
      <button class="daily-reward-btn" onclick="this.closest('.daily-reward-modal').remove()">Забрать</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  setTimeout(() => {
    modal.classList.add('show');
    playSound('bonusSound');
  }, 100);
}

// Инициализация лидерборда Яндекс
async function initYandexLeaderboard() {
  if (!ysdk) return;
  
  try {
    // Получаем или создаем лидерборд
    // В разных версиях SDK API может отличаться (getLeaderboard может быть недоступен)
    if (typeof ysdk.getLeaderboard !== 'function') {
      console.warn('⚠️ В текущем SDK ysdk.getLeaderboard не доступен — пропускаю инициалицию лидборда');
      return;
    }

    const lb = await ysdk.getLeaderboard();
    console.log('✅ Лидерборд Яндекс готов');
  } catch (err) {
    console.error('❌ Ошибка лидерборда Яндекс:', err);
  }
}

// Сохранение прогресса в Яндекс Облако
async function saveYandexProgress() {
  if (!ysdk || !yandexPlayer) {
    console.log('⚠️ Не могу сохранить в облако: SDK или Player не инициализирован');
    return;
  }
  
  try {
    const data = {
      coins: game.coins,
      totalCoins: game.totalCoins,
      perClick: game.perClick,
      perSecond: game.perSecond,
      clicks: game.clicks,
      level: game.level,
      lastLoginDate: game.lastLoginDate,
      loginStreak: game.loginStreak
    };
    
    await yandexPlayer.setData(data);
    console.log('☁️ Прогресс сохранен в Яндекс Облако');
  } catch (err) {
    console.error('❌ Ошибка сохранения в Яндекс Облако:', err);
  }
}

// Загрузка прогресса из Яндекс Облака
async function loadYandexProgress() {
  if (!ysdk || !yandexPlayer) {
    console.log('⚠️ Не могу загрузить из облака: SDK или Player не инициализирован');
    return null;
  }
  
  try {
    const data = await yandexPlayer.getData();
    console.log('☁️ Прогресс загружен из Яндекс Облака:', data);
    return data;
  } catch (err) {
    console.error('❌ Ошибка загрузки из Яндекс Облака:', err);
    return null;
  }
}

// Показ интерстишиал рекламы (полноэкранной)
function showInterstitialAd() {
  if (!ysdk) return Promise.resolve();
  
  return new Promise((resolve) => {
    ysdk.adv.showFullscreenAdv({
      callbacks: {
        onClose: function(wasShown) {
          resolve();
        },
        onError: function(error) {
          console.error('❌ Ошибка интерстишиал рекламы:', error);
          resolve();
        }
      }
    });
  });
}

// Показ вознаграждаемой рекламы (с наградой)
function showRewardedAd() {
  if (!ysdk) {
    console.warn('⚠️ Яндекс SDK не инициализирован');
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => {
          console.log('📺 Открытие видеорекламы');
          // Пауза игры
        },
        onRewarded: () => {
          console.log('✅ Награда за рекламу');
          giveAdReward();
          resolve(true);
        },
        onClose: () => {
          console.log('📺 Закрытие видеорекламы');
          // Возобновление игры
        },
        onError: (e) => {
          console.error('❌ Ошибка видеорекламы:', e);
          resolve(false);
        }
      }
    });
  });
}

// Установка лидера в Яндекс Лидерборд
async function setYandexLeaderboardScore(score) {
  if (!ysdk) return;
  
  try {
    if (typeof ysdk.getLeaderboard !== 'function') {
      console.warn('⚠️ В текущем SDK ysdk.getLeaderboard не доступен — пропускаю обновление лидера');
      return;
    }

    const lb = await ysdk.getLeaderboard();
    if (!lb?.setLeaderboardScore) {
      console.warn('⚠️ lb.setLeaderboardScore недоступен в текущем SDK — пропускаю');
      return;
    }

    lb.setLeaderboardScore('main', score);
    console.log('🏆 Лидерборд обновлен:', score);
  } catch (err) {
    console.error('❌ Ошибка обновления лидерборда:', err);
  }
}

// Получение игрока Яндекс
function initYandexPlayer() {
  if (!ysdk) {
    console.warn('⚠️ Яндекс SDK не инициализирован');
    return;
  }
  
  ysdk.getPlayer()
    .then(player => {
      yandexPlayer = player;
      console.log('✅ Игрок Яндекс инициализирован');
      
      // Загружаем прогресс из облака
      loadYandexProgress().then(data => {
        if (data && data.coins !== undefined) {
          console.log('☁️ Облачные данные загружены, синхронизация...');
          // Синхронизация с локальными данными
        }
      });
    })
    .catch(err => {
      console.error('❌ Ошибка инициализации игрока:', err);
    });
}

// Скрываем/показываем рекламу в зависимости от платформы
function isYandexGamesPlatform() {
  return typeof YaGames !== 'undefined';
}

// Обновление UI награды за рекламу
function updateAdRewardUI() {
  const adRewardAmount = document.getElementById('adRewardAmount');
  if (adRewardAmount) {
    const level = game.level || 1;
    const reward = 1000 * level;
    adRewardAmount.textContent = '+' + formatNumber(reward);
  }
}

// Автоматическая инициализация при загрузке
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initYandexGames);
} else {
  initYandexGames();
}

// Обновляем UI при изменении уровня
const originalUpdateUI = typeof updateUI === 'function' ? updateUI : null;
if (originalUpdateUI) {
  window.updateUI = function() {
    originalUpdateUI();
    updateAdRewardUI();
  };
}

// Сохраняем при закрытии вкладки
window.addEventListener('beforeunload', () => {
  if (isYandexGamesPlatform()) {
    saveYandexProgress();
  }
});
