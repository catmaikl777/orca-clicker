#!/usr/bin/env node
// ==================== Запуск игры и админки ====================

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Запуск ORCA Clicker API + Админки...\n');

// Запуск основного сервера (игра + админка)
const gameServer = spawn('node', [path.join(__dirname, 'websocket-server.js')], {
  stdio: 'inherit',
  shell: true
});

gameServer.on('error', (err) => {
  console.error('❌ Ошибка сервера:', err.message);
});

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('\n⏹️  Остановка сервера...');
  gameServer.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Остановка сервера...');
  gameServer.kill();
  process.exit(0);
});

console.log('✅ Сервер запущен. Нажмите Ctrl+C для остановки.');
console.log('🎮 Игра: http://localhost:3000');
console.log('⚙️  Админка: http://localhost:3000/admin.html\n');
