#!/usr/bin/env node
// ==================== Rate Limiting Middleware ====================

const rateLimit = require('express-rate-limit');

// Конфигурация rate limiting (оптимизированная для игры)
const rateLimitConfig = {
  // Обычный лимит для API (увеличен для игры)
  api: {
    windowMs: 60 * 1000, // 1 минута
    max: 500, // 500 запросов (увеличено для игровых действий)
    message: 'Слишком много запросов, попробуйте позже',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Строгий лимит для аутентификации
  auth: {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10, // 10 попыток (увеличено)
    message: 'Слишком много попыток входа, попробуйте через 15 минут',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Лимит для WebSocket соединений (оптимизирован)
  websocket: {
    maxConnections: 200, // Максимум 200 подключений с одного IP
    maxMessages: 100, // Максимум 100 сообщений в минуту (увеличено)
    windowMs: 60 * 1000,
    // Типы сообщений которые не лимитируются строго
    bypassTypes: ['click', 'updateScore', 'battleClick'],
  }
};

// Создать limiter для API
const apiLimiter = rateLimit(rateLimitConfig.api);

// Создать limiter для аутентификации
const authLimiter = rateLimit({
  ...rateLimitConfig.auth,
  keyGenerator: (req) => {
    // Используем IP или username для ограничения
    return req.body.username || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Слишком много попыток входа. Попробуйте через 15 минут',
      retryAfter: 900 // 15 минут в секундах
    });
  }
});

// Middleware для отслеживания WebSocket подключений
class WebSocketRateLimiter {
  constructor(config) {
    this.config = config;
    this.connections = new Map(); // IP -> count
    this.messages = new Map(); // IP -> { count, resetTime, byType }
  }
  
  // Проверить подключение
  checkConnection(ip) {
    const current = this.connections.get(ip) || 0;
    if (current >= this.config.maxConnections) {
      return false;
    }
    this.connections.set(ip, current + 1);
    return true;
  }
  
  // Уменьшить счетчик при отключении
  removeConnection(ip) {
    const current = this.connections.get(ip) || 0;
    if (current > 0) {
      this.connections.set(ip, current - 1);
    }
  }
  
  // Проверить сообщения (умная лимитировка)
  checkMessage(ip, messageType = 'generic') {
    const now = Date.now();
    let record = this.messages.get(ip);
    
    if (!record || now > record.resetTime) {
      record = { 
        count: 0, 
        resetTime: now + this.config.windowMs,
        byType: {} // Счетчик по типам сообщений
      };
      this.messages.set(ip, record);
    }
    
    // Игровые действия (click, updateScore) лимитируем мягче
    if (this.config.bypassTypes?.includes(messageType)) {
      // Для игровых действий разрешаем до 500 сообщений в минуту
      record.byType[messageType] = (record.byType[messageType] || 0) + 1;
      return record.byType[messageType] <= 500;
    }
    
    // Обычные сообщения
    record.count++;
    return record.count <= this.config.maxMessages;
  }
  
  // Получить статистику
  getStats() {
    return {
      activeConnections: this.connections.size,
      totalConnections: Array.from(this.connections.values()).reduce((a, b) => a + b, 0)
    };
  }
  
  // Очистить данные для IP
  cleanup(ip) {
    this.removeConnection(ip);
    this.messages.delete(ip);
  }
}

// Создать экземпляр WebSocket rate limiter
const wsRateLimiter = new WebSocketRateLimiter(rateLimitConfig.websocket);

// Middleware для Express
function setupRateLimiting(app) {
  // Применить к API маршрутам
  if (app.use) {
    app.use('/api/', apiLimiter);
    
    // Применить к маршрутам аутентификации
    app.use('/auth/', authLimiter);
    
    // Общий лимит для всех остальных маршрутов
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 минут
      max: 300, // 300 запросов
      message: 'Слишком много запросов'
    }));
  }
  
  return {
    apiLimiter,
    authLimiter,
    wsRateLimiter
  };
}

module.exports = {
  setupRateLimiting,
  WebSocketRateLimiter,
  rateLimitConfig
};

