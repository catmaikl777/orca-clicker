// Vercel Serverless Function - Admin API: Получить всех игроков
import dbAdapter from '../../middleware/database-adapter.js';

export const config = {
  runtime: 'nodejs18.x',
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Проверка админа
  const auth = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (!auth || !auth.startsWith('Bearer ') || auth.replace('Bearer ', '') !== adminPassword) {
    return res.status(403).json({ error: 'Неверный пароль' });
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    if (!dbAdapter.usePostgreSQL) {
      return res.status(500).json({ error: 'PostgreSQL не подключен' });
    }
    
    const result = await dbAdapter.pool.query(
      'SELECT p.*, a.username FROM players p LEFT JOIN accounts a ON p.account_id = a.id ORDER BY p.total_coins DESC LIMIT 100'
    );
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Ошибка:', error);
    return res.status(500).json({ error: error.message });
  }
}
