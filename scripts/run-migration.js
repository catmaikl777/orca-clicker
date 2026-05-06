const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('🚀 Запуск миграции таблицы players...\n');
  
  try {
    // Проверяем текущую структуру
    const current = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position
    `);
    
    console.log(`📊 Текущее количество колонок: ${current.rows.length}`);
    
    const migrations = [
      ['per_click', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS per_click INTEGER DEFAULT 1'],
      ['per_second', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS per_second INTEGER DEFAULT 0'],
      ['skills', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT \'{}\''],
      ['achievements', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT \'[]\''],
      ['skins', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS skins JSONB DEFAULT \'{"normal":true}\''],
      ['current_skin', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS current_skin VARCHAR(50) DEFAULT \'normal\''],
      ['effects', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS effects JSONB DEFAULT \'{}\''],
      ['event_rewards', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS event_rewards BIGINT DEFAULT 0'],
      ['pending_boxes', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS pending_boxes JSONB DEFAULT \'[]\''],
      ['quest_progress', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS quest_progress JSONB DEFAULT \'[]\''],
      ['daily_quest_progress', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_quest_progress JSONB DEFAULT \'{"clicks":0,"coins":0,"playTime":0}\''],
      ['daily_quest_date', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_quest_date VARCHAR(20)'],
      ['daily_quest_ids', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_quest_ids JSONB DEFAULT \'[]\''],
      ['updated_at', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at BIGINT'],
      ['banned_at', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS banned_at BIGINT'],
      ['ban_reason', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(255)'],
      ['pending_event_clicks', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS pending_event_clicks INTEGER DEFAULT 0'],
      ['last_processed_clicks', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS last_processed_clicks INTEGER DEFAULT 0'],
      ['total_play_time', 'ALTER TABLE players ADD COLUMN IF NOT EXISTS total_play_time INTEGER DEFAULT 0']
    ];
    
    let added = 0;
    for (const [name, sql] of migrations) {
      try {
        await pool.query(sql);
        console.log(`✅ Добавлена колонка: ${name}`);
        added++;
      } catch (err) {
        console.log(`⚠️  Колонка ${name}: ${err.message}`);
      }
    }
    
    // Проверяем итоговый результат
    const after = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position
    `);
    
    console.log(`\n🎉 Готово! Добавлено колонок: ${added}`);
    console.log(`📊 Итоговое количество колонок: ${after.rows.length}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
