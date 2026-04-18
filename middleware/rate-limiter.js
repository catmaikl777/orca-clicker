#!/usr/bin/env node
// ==================== Rate Limiting Middleware ====================

const rateLimit = require('express-rate-limit');

// Конфигурация rate limiting
const rateLimitConfig = {
  // Обычный лимит для API
  api: {
    windowMs: 60 * 1000, // 1 минута
    max: 100, // 100 запросов
    message: 'Слишком много запросов, попробуйте позже',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Строгий лимит для аутентификации
  auth: {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // 5 попыток
    message: 'Слишком много попыток входа, попробуйте через 15 минут',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Лимит для WebSocket соединений
  websocket: {
    maxConnections: 100, // Максимум 100 подключений с одного IP
    maxMessages: 50, // Максимум 50 сообщений в минуту
    windowMs: 60 * 1000,
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
    this.messages = new Map(); // IP -> { count, resetTime }
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
  
  // Проверить сообщения
  checkMessage(ip) {
    const now = Date.now();
    let record = this.messages.get(ip);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + this.config.windowMs };
      this.messages.set(ip, record);
    }
    
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
  app.use('/api/', apiLimiter);
  
  // Применить к маршрутам аутентификации
  app.use('/auth/', authLimiter);
  
  // Общий лимит для всех остальных маршрутов
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 200, // 200 запросов
    message: 'Слишком много запросов'
  }));
  
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
