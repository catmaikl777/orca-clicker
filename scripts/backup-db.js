#!/usr/bin/env node
// ==================== Скрипт автоматического бэкапа ====================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Конфигурация
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const DB_FILE = process.env.DB_FILE || './database.json';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS) || 7;

// Создать директорию для бэкапов
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Создана директория для бэкапов: ${BACKUP_DIR}`);
  }
}

// Создать бэкап
function createBackup() {
  try {
    ensureBackupDir();
    
    if (!fs.existsSync(DB_FILE)) {
      console.log('⚠️  Файл базы данных не найден, пропускаем бэкап');
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    
    // Копируем файл базы данных
    fs.copyFileSync(DB_FILE, backupPath);
    console.log(`✅ Бэкап создан: ${backupPath}`);
    
    // Сжимаем бэкап (опционально)
    const compressedPath = backupPath + '.gz';
    try {
      execSync(`gzip -c "${backupPath}" > "${compressedPath}"`);
      fs.unlinkSync(backupPath); // Удаляем исходный файл после сжатия
      console.log(`📦 Бэкап сжат: ${compressedPath}`);
    } catch (err) {
      console.log('ℹ️  Gzip не доступен, бэкап сохранён без сжатия');
    }
    
    // Удаляем старые бэкапы
    cleanupOldBackups();
    
  } catch (error) {
    console.error('❌ Ошибка при создании бэкапа:', error.message);
  }
}

// Удалить старые бэкапы
function cleanupOldBackups() {
  try {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup-'))
      .sort()
      .reverse();
    
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach(file => {
        const filePath = path.join(BACKUP_DIR, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️  Удалён старый бэкап: ${file}`);
      });
    }
  } catch (error) {
    console.error('❌ Ошибка при очистке старых бэкапов:', error.message);
  }
}

// Восстановить из бэкапа
function restoreBackup(backupFile) {
  try {
    if (!fs.existsSync(backupFile)) {
      console.error(`❌ Файл бэкапа не найден: ${backupFile}`);
      return false;
    }
    
    // Проверяем gzip сжатие
    let sourceFile = backupFile;
    if (backupFile.endsWith('.gz')) {
      const tempFile = backupFile.replace('.gz', '');
      execSync(`gunzip -c "${backupFile}" > "${tempFile}"`);
      sourceFile = tempFile;
    }
    
    fs.copyFileSync(sourceFile, DB_FILE);
    console.log(`✅ База данных восстановлена из: ${backupFile}`);
    return true;
  } catch (error) {
    console.error('❌ Ошибка при восстановлении:', error.message);
    return false;
  }
}

// Получить список всех бэкапов
function listBackups() {
  try {
    ensureBackupDir();
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup-'))
      .sort()
      .reverse();
    
    if (backups.length === 0) {
      console.log('ℹ️  Нет сохранённых бэкапов');
      return [];
    }
    
    console.log('📋 Список бэкапов:');
    backups.forEach((file, index) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`  ${index + 1}. ${file} (${size} KB) - ${stats.mtime.toLocaleString()}`);
    });
    
    return backups;
  } catch (error) {
    console.error('❌ Ошибка при получении списка бэкапов:', error.message);
    return [];
  }
}

// Автоматический бэкап по расписанию
function scheduleAutoBackup(hours = 24) {
  console.log(`⏰ Автоматический бэкап запланирован каждые ${hours} часов`);
  
  setInterval(() => {
    console.log('🔄 Запуск автоматического бэкапа...');
    createBackup();
  }, hours * 60 * 60 * 1000);
}

// CLI команды
const command = process.argv[2];

switch (command) {
  case 'create':
    createBackup();
    break;
  
  case 'restore':
    const backupFile = process.argv[3];
    if (!backupFile) {
      console.error('❌ Укажите файл бэкапа для восстановления');
      process.exit(1);
    }
    restoreBackup(backupFile);
    break;
  
  case 'list':
    listBackups();
    break;
  
  case 'auto':
    const hours = parseInt(process.argv[3]) || 24;
    scheduleAutoBackup(hours);
    // Создаём начальный бэкап
    createBackup();
    break;
  
  default:
    console.log('📚 Использование:');
    console.log('  node scripts/backup-db.js create     - Создать бэкап');
    console.log('  node scripts/backup-db.js restore <file> - Восстановить из бэкапа');
    console.log('  node scripts/backup-db.js list       - Показать список бэкапов');
    console.log('  node scripts/backup-db.js auto [hours] - Запустить автоматический бэкап');
    console.log('\nПеременные окружения:');
    console.log('  BACKUP_DIR   - Директория для бэкапов (по умолчанию: ./backups)');
    console.log('  DB_FILE      - Путь к файлу базы данных (по умолчанию: ./database.json)');
    console.log('  MAX_BACKUPS  - Максимальное количество бэкапов (по умолчанию: 7)');
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  scheduleAutoBackup
};
