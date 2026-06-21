-- Миграция для добавления колонок ежедневной серии
-- Выполнить в базе данных PostgreSQL

-- Изменяем тип last_login_date если нужно
ALTER TABLE players ALTER COLUMN last_login_date TYPE VARCHAR(20) USING last_login_date::VARCHAR(20);

-- Добавляем колонки если их нет
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS last_login_date VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_reward_date VARCHAR(20) NULL;

-- Установка дефолтного значения для существующих записей
UPDATE players SET login_streak = 0 WHERE login_streak IS NULL;

-- Проверка
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name IN ('last_login_date', 'login_streak', 'last_streak_reward_date');
