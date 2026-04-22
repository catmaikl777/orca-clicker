#!/usr/bin/env node
// ==================== Очистка JSON БД ====================

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.json');

console.log('⚠️  ВНИМАНИЕ! Это удалит ВСЕ данные из database.json!');
console.log('Это действие нельзя отменить!\n');

if (process.argv.includes('--force')) {
  const emptyDB = {
    players: {},
    clans: {},
    leaderboard: [],
    battles: {},
    stats: {
      totalBattles: 0,
      totalClans: 0,
      totalPlayers: 0
    },
    event: {
      active: true,
      startDate: Date.now(),
      endDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 дней
      eventCoins: {},
      season: 1
    }
  };
  
  fs.writeFileSync(DB_PATH, JSON.stringify(emptyDB, null, 2));
  
  console.log('✅ database.json очищен');
  console.log('📊 Новая база данных создана');
  process.exit(0);
} else {
  console.log('Запустите с аргументом --force для подтверждения:');
  console.log('node scripts/clear-json-db.js --force\n');
  process.exit(1);
}
