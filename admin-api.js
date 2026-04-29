#!/usr/bin/env node
// ==================== Admin API для управления игрой ====================

const express = require('express');
const bcrypt = require('bcrypt');
const dbAdapter = require('./middleware/database-adapter');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Админский пароль (замените на свой!)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware для проверки админки
function checkAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  const token = auth.replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Неверный пароль' });
  }
  
  next();
}

// Получить всех игроков
app.get('/api/admin/players', checkAdmin, async (req, res) => {
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const result = await dbAdapter.pool.query(
      'SELECT p.*, a.username FROM players p LEFT JOIN accounts a ON p.account_id = a.id ORDER BY p.total_coins DESC LIMIT 100'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения игроков:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить одного игрока по ID
app.get('/api/admin/players/:id', checkAdmin, async (req, res) => {
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const result = await dbAdapter.pool.query(
      'SELECT * FROM players WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения игрока:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить данные игрока
app.put('/api/admin/players/:id', checkAdmin, async (req, res) => {
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const { id } = req.params;
    const { coins, totalCoins, level, perClick, perSecond, clicks, banned } = req.body;
    
    // Проверяем что игрок существует
    const checkResult = await dbAdapter.pool.query('SELECT * FROM players WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (coins !== undefined) {
      updates.push(`coins = $${paramIndex++}`);
      values.push(coins);
    }
    
    if (totalCoins !== undefined) {
      updates.push(`total_coins = $${paramIndex++}`);
      values.push(totalCoins);
    }
    
    if (level !== undefined) {
      updates.push(`level = $${paramIndex++}`);
      values.push(level);
    }
    
    if (perClick !== undefined) {
      updates.push(`per_click = $${paramIndex++}`);
      values.push(perClick);
    }
    
    if (perSecond !== undefined) {
      updates.push(`per_second = $${paramIndex++}`);
      values.push(perSecond);
    }
    
    if (clicks !== undefined) {
      updates.push(`clicks = $${paramIndex++}`);
      values.push(clicks);
    }
    
    if (banned !== undefined) {
      updates.push(`banned_at = $${paramIndex++}`);
      values.push(banned ? Date.now() : null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    await dbAdapter.pool.query(
      `UPDATE players SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    
    res.json({ success: true, message: 'Данные обновлены' });
  } catch (error) {
    console.error('Ошибка обновления игрока:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить игрока
app.delete('/api/admin/players/:id', checkAdmin, async (req, res) => {
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const { id } = req.params;
    
    await dbAdapter.pool.query('DELETE FROM players WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Игрок удалён' });
  } catch (error) {
    console.error('Ошибка удаления игрока:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить статистику
app.get('/api/admin/stats', checkAdmin, async (req, res) => {
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const stats = await dbAdapter.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: error.message });
  }
});

// Бан игрока
app.post('/api/admin/ban/:id', checkAdmin, async (req, res) => {
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const { id } = req.params;
    const { reason } = req.body;
    
    await dbAdapter.pool.query(
      'UPDATE players SET banned_at = $1, ban_reason = $2 WHERE id = $3',
      [Date.now(), reason || 'Нет описания', id]
    );
    
    res.json({ success: true, message: 'Игрок забанен' });
  } catch (error) {
    console.error('Ошибка бана игрока:', error);
    res.status(500).json({ error: error.message });
  }
});

// Разбан игрока
app.post('/api/admin/unban/:id', checkAdmin, async (req, res) => {
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const { id } = req.params;
    
    await dbAdapter.pool.query(
      'UPDATE players SET banned_at = NULL, ban_reason = NULL WHERE id = $1',
      [id]
    );
    
    res.json({ success: true, message: 'Игрок разбанен' });
  } catch (error) {
    console.error('Ошибка разбана игрока:', error);
    res.status(500).json({ error: error.message });
  }
});

// Запустить сервер админки
const PORT = process.env.ADMIN_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Админка запущена на порту ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}/admin.html`);
  console.log(`🔑 Пароль по умолчанию: ${ADMIN_PASSWORD}`);
  console.log(`⚠️  Измените ADMIN_PASSWORD в переменной окружения!`);
});

module.exports = app;
