#!/usr/bin/env node
// ==================== Очистка PostgreSQL БД для продакшена ====================

require('dotenv').config();

const { Pool } = require('pg');

async function clearDatabase() {
  const usePostgreSQL = process.env.DATABASE_URL && process.env.NODE_ENV === 'production';
  
  if (!usePostgreSQL) {
    console.log('❌ PostgreSQL не настроен');
    console.log('Установите DATABASE_URL и NODE_ENV=production в .env');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    console.log('🔌 Подключение к PostgreSQL...');
    const client = await pool.connect();
    
    console.log('🗑️  Удаление всех данных...');
    
    // Удалить все записи из таблиц (сохраняя структуру)
    await client.query('DELETE FROM event_coins');
    await client.query('DELETE FROM events');
    await client.query('DELETE FROM players');
    await client.query('DELETE FROM accounts');
    
    // Сброс счетчиков последовательностей
    await client.query('ALTER SEQUENCE events_id_seq RESTART WITH 1');
    
    console.log('✅ Данные удалены');
    
    // Проверка
    const result = await client.query('SELECT COUNT(*) as count FROM players');
    console.log(`📊 Игроков осталось: ${result.rows[0].count}`);
    
    const accountsResult = await client.query('SELECT COUNT(*) as count FROM accounts');
    console.log(`📊 Аккаунтов осталось: ${accountsResult.rows[0].count}`);
    
    console.log('\n🎉 База данных очищена для продакшена!');
    
    client.release();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

// Запросить подтверждение
console.log('⚠️  ВНИМАНИЕ! Это удалит ВСЕ данные из базы данных!');
console.log('Это действие нельзя отменить!\n');

if (process.argv.includes('--force')) {
  clearDatabase().then(() => process.exit(0));
} else {
  console.log('Запустите с аргументом --force для подтверждения:');
  console.log('node scripts/clear-postgres-db.js --force\n');
  process.exit(1);
}
