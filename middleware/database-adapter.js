#!/usr/bin/env node
// ==================== PostgreSQL Database Adapter ====================

const { Pool } = require('pg');

class DatabaseAdapter {
  constructor() {
    this.pool = null;
    this.usePostgreSQL = process.env.DATABASE_URL && process.env.NODE_ENV === 'production';
  }
  
  // Инициализация соединения
  async init() {
    if (this.usePostgreSQL) {
      await this.initPostgreSQL();
    } else {
      console.log('ℹ️  Используется file-based database (database.json)');
    }
  }
  
  // Инициализация PostgreSQL
  async initPostgreSQL() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      
      // Тест соединения
      const client = await this.pool.connect();
      console.log('✅ Подключено к PostgreSQL');
      client.release();
      
      // Создать таблицы если их нет
      await this.createTables();
      
    } catch (error) {
      console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
      throw error;
    }
  }
  
  // Создать таблицы
  async createTables() {
    const queries = [
      // Таблица аккаунтов
      `CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at BIGINT NOT NULL,
        last_login BIGINT NOT NULL
      )`,
      
      // Таблица игроков
      `CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(50) PRIMARY KEY,
        account_id VARCHAR(50) REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        coins INTEGER DEFAULT 0,
        total_coins INTEGER DEFAULT 0,
        per_click INTEGER DEFAULT 1,
        per_second INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        skills JSONB DEFAULT '{}',
        achievements JSONB DEFAULT '[]',
        skins JSONB DEFAULT '{"normal": true}',
        current_skin VARCHAR(50) DEFAULT 'normal',
        clan JSONB DEFAULT NULL,
        event_rewards INTEGER DEFAULT 0,
        pending_boxes JSONB DEFAULT '[]',
        created_at BIGINT NOT NULL,
        last_login BIGINT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица событий
      `CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        event_name VARCHAR(100) NOT NULL,
        start_time BIGINT NOT NULL,
        end_time BIGINT NOT NULL,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица награды событий
      `CREATE TABLE IF NOT EXISTS event_coins (
        account_id VARCHAR(50) REFERENCES accounts(id) ON DELETE CASCADE,
        event_name VARCHAR(100) NOT NULL,
        coins INTEGER DEFAULT 0,
        PRIMARY KEY (account_id, event_name)
      )`,
      
      // Индексы для производительности
      `CREATE INDEX IF NOT EXISTS idx_players_account_id ON players(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time)`
    ];
    
    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        console.error('❌ Ошибка создания таблицы:', error.message);
      }
    }
    
    console.log('✅ Таблицы созданы/обновлены');
  }
  
  // Чтение данных из PostgreSQL
  async getAccounts() {
    if (!this.usePostgreSQL) return {};
    
    const result = await this.pool.query('SELECT * FROM accounts');
    const accounts = {};
    result.rows.forEach(row => {
      accounts[row.id] = row;
    });
    return accounts;
  }
  
  async getPlayer(accountId) {
    if (!this.usePostgreSQL) return null;
    
    const result = await this.pool.query(
      'SELECT * FROM players WHERE account_id = $1',
      [accountId]
    );
    return result.rows[0] || null;
  }
  
  async getEventCoins(accountId) {
    if (!this.usePostgreSQL) return 0;
    
    const result = await this.pool.query(
      'SELECT coins FROM event_coins WHERE account_id = $1',
      [accountId]
    );
    return result.rows[0]?.coins || 0;
  }
  
  // Сохранение данных в PostgreSQL
  async saveAccount(account) {
    if (!this.usePostgreSQL) return;
    
    await this.pool.query(
      `INSERT INTO accounts (id, username, password_hash, created_at, last_login)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         last_login = EXCLUDED.last_login`,
      [account.id, account.username, account.passwordHash, account.createdAt, account.lastLogin]
    );
  }
  
  async savePlayer(player) {
    if (!this.usePostgreSQL) return;
    
    await this.pool.query(
      `INSERT INTO players (
        id, account_id, name, coins, total_coins, per_click, per_second,
        clicks, level, skills, achievements, skins, current_skin,
        clan, event_rewards, pending_boxes, created_at, last_login, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (id) DO UPDATE SET
        coins = EXCLUDED.coins,
        total_coins = EXCLUDED.total_coins,
        per_click = EXCLUDED.per_click,
        per_second = EXCLUDED.per_second,
        clicks = EXCLUDED.clicks,
        level = EXCLUDED.level,
        skills = EXCLUDED.skills,
        achievements = EXCLUDED.achievements,
        skins = EXCLUDED.skins,
        current_skin = EXCLUDED.current_skin,
        clan = EXCLUDED.clan,
        event_rewards = EXCLUDED.event_rewards,
        pending_boxes = EXCLUDED.pending_boxes,
        last_login = EXCLUDED.last_login,
        updated_at = NOW()`,
      [
        player.id, player.accountId, player.name, player.coins, player.totalCoins,
        player.perClick, player.perSecond, player.clicks, player.level,
        JSON.stringify(player.skills), JSON.stringify(player.achievements),
        JSON.stringify(player.skins), player.currentSkin,
        JSON.stringify(player.clan), player.eventRewards,
        JSON.stringify(player.pendingBoxes), player.createdAt, player.lastLogin
      ]
    );
  }
  
  async saveEventCoins(accountId, coins) {
    if (!this.usePostgreSQL) return;
    
    await this.pool.query(
      `INSERT INTO event_coins (account_id, event_name, coins)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, event_name) DO UPDATE SET coins = EXCLUDED.coins`,
      [accountId, 'default', coins]
    );
  }
  
  // Получить лидерборд
  async getLeaderboard(limit = 100) {
    if (!this.usePostgreSQL) return [];
    
    const result = await this.pool.query(
      `SELECT p.id, p.name, p.coins, p.total_coins, p.level, p.created_at
       FROM players p
       ORDER BY p.total_coins DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
  
  // Получить статистику
  async getStats() {
    if (!this.usePostgreSQL) {
      return { totalPlayers: 0, totalCoins: 0 };
    }
    
    const result = await this.pool.query(
      'SELECT COUNT(*) as total_players, COALESCE(SUM(total_coins), 0) as total_coins FROM players'
    );
    return {
      totalPlayers: parseInt(result.rows[0].total_players),
      totalCoins: parseInt(result.rows[0].total_coins)
    };
  }
  
  // Закрыть соединение
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 Соединение с PostgreSQL закрыто');
    }
  }
}

module.exports = new DatabaseAdapter();
