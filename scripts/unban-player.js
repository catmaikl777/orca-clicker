// Скрипт для разбана игрока по username
// Использование: node scripts/unban-player.js <username>

const fs = require('fs');
const path = require('path');

// Получаем username из аргументов
const username = process.argv[2] || 'catmaikl777';

if (!username) {
  console.error('❌ Укажите username игрока');
  console.error('Пример: node scripts/unban-player.js catmaikl777');
  process.exit(1);
}

console.log(`🔍 Поиск игрока: ${username}`);

// Пути к базе данных
const dbPath = path.join(__dirname, '..', 'database.json');

// Загружаем базу данных
let db;
try {
  db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
} catch (e) {
  console.error('❌ Ошибка чтения database.json:', e.message);
  process.exit(1);
}

// Ищем аккаунт по username
const accountId = Object.keys(db.accounts || {}).find(id => 
  db.accounts[id].username.toLowerCase() === username.toLowerCase()
);

if (!accountId) {
  console.error(`❌ Аккаунт "${username}" не найден`);
  process.exit(1);
}

console.log(`✅ Аккаунт найден: ID = ${accountId}`);

// Проверяем есть ли игрок
const player = db.players[accountId];
if (!player) {
  console.error(`❌ Игрок с accountId ${accountId} не найден в db.players`);
  process.exit(1);
}

// Проверяем есть ли бан
if (!player.antiCheat || !player.antiCheat.bannedUntil) {
  console.log(`ℹ️ Игрок ${username} не забанен`);
  process.exit(0);
}

console.log(`🚫 Текущий статус: ЗАБАНЕН`);
console.log(`   Причина: ${player.antiCheat.banReason || 'Не указана'}`);
console.log(`   Дата бана: ${new Date(player.antiCheat.bannedAt || Date.now()).toLocaleString()}`);

// Удаляем бан
const oldBanData = { ...player.antiCheat };
player.antiCheat = null;

// Сохраняем изменения
try {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('✅ Бан успешно снят!');
  console.log(`📝 Игрок ${username} (${accountId}) теперь может играть`);
} catch (e) {
  console.error('❌ Ошибка сохранения:', e.message);
  process.exit(1);
}

// Если используется PostgreSQL, нужно обновить и там
console.log('\n⚠️ Если используется PostgreSQL, также выполните SQL запрос:');
console.log(`   DELETE FROM bans WHERE player_id = '${accountId}';`);
console.log(`   ИЛИ обновите игрока:`);
console.log(`   UPDATE players SET anti_cheat = NULL WHERE id = '${accountId}';`);
