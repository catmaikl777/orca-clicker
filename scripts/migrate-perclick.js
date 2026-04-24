#!/usr/bin/env node
/**
 * Миграция: сброс perClick/perSecond для старых аккаунтов
 * 
 * Старые аккаунты имели perClick=1 (базовый клик), но теперь
 * базовый клик добавляется в getPerClick(), а perClick хранит только апгрейды.
 * 
 * Использование:
 *   node scripts/migrate-perclick.js
 */

const { Pool } = require('pg');

async function migratePerClick() {
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Ошибка: DATABASE_URL не установлена');
    process.exit(1);
  }
  
  if (!connectionString.includes('sslmode')) {
    connectionString += '?sslmode=require';
  }
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔄 Миграция perClick/perSecond...');
    
    // Показать текущее состояние
    const result = await pool.query(
      'SELECT COUNT(*) as total, SUM(per_click) as total_per_click, SUM(per_second) as total_per_second FROM players'
    );
    
    console.log(`\n📊 Текущее состояние:`);
    console.log(`   Игроков: ${result.rows[0].total}`);
    console.log(`   Сумма per_click: ${result.rows[0].total_per_click || 0}`);
    console.log(`   Сумма per_second: ${result.rows[0].total_per_second || 0}`);
    
    // Найти игроков с perClick = 1 (старый базовый клик)
    const oldPlayers = await pool.query(
      'SELECT id, name, per_click, per_second FROM players WHERE per_click = 1 AND per_second = 0'
    );
    
    console.log(`\n🔍 Найдено старых аккаунтов (perClick=1, perSecond=0): ${oldPlayers.rows.length}`);
    
    if (oldPlayers.rows.length > 0) {
      console.log('\nПримеры:');
      oldPlayers.rows.slice(0, 5).forEach(p => {
        console.log(`   ${p.name}: per_click=${p.per_click}, per_second=${p.per_second}`);
      });
    }
    
    console.log('\n⚠️  Это действие сбросит:');
    console.log('   - per_click = 0 (базовый клик теперь добавляется программно)');
    console.log('   - per_second = 0 (без изменений)');
    console.log('\nИгроки ВСЁ ЕЩЕ смогут кликать! Базовый клик = 1 добавляется в getPerClick()\n');
    
    const confirm = await new Promise(resolve => {
      process.stdin.setEncoding('utf8');
      console.log('Введите "MIGRATE" для подтверждения:');
      process.stdin.once('data', (input) => resolve(input.trim().toUpperCase() === 'MIGRATE'));
    });
    
    if (!confirm) {
      console.log('❌ Операция отменена');
      process.exit(0);
    }
    
    // Выполнить миграцию
    const updateResult = await pool.query(
      'UPDATE players SET per_click = 0 WHERE per_click = 1 AND per_second = 0'
    );
    
    console.log(`\n✅ Обновлено ${updateResult.rowCount} игроков`);
    
    // Проверить результат
    const verify = await pool.query(
      'SELECT COUNT(*) as total, SUM(per_click) as total_per_click FROM players WHERE per_click = 0'
    );
    console.log(`\n📊 После миграции:`);
    console.log(`   Игроков с perClick=0: ${verify.rows[0].total}`);
    
    console.log('\n✅ Миграция завершена!');
    console.log('\n📝 Примечание:');
    console.log('   - Все игроки могут продолжать кликать (базовый клик = 1)');
    console.log('   - Навыки теперь умножают только базовый клик, а не апгрейды');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migratePerClick();
