#!/usr/bin/env node

/**
 * Скрипт для очистки всех кланов из PostgreSQL базы данных
 * Запускается через: node scripts/clear-clans.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orca_clicker',
  ssl: {
    rejectUnauthorized: false
  }
});

async function clearClans() {
  console.log('🗑️  Очистка всех кланов из PostgreSQL базы данных...\n');

  const client = await pool.connect();

  try {
    // Считаем количество кланов
    const clansResult = await client.query('SELECT COUNT(*) as count FROM clans');
    const clanCount = parseInt(clansResult.rows[0].count);

    if (clanCount === 0) {
      console.log('✅ Кланов нет');
      return;
    }

    console.log(`📊 Найдено кланов: ${clanCount}`);

    // Удалить всех участников из кланов
    await client.query('UPDATE players SET clan = NULL WHERE clan IS NOT NULL');
    console.log('✅ Удалены все ссылки на кланы у игроков');

    // Удалить все кланы
    await client.query('DELETE FROM clans');
    console.log(`✅ Удалено кланов: ${clanCount}`);

    console.log('\n✅ База данных обновлена');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

clearClans()
  .then(() => {
    console.log('\n⚠️  Не забудьте перезапустить сервер для применения изменений!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при очистке кланов:', error);
    process.exit(1);
  });
