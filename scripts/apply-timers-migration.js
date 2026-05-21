// Скрипт для применения миграции таймеров
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('🔄 Применение миграции таймеров...');
    
    // Добавляем колонки если их нет
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS event_end_time BIGINT NULL,
      ADD COLUMN IF NOT EXISTS ad_last_view BIGINT NULL,
      ADD COLUMN IF NOT EXISTS ad_view_count INTEGER DEFAULT 0
    `);
    console.log('✅ Колонки добавлены');
    
    // Установка дефолтных значений
    await pool.query(`UPDATE players SET ad_view_count = 0 WHERE ad_view_count IS NULL`);
    console.log('✅ Дефолтные значения установлены');
    
    // Проверка
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('event_end_time', 'ad_last_view', 'ad_view_count')
      ORDER BY column_name
    `);
    
    console.log('📊 Новые колонки в таблице players:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    console.log('✅ Миграция успешно применена!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    await pool.end();
    process.exit(1);
  }
}

migrate();
