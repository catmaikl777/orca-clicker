// Vercel Serverless Function - Admin API Gateway
import dbAdapter from '../../middleware/database-adapter.js';

export const config = {
  runtime: 'nodejs18.x',
};

function sendJson(res, statusCode, data) {
  res.status(statusCode).json(data);
}

function checkAdmin(req) {
  const auth = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return false;
  }
  
  return auth.replace('Bearer ', '') === adminPassword;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Проверка админа для всех путей кроме GET /admin.html
  if (!checkAdmin(req)) {
    return res.status(403).json({ error: 'Неверный пароль' });
  }
  
  const { url, method } = req;
  
  // Статистика
  if (url === '/stats' && method === 'GET') {
    try {
      const stats = await dbAdapter.getStats();
      return sendJson(res, 200, stats);
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }
  
  // Получить всех игроков
  if (url === '/players' && method === 'GET') {
    try {
      if (!dbAdapter.usePostgreSQL) {
        return sendJson(res, 500, { error: 'PostgreSQL не подключен' });
      }
      const result = await dbAdapter.pool.query(
        'SELECT p.*, a.username FROM players p LEFT JOIN accounts a ON p.account_id = a.id ORDER BY p.total_coins DESC LIMIT 100'
      );
      return sendJson(res, 200, result.rows);
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }
  
  // Получить/обновить/удалить игрока
  const playerMatch = url.match(/^\/players\/([^/]+)$/);
  if (playerMatch) {
    const playerId = playerMatch[1];
    
    // GET - получить игрока
    if (method === 'GET') {
      try {
        const result = await dbAdapter.pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
        if (result.rows.length === 0) {
          return sendJson(res, 404, { error: 'Игрок не найден' });
        }
        return sendJson(res, 200, result.rows[0]);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }
    
    // PUT - обновить игрока
    if (method === 'PUT') {
      try {
        const data = req.body;
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
        return sendJson(res, 200, { success: true, message: 'Данные обновлены' });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }
    
    // DELETE - удалить игрока
    if (method === 'DELETE') {
      try {
        await dbAdapter.pool.query('DELETE FROM players WHERE id = $1', [playerId]);
        return sendJson(res, 200, { success: true, message: 'Игрок удалён' });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }
  }
  
  // Бан игрока
  const banMatch = url.match(/^\/ban\/([^/]+)$/);
  if (banMatch && method === 'POST') {
    const playerId = banMatch[1];
    try {
      const data = req.body;
      await dbAdapter.pool.query(
        'UPDATE players SET banned_at = $1, ban_reason = $2 WHERE id = $3',
        [Date.now(), data.reason || 'Нет описания', playerId]
      );
      return sendJson(res, 200, { success: true, message: 'Игрок забанен' });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }
  
  // Разбан игрока
  const unbanMatch = url.match(/^\/unban\/([^/]+)$/);
  if (unbanMatch && method === 'POST') {
    const playerId = unbanMatch[1];
    try {
      await dbAdapter.pool.query(
        'UPDATE players SET banned_at = NULL, ban_reason = NULL WHERE id = $1',
        [playerId]
      );
      return sendJson(res, 200, { success: true, message: 'Игрок разбанен' });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }
  
  return res.status(404).json({ error: 'Not found' });
}
