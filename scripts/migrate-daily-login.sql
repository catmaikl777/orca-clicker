-- Миграция для добавления колонок ежедневной серии
-- Выполнить в базе данных PostgreSQL

-- Добавляем колонки если их нет
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS daily_login_date VARCHAR(10) NULL,
ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0;

-- Установка дефолтного значения для существующих записей
UPDATE players SET login_streak = 0 WHERE login_streak IS NULL;

-- Проверка
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name IN ('daily_login_date', 'login_streak');
