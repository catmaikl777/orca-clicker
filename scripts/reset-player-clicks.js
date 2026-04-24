#!/usr/bin/env node
/**
 * Скрипт для сброса статистики кликов игрока
 * 
 * Использование:
 *   node scripts/reset-player-clicks.js <player_id>
 * 
 * Пример:
 *   node scripts/reset-player-clicks.js catmaikl777
 */

const { Pool } = require('pg');

async function resetPlayerClicks(playerId) {
  // Получаем подключение к БД из окружения
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Ошибка: Переменная окружения DATABASE_URL не установлена');
    console.log('Установите DATABASE_URL в формате: postgresql://user:pass@host:port/dbname');
    process.exit(1);
  }
  
  // Добавляем SSL параметры для Render PostgreSQL
  if (!connectionString.includes('sslmode')) {
    connectionString += '?sslmode=require';
  }
  
  const pool = new Pool({ 
    connectionString,
    ssl: {
      rejectUnauthorized: false // Разрешить самоподписанные сертификаты
    }
  });
  
  try {
    console.log(`🔍 Поиск игрока: ${playerId}`);
    
    // Проверка существования игрока
    const checkResult = await pool.query(
      'SELECT id, name, clicks, per_click, per_second, coins FROM players WHERE id = $1',
      [playerId]
    );
    
    if (checkResult.rows.length === 0) {
      console.error(`❌ Игрок ${playerId} не найден в БД`);
      process.exit(1);
    }
    
    const player = checkResult.rows[0];
    console.log('\n📊 Текущая статистика игрока:');
    console.log(`   ID: ${player.id}`);
    console.log(`   Имя: ${player.name}`);
    console.log(`   Клики: ${player.clicks}`);
    console.log(`   Per Click: ${player.per_click}`);
    console.log(`   Per Second: ${player.per_second}`);
    console.log(`   Монеты: ${player.coins}`);
    
    // Подтверждение
    console.log('\n⚠️  Это действие СБРОСИТ следующие поля:');
    console.log('   - clicks → 0');
    console.log('   - per_click → 1 (дефолт)');
    console.log('   - per_second → 0 (дефолт)');
    console.log('\nМонеты и другие данные НЕ будут изменены.');
    
    const confirm = await new Promise(resolve => {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (input) => {
        resolve(input.trim().toLowerCase() === 'yes');
      });
    });
    
    if (!confirm) {
      console.log('❌ Операция отменена');
      process.exit(0);
    }
    
    // Сброс статистики
    console.log('\n🔄 Сброс статистики...');
    
    const result = await pool.query(
      `UPDATE players 
       SET clicks = 0, 
           per_click = 1, 
           per_second = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [playerId]
    );
    
    console.log(`✅ Успешно обновлено ${result.rowCount} запись(ей)`);
    
    // Проверка результата
    const verifyResult = await pool.query(
      'SELECT id, name, clicks, per_click, per_second FROM players WHERE id = $1',
      [playerId]
    );
    
    const updated = verifyResult.rows[0];
    console.log('\n📊 Новая статистика игрока:');
    console.log(`   ID: ${updated.id}`);
    console.log(`   Имя: ${updated.name}`);
    console.log(`   Клики: ${updated.clicks}`);
    console.log(`   Per Click: ${updated.per_click}`);
    console.log(`   Per Second: ${updated.per_second}`);
    
    console.log('\n✅ Готово! Статистика кликов сброшена.');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Проверка аргументов
const playerId = process.argv[2];

if (!playerId) {
  console.error('❌ Ошибка: Не указан ID игрока');
  console.log('\nИспользование:');
  console.log('  node scripts/reset-player-clicks.js <player_id>');
  console.log('\nПример:');
  console.log('  node scripts/reset-player-clicks.js catmaikl777');
  process.exit(1);
}

resetPlayerClicks(playerId);
