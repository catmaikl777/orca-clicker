#!/usr/bin/env node

/**
 * Скрипт для удаления аккаунтов с именем "Player" из PostgreSQL
 * Запускается через: node scripts/remove-player-accounts-postgres.js
 * 
 * Работает на Render в build phase при наличии DATABASE_URL
 */

const { Pool } = require('pg');
require('dotenv').config();

// Проверяем наличие DATABASE_URL (автоматически на Render)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не найден! Установите переменную окружения на Render.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Требуется для PostgreSQL на Render
  }
});

async function removePlayerAccounts() {
  console.log('🗑️  Удаление аккаунтов с именем "Player" из PostgreSQL...\n');

  const client = await pool.connect();

  try {
    // Считаем количество игроков с именем Player
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM players WHERE name LIKE $1', ['Player%']
    );
    const count = parseInt(countResult.rows[0].count);

    if (count === 0) {
      console.log('✅ Аккаунтов с именем "Player" нет');
      await client.end();
      return;
    }

    console.log(`📊 Найдено аккаунтов с именем "Player": ${count}`);

    // Получаем список для отчёта
    const playersResult = await client.query(
      'SELECT id, name FROM players WHERE name LIKE $1 LIMIT 10', ['Player%']
    );
    console.log('\nПримеры удаляемых аккаунтов:');
    playersResult.rows.forEach(p => {
      console.log(`  - ${p.name} (${p.id})`);
    });
    if (count > 10) {
      console.log(`  ... и ещё ${count - 10}`);
    }

    // Удаляем всех игроков с именем Player
    await client.query('DELETE FROM players WHERE name LIKE $1', ['Player%']);
    console.log(`\n✅ Удалено аккаунтов: ${count}`);
    console.log('✅ База данных обновлена\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

removePlayerAccounts()
  .then(() => {
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при удалении игроков:', error);
    process.exit(1);
  });