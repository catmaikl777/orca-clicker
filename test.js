const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3003 });

server.on('connection', (ws, req) => {
    console.log('✅ Клиент ПОДКЛЮЧИЛСЯ! URL:', req.url);
    
    ws.on('message', (msg) => {
        console.log('📨 Получено сообщение:', msg.toString());
        ws.send(`Эхо: ${msg}`);
    });
    
    ws.send('Привет от тестового сервера!');
    console.log('📤 Отправлено приветствие клиенту');
});

console.log('✅ Тестовый WebSocket сервер ЗАПУЩЕН на порту 3003');
console.log('Ожидание подключений...');