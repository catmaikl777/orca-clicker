#!/usr/bin/env node
// ==================== PostgreSQL Database Adapter ====================

const { Pool } = require('pg');

class DatabaseAdapter {
  constructor() {
    this.pool = null;
    this.usePostgreSQL = process.env.DATABASE_URL && process.env.NODE_ENV === 'production';
    this.initialized = false;
  }
  
  // Инициализация соединения
  async init() {
    if (this.usePostgreSQL) {
      await this.initWithRetry();
    } else {
      console.log('ℹ️  Используется file-based database (database.json)');
    }
    this.initialized = true;
  }

  async initWithRetry(attempts = 5, delay = 3000) {
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.initPostgreSQL();
        return;
      } catch (err) {
        console.error(`❌ Попытка ${i}/${attempts} не удалась: ${err.message}`);
        if (i < attempts) {
          console.log(`⏳ Повтор через ${delay / 1000}с...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.error('❌ PostgreSQL недоступен, переключаемся на file-based DB');
          this.usePostgreSQL = false;
        }
      }
    }
  }
  
  // Инициализация PostgreSQL
  async initPostgreSQL() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        query_timeout: 15000,
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
        account_id VARCHAR(50) REFERENCES accounts(id) ON DELETE SET NULL,
        name VARCHAR(100) NOT NULL,
        coins BIGINT DEFAULT 0,
        total_coins BIGINT DEFAULT 0,
        per_click INTEGER DEFAULT 1,
        per_second INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        skills JSONB DEFAULT '{}',
        achievements JSONB DEFAULT '[]',
        skins JSONB DEFAULT '{"normal": true}',
        current_skin VARCHAR(50) DEFAULT 'normal',
        clan JSONB DEFAULT NULL,
        event_rewards BIGINT DEFAULT 0,
        pending_boxes JSONB DEFAULT '[]',
        created_at BIGINT NOT NULL,
        last_login BIGINT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Миграция INTEGER -> BIGINT для coins и total_coins
      `ALTER TABLE players ALTER COLUMN coins TYPE BIGINT USING coins::BIGINT`,
      `ALTER TABLE players ALTER COLUMN total_coins TYPE BIGINT USING total_coins::BIGINT`,
      `ALTER TABLE players ALTER COLUMN event_rewards TYPE BIGINT USING event_rewards::BIGINT`,
      
      // Добавить поля бана в players (для совместимости)
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS banned_at BIGINT`,
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(255)`,
      
      // Обновить внешний ключ если таблица уже существует (для миграции)
      `DO $$ 
      BEGIN 
        BEGIN 
          ALTER TABLE players DROP CONSTRAINT IF EXISTS players_account_id_fkey;
          ALTER TABLE players ADD CONSTRAINT players_account_id_fkey 
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
        EXCEPTION 
          WHEN OTHERS THEN NULL;
        END;
      END $$;`,
      
      // Таблица событий
      `CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        event_name VARCHAR(100) NOT NULL,
        start_time BIGINT NOT NULL,
        end_time BIGINT NOT NULL,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица банов
      `CREATE TABLE IF NOT EXISTS bans (
        id VARCHAR(50) PRIMARY KEY,
        reason VARCHAR(255) NOT NULL,
        banned_at BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица кланов
      `CREATE TABLE IF NOT EXISTS clans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner VARCHAR(50) NOT NULL,
        owner_name VARCHAR(100) NOT NULL,
        members JSONB DEFAULT '[]',
        member_names JSONB DEFAULT '[]',
        total_coins INTEGER DEFAULT 0,
        created_at BIGINT NOT NULL,
        description TEXT DEFAULT ''
      )`,
      
      // Таблица награды событий
      `CREATE TABLE IF NOT EXISTS event_coins (
        account_id VARCHAR(50) REFERENCES accounts(id) ON DELETE SET NULL,
        event_name VARCHAR(100) NOT NULL,
        coins INTEGER DEFAULT 0,
        PRIMARY KEY (account_id, event_name)
      )`,

      // Индексы для производительности
      `CREATE INDEX IF NOT EXISTS idx_players_account_id ON players(account_id)`,
      `CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time)`,
      `CREATE INDEX IF NOT EXISTS idx_bans_id ON bans(id)`
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
  
  async getAllEventCoins() {
    if (!this.usePostgreSQL) return {};
    
    const result = await this.pool.query(
      'SELECT account_id, event_name, coins FROM event_coins'
    );
    const eventCoins = {};
    result.rows.forEach(row => {
      if (!eventCoins[row.account_id]) eventCoins[row.account_id] = 0;
      eventCoins[row.account_id] += row.coins;
    });
    return eventCoins;
  }
  
  async getBans() {
    if (!this.usePostgreSQL) return {};
    
    const result = await this.pool.query('SELECT * FROM bans');
    const bans = {};
    result.rows.forEach(row => {
      bans[row.id] = { reason: row.reason, bannedAt: row.banned_at };
    });
    return bans;
  }
  
  // Сохранение данных в PostgreSQL
  async saveAccount(account) {
    if (!this.usePostgreSQL) return;
    
    const createdAt = account.createdAt || account.created_at || Date.now();
    const lastLogin = account.lastLogin || account.last_login || createdAt;
    
    await this.pool.query(
      `INSERT INTO accounts (id, username, password_hash, created_at, last_login)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         last_login = EXCLUDED.last_login`,
      [account.id, account.username, account.passwordHash || account.password_hash, createdAt, lastLogin]
    );
  }
  
  async savePlayer(player) {
    if (!this.usePostgreSQL) return;
    
    // Убедимся что createdAt и lastLogin всегда есть
    const createdAt = player.createdAt || player.created_at || Date.now();
    const lastLogin = player.lastLogin || player.last_login || Date.now();
    
    // Преобразуем JSON поля в строки
    let skills, achievements, skins;
    try {
      skills = typeof player.skills === 'string' ? player.skills : JSON.stringify(player.skills || {});
      achievements = typeof player.achievements === 'string' ? player.achievements : JSON.stringify(player.achievements || []);
      skins = typeof player.skins === 'string' ? player.skins : JSON.stringify(player.skins || { normal: true });
    } catch (e) {
      console.error('Ошибка сериализации JSON полей:', e.message, { skills: player.skills, achievements: player.achievements, skins: player.skins });
      skills = '{}';
      achievements = '[]';
      skins = '{"normal": true}';
    }
    
    // clan может быть null или объект/строка
    let clan;
    if (player.clan === null || player.clan === undefined || player.clan === '') {
      clan = null;
    } else if (typeof player.clan === 'string') {
      clan = player.clan;
    } else {
      try {
        clan = JSON.stringify(player.clan);
      } catch (e) {
        console.error('Ошибка сериализации clan:', e.message, player.clan);
        clan = null;
      }
    }
    
    let pendingBoxes;
    try {
      pendingBoxes = typeof player.pendingBoxes === 'string' ? player.pendingBoxes : JSON.stringify(player.pendingBoxes || []);
    } catch (e) {
      console.error('Ошибка сериализации pendingBoxes:', e.message, player.pendingBoxes);
      pendingBoxes = '[]';
    }
    
    // accountId может быть null для гостей
    const accountId = player.accountId || null;
    
    // Обработка полей бана из antiCheat
    const bannedAt = player.antiCheat?.bannedAt || null;
    const banReason = player.antiCheat?.banReason || null;
    
    await this.pool.query(
      `INSERT INTO players (
        id, account_id, name, coins, total_coins, per_click, per_second,
        clicks, level, skills, achievements, skins, current_skin,
        clan, event_rewards, pending_boxes, created_at, last_login, updated_at,
        banned_at, ban_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), $19, $20)
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
        updated_at = NOW(),
        banned_at = EXCLUDED.banned_at,
        ban_reason = EXCLUDED.ban_reason`,
      [
        player.id, accountId, player.name, player.coins, player.totalCoins,
        player.perClick, player.perSecond, player.clicks, player.level,
        skills, achievements, skins, player.currentSkin || 'normal',
        clan, player.eventRewards || 0, pendingBoxes, createdAt, lastLogin,
        bannedAt, banReason
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
  
  async saveBan(playerId, reason) {
    if (!this.usePostgreSQL) return;
    
    await this.pool.query(
      `INSERT INTO bans (id, reason, banned_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         reason = EXCLUDED.reason,
         banned_at = EXCLUDED.banned_at`,
      [playerId, reason, Date.now()]
    );
  }
  
  // === КЛАНЫ ===
  async saveClan(clan) {
    if (!this.usePostgreSQL) return;

    const members = typeof clan.members === 'string' ? clan.members : JSON.stringify(clan.members || []);
    const memberNames = typeof clan.memberNames === 'string' ? clan.memberNames : JSON.stringify(clan.memberNames || []);

    await this.pool.query(
      `INSERT INTO clans (id, name, owner, owner_name, members, member_names, total_coins, created_at, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         owner = EXCLUDED.owner,
         owner_name = EXCLUDED.owner_name,
         members = EXCLUDED.members,
         member_names = EXCLUDED.member_names,
         total_coins = EXCLUDED.total_coins,
         description = EXCLUDED.description`,
      [clan.id, clan.name, clan.owner, clan.ownerName || clan.owner_name || 'Unknown', members, memberNames, clan.totalCoins || 0, clan.createdAt || Date.now(), clan.description || '']
    );
  }
  
  async deleteClan(clanId) {
    if (!this.usePostgreSQL) return;

    await this.pool.query('DELETE FROM clans WHERE id = $1', [clanId]);
  }

  async getAllClans() {
    if (!this.usePostgreSQL) return [];

    const result = await this.pool.query('SELECT * FROM clans');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      owner: row.owner,
      ownerName: row.owner_name,
      members: typeof row.members === 'string' ? JSON.parse(row.members) : row.members || [],
      memberNames: typeof row.member_names === 'string' ? JSON.parse(row.member_names) : row.member_names || [],
      totalCoins: row.total_coins || 0,
      createdAt: row.created_at || Date.now(),
      description: row.description || ''
    }));
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
