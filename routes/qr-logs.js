const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    const { employee_id, employee_name, project_name, customer_name, generated_url } = req.body;

    if (!employee_id || !employee_name || !project_name || !customer_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        if (process.env.DB_HOST) {
            const pool = require('../db/pg-client');
            if (project_name) {
                const { rows } = await pool.query('SELECT * FROM qr_logs WHERE project_name = $1 LIMIT 1', [project_name]);
                if (rows.length > 0) {
                    return res.json({ already_exists: true, ...rows[0] });
                }
            }
            const { rows } = await pool.query(
                `INSERT INTO qr_logs (employee_id, employee_name, project_name, customer_name, generated_url, user_agent)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
                [employee_id, employee_name, project_name||'', customer_name||'', generated_url||'', req.headers['user-agent']||'']
            );
            return res.json({ id: rows[0].id, created_at: rows[0].created_at });
        } else {
            const { supabase, insertRow } = require('../db/supabase-client');
            const { randomUUID } = require('crypto');
            if (project_name) {
                const { data: existing } = await supabase.from('qr_logs').select('*').eq('project_name', project_name).limit(1);
                if (existing && existing.length > 0) {
                    return res.json({ already_exists: true, ...existing[0] });
                }
            }
            const id = randomUUID();
            const created_at = new Date().toISOString();
            await insertRow('qr_logs', {
                id, created_at, employee_id, employee_name,
                project_name: project_name||'', customer_name: customer_name||'',
                generated_url: generated_url||'', user_agent: req.headers['user-agent']||''
            });
            return res.json({ id, created_at });
        }
    } catch (err) {
        console.error('QR log failed:', err);
        res.status(500).json({ error: 'Failed to log QR generation' });
    }
});

module.exports = router;
