#!/usr/bin/env node
/**
 * Скрипт для полной очистки всех данных из БД
 * 
 * Использование:
 *   node scripts/clear-all-accounts.js
 * 
 * ВНИМАНИЕ: Это действие НЕОБРАТИМО!
 */

const { Pool } = require('pg');

async function clearAllData() {
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Ошибка: Переменная окружения DATABASE_URL не установлена');
    process.exit(1);
  }
  
  // Добавляем SSL для Render
  if (!connectionString.includes('sslmode')) {
    connectionString += '?sslmode=require';
  }
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('⚠️  ОЧИСТКА ВСЕХ ДАННЫХ ИЗ БД');
    console.log('================================\n');
    
    // Показать текущее количество записей
    console.log('📊 Текущее состояние БД:');
    
    const players = await pool.query('SELECT COUNT(*) FROM players');
    const accounts = await pool.query('SELECT COUNT(*) FROM accounts');
    const clans = await pool.query('SELECT COUNT(*) FROM clans');
    const bans = await pool.query('SELECT COUNT(*) FROM bans');
    const eventCoins = await pool.query('SELECT COUNT(*) FROM event_coins');
    
    console.log(`   Игроков: ${players.rows[0].count}`);
    console.log(`   Аккаунтов: ${accounts.rows[0].count}`);
    console.log(`   Кланов: ${clans.rows[0].count}`);
    console.log(`   Банов: ${bans.rows[0].count}`);
    console.log(`   Event coins записей: ${eventCoins.rows[0].count}`);
    
    console.log('\n⚠️  Это действие УДАЛИТ:');
    console.log('   - ВСЕХ игроков');
    console.log('   - ВСЕ аккаунты');
    console.log('   - ВСЕ кланы');
    console.log('   - ВСЕ баны');
    console.log('   - ВСЕ записи event_coins');
    console.log('\nТабличная структура БД НЕ изменится!\n');
    
    // const confirm = await new Promise(resolve => {
    //   process.stdin.setEncoding('utf8');
    //   console.log('Введите "DELETE ALL" для подтверждения:');
    //   process.stdin.once('data', (input) => resolve(input.trim().toUpperCase() === 'DELETE ALL'));
    // });
    
    // if (!confirm) {
    //   console.log('❌ Операция отменена');
    //   process.exit(0);
    // }
    
    console.log('\n🗑️  Очистка данных...');
    
    // Удаление в правильном порядке (сначала зависимости)
    await pool.query('DELETE FROM event_coins');
    console.log('   ✅ event_coins очищены');
    
    await pool.query('DELETE FROM bans');
    console.log('   ✅ bans очищены');
    
    await pool.query('DELETE FROM clans');
    console.log('   ✅ clans очищены');
    
    await pool.query('DELETE FROM players');
    console.log('   ✅ players очищены');
    
    await pool.query('DELETE FROM accounts');
    console.log('   ✅ accounts очищены');
    
    // Проверка
    const verify = await pool.query('SELECT COUNT(*) as total FROM players');
    console.log(`\n✅ Готово! Осталось игроков: ${verify.rows[0].total}`);
    
    console.log('\n📝 Примечание:');
    console.log('   - Таблицы остались нетронутыми');
    console.log('   - Новые игроки смогут регистрироваться');
    console.log('   - Структура БД не изменилась');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearAllData();
