-- Скрипт для конвертации всех TIMESTAMP колонок в BIGINT
-- Запуск: psql $DATABASE_URL -f de


-- Проверка текущих типов
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name IN ('created_at', 'last_login', 'updated_at', 'banned_at');

-- Конвертация в BIGINT
ALTER TABLE players ALTER COLUMN created_at TYPE BIGINT USING EXTRACT(EPOCH FROM created_at)::BIGINT * 1000;
ALTER TABLE players ALTER COLUMN last_login TYPE BIGINT USING EXTRACT(EPOCH FROM last_login)::BIGINT * 1000;
ALTER TABLE players ALTER COLUMN updated_at TYPE BIGINT USING EXTRACT(EPOCH FROM updated_at)::BIGINT * 1000;
ALTER TABLE players ALTER COLUMN banned_at TYPE BIGINT USING EXTRACT(EPOCH FROM banned_at)::BIGINT * 1000;

-- Проверка результата
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name IN ('created_at', 'last_login', 'updated_at', 'banned_at');
