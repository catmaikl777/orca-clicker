const { Client } = require('pg');

// Подключаемся к PostgreSQL с SSL
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true  // Включаем SSL для защищенного подключения
});

async function main() {
    try {
        await client.connect();
        console.log('Подключено к PostgreSQL');

        // Находим игроков с "Player" в имени
        const res = await client.query('SELECT id, name FROM players WHERE name LIKE $1', ['%Player%']);
        const playersToDelete = res.rows;

        console.log(`Найдено ${playersToDelete.length} игроков для удаления:`);
        playersToDelete.forEach(p => console.log(`- ${p.name} (ID: ${p.id})`));

        if (playersToDelete.length > 0) {
            const ids = playersToDelete.map(p => p.id);

            // Удаляем связанные аккаунты
            await client.query('DELETE FROM accounts WHERE id = ANY($1)', [ids]);
            console.log('Удалены аккаунты');

            // Удаляем игроков
            await client.query('DELETE FROM players WHERE id = ANY($1)', [ids]);
            console.log('Удалены игроки');
        }

        console.log('Очистка завершена!');
    } catch (error) {
        console.error('Ошибка:', error);
    } finally {
        await client.end();
    }
}

main();