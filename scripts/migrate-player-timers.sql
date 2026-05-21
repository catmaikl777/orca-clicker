-- Добавляем колонки для таймеров (ивент, реклама)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS event_end_time BIGINT NULL,
ADD COLUMN IF NOT EXISTS ad_last_view BIGINT NULL,
ADD COLUMN IF NOT EXISTS ad_view_count INTEGER DEFAULT 0;

-- Установка дефолтных значений
UPDATE players SET ad_view_count = 0 WHERE ad_view_count IS NULL;

-- Проверка
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name IN ('event_end_time', 'ad_last_view', 'ad_view_count');
