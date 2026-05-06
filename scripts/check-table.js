const { Pool } = require('pg');

async function checkTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Получаем все колонки
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Структура таблицы players:\n');
    console.log('№  | Колонка                  | Тип              | NULL');
    console.log('---|--------------------------|------------------|-----');
    
    result.rows.forEach((row, idx) => {
      const num = (idx + 1).toString().padStart(2);
      const name = row.column_name.padEnd(24);
      const type = row.data_type.padEnd(16);
      const nullVal = row.is_nullable === 'YES' ? 'YES' : 'NO';
      console.log(`${num} | ${name} | ${type} | ${nullVal}`);
    });
    
    console.log(`\n📊 Всего колонок: ${result.rows.length}`);
    
    // Пробуем простой SELECT COUNT(*)
    const count = await pool.query('SELECT COUNT(*) FROM players');
    console.log(`\n📊 Всего записей: ${count.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();
