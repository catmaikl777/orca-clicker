/**
 * Скрипт очистки БД — удаляет всех игроков кроме указанных.
 * Запускается в build command на Render.
 * 
 * Использование: node scripts/cleanup-players.js
 */

const { Pool } = require('pg');

const KEEP_PLAYERS = [
  'catmaikl777',
  'ясав',
  'Лев 666'
];

async function cleanup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Найти ID аккаунтов, которые нужно сохранить
    const keepAccounts = await pool.query(
      `SELECT id, username FROM accounts WHERE username = ANY($1)`,
      [KEEP_PLAYERS]
    );
    
    const keepAccountIds = keepAccounts.rows.map(r => r.id);
    console.log(`✅ Сохраняем аккаунты: ${keepAccounts.rows.map(r => `${r.username} (${r.id})`).join(', ')}`);

    // 2. Найти ID игроков, которых нужно сохранить (по account_id или по имени)
    const keepPlayers = await pool.query(
      `SELECT id, name FROM players WHERE account_id = ANY($1) OR name = ANY($2)`,
      [keepAccountIds, KEEP_PLAYERS]
    );
    
    const keepPlayerIds = keepPlayers.rows.map(r => r.id);
    console.log(`✅ Сохраняем игроков: ${keepPlayers.rows.map(r => `${r.name} (${r.id})`).join(', ')}`);

    if (keepPlayerIds.length === 0) {
      console.log('⚠️ Игроки для сохранения не найдены! Прерываем очистку.');
      return;
    }

    // 3. Удалить event_coins для удаляемых игроков
    const delEventCoins = await pool.query(
      `DELETE FROM event_coins WHERE account_id NOT IN (${keepPlayerIds.map((_, i) => `$${i + 1}`).join(',')})`,
      keepPlayerIds
    );
    console.log(`🗑️ Удалено event_coins: ${delEventCoins.rowCount} записей`);

    // 4. Удалить баны для удаляемых игроков
    const delBans = await pool.query(
      `DELETE FROM bans WHERE id NOT IN (${keepPlayerIds.map((_, i) => `$${i + 1}`).join(',')})`,
      keepPlayerIds
    );
    console.log(`🗑️ Удалено банов: ${delBans.rowCount} записей`);

    // 5. Удалить игроков
    const delPlayers = await pool.query(
      `DELETE FROM players WHERE id NOT IN (${keepPlayerIds.map((_, i) => `$${i + 1}`).join(',')})`,
      keepPlayerIds
    );
    console.log(`🗑️ Удалено игроков: ${delPlayers.rowCount} записей`);

    // 6. Удалить аккаунты
    const delAccounts = await pool.query(
      `DELETE FROM accounts WHERE id NOT IN (${keepAccountIds.map((_, i) => `$${i + 1}`).join(',')})`,
      keepAccountIds
    );
    console.log(`🗑️ Удалено аккаунтов: ${delAccounts.rowCount} записей`);

    // 7. Показать оставшихся
    const remaining = await pool.query('SELECT p.name, p.coins, a.username FROM players p LEFT JOIN accounts a ON p.account_id = a.id');
    console.log(`\n📋 Оставшиеся игроки:`);
    remaining.rows.forEach(r => {
      console.log(`   ${r.username || r.name}: ${r.coins} монет`);
    });

    console.log('\n✅ Очистка завершена!');
  } catch (err) {
    console.error('❌ Ошибка очистки:', err.message);
  } finally {
    await pool.end();
  }
}

cleanup();
