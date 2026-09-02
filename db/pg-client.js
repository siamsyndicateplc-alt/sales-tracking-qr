const { Pool } = require('pg');
require('dotenv').config();

const cfg = {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: false,
    options:  '-c search_path=public'
};
console.log('[pg] connecting to', cfg.host, cfg.port, cfg.database, 'as', cfg.user);
const pool = new Pool(cfg);

pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
});

module.exports = pool;
