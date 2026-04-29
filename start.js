#!/usr/bin/env node
// ==================== Запуск игры и админки ====================

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Запуск ORCA Clicker API + Админки...\n');

// Запуск основного сервера
const gameServer = spawn('node', [path.join(__dirname, 'websocket-server.js')], {
  stdio: 'inherit',
  shell: true
});

gameServer.on('error', (err) => {
  console.error('❌ Ошибка игрового сервера:', err.message);
});

// Запуск админки
const adminServer = spawn('node', [path.join(__dirname, 'admin-api.js')], {
  stdio: 'inherit',
  shell: true
});

adminServer.on('error', (err) => {
  console.error('❌ Ошибка админки:', err.message);
});

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('\n⏹️  Остановка серверов...');
  gameServer.kill();
  adminServer.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Остановка серверов...');
  gameServer.kill();
  adminServer.kill();
  process.exit(0);
});

console.log('✅ Оба сервера запущены. Нажмите Ctrl+C для остановки.');
console.log('🎮 Игра: http://localhost:3000');
console.log('⚙️  Админка: http://localhost:3002/admin.html\n');
