#!/usr/bin/env node
// ==================== ORCA Clicker API Server ====================

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Импортируем модули
const { handleRegister } = require('./auth');
const { setupRateLimiting, WebSocketRateLimiter } = require('./middleware/rate-limiter');
const dbAdapter = require('./middleware/database-adapter');
const backupScript = require('./scripts/backup-db');

// ==================== Инициализация ====================

async function startServer() {
  try {
    // Инициализация базы данных
    await dbAdapter.init();
    
    // HTTP сервер для раздачи статики
    const server = http.createServer((req, res) => {
      let filePath = '.' + req.url;
      if (filePath === './') filePath = './index.html';
      
      const extname = String(path.extname(filePath)).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
      };
      
      const contentType = mimeTypes[extname] || 'application/octet-stream';
      
      fs.readFile(filePath, (error, content) => {
        if (error) {
          if (error.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>', 'utf-8');
          } else {
            res.writeHead(500);
            res.end('Server Error: ' + error.code + ' ..\n');
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });
    
    // Health check endpoint
    server.on('request', (req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      }
    });
    
    // Rate limiting для HTTP
    const rateLimiters = setupRateLimiting(server);
    
    // WebSocket сервер
    const wss = new WebSocket.Server({ server });
    
    // Хранилище данных
    const players = new Map();
    const battles = new Map();
    const clans = new Map();
    const db = {
      accounts: {},
      players: {},
      event: { eventCoins: {} }
    };
    
    // WebSocket Rate Limiter
    const wsRateLimiter = new WebSocketRateLimiter({
      maxConnections: 100,
      maxMessages: 50,
      windowMs: 60000
    });
    
    // Генерация ID
    function generateId() {
      return Math.random().toString(36).substr(2, 9);
    }
    
    // Функция сохранения базы данных
    function saveDB() {
      if (!process.env.DATABASE_URL) {
        // File-based database
        const data = {
          ...db,
          stats: {
            totalPlayers: db.stats?.totalPlayers || 0
          }
        };
        fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));
      }
      // При использовании PostgreSQL данные сохраняются через adapter
    }
    
    // Функции для работы с данными
    function getAccountByUsername(username) {
      return Object.values(db.accounts || {}).find(a => 
        a.username.toLowerCase() === username.toLowerCase()
      );
    }
    
    function broadcastEventInfo() {
      const eventData = {
        type: 'eventInfo',
        event: db.event?.currentEvent || {},
        coins: {}
      };
      
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.authenticated) {
          client.send(JSON.stringify(eventData));
        }
      });
    }
    
    function broadcastLeaderboard() {
      const leaderboard = Array.from(players.values())
        .map(p => ({
          id: p.id,
          name: p.name,
          coins: p.coins,
          totalCoins: p.totalCoins,
          level: p.level
        }))
        .sort((a, b) => b.totalCoins - a.totalCoins)
        .slice(0, 100);
      
      const data = JSON.stringify({ type: 'leaderboard', data: leaderboard });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
    
    // Обработка WebSocket соединений
    wss.on('connection', (ws, req) => {
      const clientId = generateId();
      const clientIp = req.socket.remoteAddress || 'unknown';
      
      // Проверка rate limiter для WebSocket
      if (!wsRateLimiter.checkConnection(clientIp)) {
        ws.close(1008, 'Too many connections from this IP');
        console.log(`🚫 Connection rejected: ${clientIp} (rate limit)`);
        return;
      }
      
      ws.clientId = clientId;
      ws.clientIp = clientIp;
      ws.authenticated = false;
      
      console.log(`🔌 Client connected: ${clientId} from ${clientIp}`);
      ws.send(JSON.stringify({ type: 'connected', clientId }));
      
      // Счетчик сообщений
      let messageCount = 0;
      const messageLimit = 60; // 60 сообщений в секунду
      
      ws.on('message', async (message) => {
        // Rate limiting для сообщений
        if (!wsRateLimiter.checkMessage(clientIp)) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Слишком много сообщений. Подождите минуту.' 
          }));
          return;
        }
        
        messageCount++;
        if (messageCount > messageLimit) {
          console.log(`⚠️  Message limit reached for ${clientId}`);
          return;
        }
        
        try {
          const data = JSON.parse(message);
          await handleMessage(ws, data);
        } catch (e) {
          console.error('Invalid message:', e);
        }
      });
      
      ws.on('close', () => {
        console.log(`❌ Client disconnected: ${clientId}`);
        wsRateLimiter.cleanup(clientIp);
        
        if (ws.authenticated && ws.accountId) {
          players.delete(ws.accountId);
          // Сохраняем данные игрока
          if (db.players[ws.accountId]) {
            db.players[ws.accountId].lastLogout = Date.now();
          }
          saveDB();
        }
      });
      
      ws.on('error', (error) => {
        console.error(`⚠️  WebSocket error for ${clientId}:`, error.message);
      });
    });
    
    // Обработка сообщений
    async function handleMessage(ws, data) {
      switch (data.type) {
        case 'register':
          // Обработка регистрации/входа через auth.js
          await handleRegister(ws, data, db, players, saveDB, broadcastEventInfo, broadcastLeaderboard);
          break;
        
        case 'updateScore':
          if (!ws.authenticated) {
            ws.send(JSON.stringify({ type: 'error', message: 'Требуется авторизация' }));
            return;
          }
          
          const player = players.get(ws.accountId);
          if (player) {
            player.coins = data.coins;
            player.totalCoins += data.coins || 0;
            player.clicks += data.clicks || 0;
            broadcastLeaderboard();
          }
          break;
        
        case 'getLeaderboard':
          if (!ws.authenticated) return;
          broadcastLeaderboard();
          break;
        
        case 'getProfile':
          if (!ws.authenticated) return;
          const profilePlayer = players.get(ws.accountId);
          if (profilePlayer) {
            ws.send(JSON.stringify({
              type: 'profile',
              data: profilePlayer,
              eventCoins: db.event.eventCoins[ws.accountId] || 0
            }));
          }
          break;
        
        default:
          // Обработка остальных сообщений
          handleGameMessage(ws, data);
      }
    }
    
    // Обработка игровых сообщений
    function handleGameMessage(ws, data) {
      if (!ws.authenticated) return;
      
      const player = players.get(ws.accountId);
      if (!player) return;
      
      switch (data.type) {
        case 'click':
          const clickValue = player.perClick || 1;
          player.coins += clickValue;
          player.totalCoins += clickValue;
          player.clicks++;
          break;
        
        case 'buyUpgrade':
          if (player.coins >= data.cost) {
            player.coins -= data.cost;
            // Логика улучшения
          }
          break;
      }
    }
    
    // Автоматический бэкап (если включен)
    if (process.env.AUTO_BACKUP !== 'false') {
      const backupInterval = parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24;
      console.log(`⏰ Автоматический бэкап включен каждые ${backupInterval} часов`);
      backupScript.scheduleAutoBackup(backupInterval);
    }
    
    // Запуск сервера
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 ORCA Clicker API running on port ${PORT}`);
      console.log(`📊 Режим базы данных: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'File (JSON)'}`);
      console.log(`🔒 Rate limiting: включено`);
      console.log(`🔐 Безопасность паролей: bcrypt`);
      console.log(`📦 HTTPS: автоматически на Render/Vercel`);
    });
    
    // Обработка завершения
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      await dbAdapter.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down server...');
      await dbAdapter.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Запуск сервера
startServer();
