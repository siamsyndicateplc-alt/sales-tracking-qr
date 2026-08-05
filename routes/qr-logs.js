const express = require('express');
const router = express.Router();
const pool = require('../db/pg-client');

router.post('/', async (req, res) => {
    const { employee_id, employee_name, project_name, customer_name, generated_url } = req.body;

    if (!employee_id || !employee_name || !project_name || !customer_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        if (project_name) {
            const { rows } = await pool.query(
                'SELECT * FROM qr_logs WHERE project_name = $1 LIMIT 1',
                [project_name]
            );
            if (rows.length > 0) {
                const existing = rows[0];
                return res.json({
                    already_exists: true,
                    id: existing.id,
                    created_at: existing.created_at,
                    employee_id: existing.employee_id,
                    employee_name: existing.employee_name,
                    project_name: existing.project_name,
                    customer_name: existing.customer_name,
                    generated_url: existing.generated_url
                });
            }
        }

        const user_agent = req.headers['user-agent'] || '';
        const { rows } = await pool.query(
            `INSERT INTO qr_logs (employee_id, employee_name, project_name, customer_name, generated_url, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
            [employee_id, employee_name, project_name || '', customer_name || '', generated_url || '', user_agent]
        );
        res.json({ id: rows[0].id, created_at: rows[0].created_at });
    } catch (err) {
        console.error('qr-logs insert failed:', err);
        res.status(500).json({ error: 'Failed to log QR generation' });
    }
});

module.exports = router;
