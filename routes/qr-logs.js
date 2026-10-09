const express = require('express');
const router = express.Router();
const crypto = require('crypto');

function generateToken() {
    return crypto.randomBytes(5).toString('hex'); // 10 chars e.g. "a3f9b2c1d4"
}

function fixUrl(url) {
    if (!url) return url;
    const base = process.env.QR_REDIRECT_BASE_URL || '';
    if (base && url.includes('localhost')) {
        const origin = base.replace('/scan.html', '');
        return url.replace(/https?:\/\/localhost:\d+/, origin);
    }
    return url;
}

function buildShortUrl(token) {
    const base = process.env.QR_REDIRECT_BASE_URL || '';
    // Strip everything from /scan.html onward to get clean origin
    const origin = base ? base.replace(/\/scan\.html.*$/, '').replace(/\/$/, '') : '';
    return `${origin}/s/${token}`;
}

// Resolve token → return emp/project/customer data (checks expiry)
router.get('/resolve/:token', async (req, res) => {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    try {
        const pool = require('../db/pg-client');
        const { rows } = await pool.query(
            'SELECT employee_id, employee_name, project_name, customer_name, expires_at FROM qr_logs WHERE scan_token = $1 LIMIT 1',
            [token]
        );
        if (!rows.length) return res.status(404).json({ error: 'QR Code ไม่ถูกต้อง' });
        if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
            return res.status(410).json({ error: 'QR Code หมดอายุแล้ว กรุณาขอ QR Code ใหม่จากเจ้าหน้าที่' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Resolve token failed:', err);
        res.status(500).json({ error: 'Failed to resolve token' });
    }
});

router.post('/', async (req, res) => {
    const { employee_id, employee_name, project_name, customer_name, generated_url } = req.body;

    if (!employee_id || !employee_name || !project_name || !customer_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        if (process.env.DB_HOST) {
            const pool = require('../db/pg-client');
            if (project_name) {
                const { rows } = await pool.query('SELECT * FROM qr_logs WHERE project_name = $1 ORDER BY created_at DESC LIMIT 1', [project_name]);
                if (rows.length > 0) {
                    const row = rows[0];
                    const expired = row.expires_at && new Date(row.expires_at) < new Date();
                    if (!expired) {
                        const token = row.scan_token;
                        const shortUrl = token ? buildShortUrl(token) : fixUrl(row.generated_url);
                        return res.json({ already_exists: true, ...row, short_url: shortUrl });
                    }
                    // expired — fall through to create new QR
                }
            }
            const token = generateToken();
            const shortUrl = buildShortUrl(token);
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
            const { rows } = await pool.query(
                `INSERT INTO qr_logs (employee_id, employee_name, project_name, customer_name, generated_url, scan_token, expires_at, user_agent)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at, scan_token`,
                [employee_id, employee_name, project_name||'', customer_name||'', generated_url||'', token, expiresAt, req.headers['user-agent']||'']
            );
            return res.json({ id: rows[0].id, created_at: rows[0].created_at, scan_token: token, short_url: shortUrl });
        } else {
            const { supabase, insertRow } = require('../db/supabase-client');
            const { randomUUID } = require('crypto');
            if (project_name) {
                const { data: existing } = await supabase.from('qr_logs').select('*').eq('project_name', project_name).limit(1);
                if (existing && existing.length > 0) {
                    const row = existing[0];
                    const token = row.scan_token;
                    const shortUrl = token ? buildShortUrl(token) : fixUrl(row.generated_url);
                    return res.json({ already_exists: true, ...row, short_url: shortUrl });
                }
            }
            const id = randomUUID();
            const created_at = new Date().toISOString();
            const token = generateToken();
            const shortUrl = buildShortUrl(token);
            await insertRow('qr_logs', {
                id, created_at, employee_id, employee_name,
                project_name: project_name||'', customer_name: customer_name||'',
                generated_url: generated_url||'', scan_token: token, user_agent: req.headers['user-agent']||''
            });
            return res.json({ id, created_at, scan_token: token, short_url: shortUrl });
        }
    } catch (err) {
        console.error('QR log failed:', err);
        res.status(500).json({ error: 'Failed to log QR generation' });
    }
});

module.exports = router;
