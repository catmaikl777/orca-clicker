#!/usr/bin/env node
// ==================== Admin API Server (отдельный сервер) ====================

const http = require('http');
const fs = require('fs');
const path = require('path');
const dbAdapter = require('./middleware/database-adapter');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_PORT = process.env.ADMIN_PORT || 3002;

// Вспомогательная функция для JSON ответа
function sendJson(res, statusCode, data, cors = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (cors) {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

// Проверка админа
function checkAdmin(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Требуется авторизация' }, false);
    return false;
  }
  
  const token = auth.replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) {
    sendJson(res, 403, { error: 'Неверный пароль' }, false);
    return false;
  }
  
  return true;
}

// Чтение тела запроса
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// HTTP сервер
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }
  
  const url = req.url;
  
  // Serve admin.html
  if (url === '/admin.html' || url === '/admin/') {
    const adminHtmlPath = path.join(__dirname, 'public', 'admin.html');
    fs.readFile(adminHtmlPath, 'utf8', (err, html) => {
      if (err) {
        res.writeHead(500);
        res.end('Admin panel not found');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      }
    });
    return;
  }
  
  // Admin API
  const adminPrefix = '/api/admin';
  
  // Статистика
  if (url === `${adminPrefix}/stats` && req.method === 'GET') {
    if (!checkAdmin(req, res)) return;
    try {
      const stats = await dbAdapter.getStats();
      sendJson(res, 200, stats);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  
  // Получить всех игроков
  if (url === `${adminPrefix}/players` && req.method === 'GET') {
    if (!checkAdmin(req, res)) return;
    try {
      if (!dbAdapter.usePostgreSQL) {
        return sendJson(res, 500, { error: 'PostgreSQL не подключен' });
      }
      const result = await dbAdapter.pool.query(
        'SELECT p.*, a.username FROM players p LEFT JOIN accounts a ON p.account_id = a.id ORDER BY p.total_coins DESC LIMIT 100'
      );
      sendJson(res, 200, result.rows);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  
  // Получить/обновить/удалить одного игрока
  const playerMatch = url.match(`${adminPrefix}/players/([^/]+)`);
  if (playerMatch) {
    const playerId = playerMatch[1];
    
    // GET - получить игрока
    if (req.method === 'GET') {
      if (!checkAdmin(req, res)) return;
      try {
        const result = await dbAdapter.pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
        if (result.rows.length === 0) {
          return sendJson(res, 404, { error: 'Игрок не найден' });
        }
        sendJson(res, 200, result.rows[0]);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }
    
    // PUT - обновить игрока
    if (req.method === 'PUT') {
      if (!checkAdmin(req, res)) return;
      try {
        const data = await readBody(req);
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (data.coins !== undefined) { updates.push(`coins = $${paramIndex++}`); values.push(data.coins); }
        if (data.totalCoins !== undefined) { updates.push(`total_coins = $${paramIndex++}`); values.push(data.totalCoins); }
        if (data.level !== undefined) { updates.push(`level = $${paramIndex++}`); values.push(data.level); }
        if (data.perClick !== undefined) { updates.push(`per_click = $${paramIndex++}`); values.push(data.perClick); }
        if (data.perSecond !== undefined) { updates.push(`per_second = $${paramIndex++}`); values.push(data.perSecond); }
        if (data.clicks !== undefined) { updates.push(`clicks = $${paramIndex++}`); values.push(data.clicks); }
        
        if (updates.length === 0) {
          return sendJson(res, 400, { error: 'Нет данных для обновления' });
        }
        
        updates.push(`updated_at = NOW()`);
        values.push(playerId);
        
        await dbAdapter.pool.query(`UPDATE players SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
        sendJson(res, 200, { success: true, message: 'Данные обновлены' });
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }
    
    // DELETE - удалить игрока
    if (req.method === 'DELETE') {
      if (!checkAdmin(req, res)) return;
      try {
        await dbAdapter.pool.query('DELETE FROM players WHERE id = $1', [playerId]);
        sendJson(res, 200, { success: true, message: 'Игрок удалён' });
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }
  }
  
  // Бан игрока
  const banMatch = url.match(`${adminPrefix}/ban/([^/]+)`);
  if (banMatch && req.method === 'POST') {
    const playerId = banMatch[1];
    if (!checkAdmin(req, res)) return;
    try {
      const data = await readBody(req);
      await dbAdapter.pool.query(
        'UPDATE players SET banned_at = $1, ban_reason = $2 WHERE id = $3',
        [Date.now(), data.reason || 'Нет описания', playerId]
      );
      sendJson(res, 200, { success: true, message: 'Игрок забанен' });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  
  // Разбан игрока
  const unbanMatch = url.match(`${adminPrefix}/unban/([^/]+)`);
  if (unbanMatch && req.method === 'POST') {
    const playerId = unbanMatch[1];
    if (!checkAdmin(req, res)) return;
    try {
      await dbAdapter.pool.query(
        'UPDATE players SET banned_at = NULL, ban_reason = NULL WHERE id = $1',
        [playerId]
      );
      sendJson(res, 200, { success: true, message: 'Игрок разбанен' });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }
  
  // 404
  res.writeHead(404);
  res.end('Not found');
});

// Запуск сервера
server.listen(ADMIN_PORT, () => {
  console.log(`✅ Админка запущена на порту ${ADMIN_PORT}`);
  console.log(`📍 URL: http://localhost:${ADMIN_PORT}/admin.html`);
  console.log(`🔑 Пароль: ${ADMIN_PASSWORD}`);
});

module.exports = server;
