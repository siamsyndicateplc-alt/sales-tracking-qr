const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const wsTokens = new Map();
let wss = null;

function init(httpServer) {
    wss = new WebSocketServer({ server: httpServer, path: '/ws/dashboard' });

    wss.on('connection', (ws, req) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const token = url.searchParams.get('token');
            const expiry = wsTokens.get(token);
            if (!token || !expiry || Date.now() > expiry) {
                ws.close(4401, 'Unauthorized');
                return;
            }
            wsTokens.delete(token);
            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });
            ws.send(JSON.stringify({ type: 'connected' }));
            console.log('[WS] Dashboard client connected');
        } catch (err) {
            ws.close(4400, 'Bad Request');
        }
    });

    // Heartbeat — drop dead connections every 30s
    const heartbeat = setInterval(() => {
        wss.clients.forEach(ws => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(heartbeat));
    console.log('[WS] Dashboard WebSocket server ready at /ws/dashboard');
}

function issueToken() {
    const token = crypto.randomBytes(24).toString('hex');
    wsTokens.set(token, Date.now() + 5 * 60 * 1000); // 5 min TTL
    for (const [t, exp] of wsTokens) if (Date.now() > exp) wsTokens.delete(t);
    return token;
}

function broadcast(msg) {
    if (!wss || wss.clients.size === 0) return;
    const payload = JSON.stringify(msg);
    wss.clients.forEach(ws => {
        if (ws.readyState === 1) ws.send(payload);
    });
}

module.exports = { init, issueToken, broadcast };
