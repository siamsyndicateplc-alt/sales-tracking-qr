const express = require('express');
const router = express.Router();
const pool = require('../db/pg-client');

const sanitizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\p{M}\s\-_./()]/gu, '').trim().substring(0, 100);
};

const VALID_EVENTS = ['scanned', 'survey_submitted', 'ms_forms_opened', 'skipped_ms_forms', 'declined_at_step_1'];

router.post('/', async (req, res) => {
    if (!req.body.session_id || !req.body.event_type) {
        return res.status(400).json({ error: 'Missing required fields: session_id, event_type' });
    }

    const session_id = sanitizeString(req.body.session_id);
    const event_type = sanitizeString(req.body.event_type);
    const employee_id = sanitizeString(req.body.employee_id);
    const employee_name = sanitizeString(req.body.employee_name);
    const customer_name = sanitizeString(req.body.customer_name);
    const project_name = sanitizeString(req.body.project_name);

    let metadata = req.body.metadata || null;
    if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata); } catch { metadata = null; }
    }

    if (!VALID_EVENTS.includes(event_type)) {
        return res.status(400).json({ error: `Invalid event_type. Must be one of: ${VALID_EVENTS.join(', ')}` });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO events (session_id, event_type, employee_id, employee_name, customer_name, project_name, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, timestamp`,
            [session_id, event_type, employee_id || '', employee_name || '', customer_name || '', project_name || '', metadata ? JSON.stringify(metadata) : null]
        );
        res.json({ id: rows[0].id, timestamp: rows[0].timestamp, event_type, message: 'Event recorded' });
    } catch (err) {
        console.error('Event tracking failed:', err);
        res.status(500).json({ error: 'Failed to record event' });
    }
});

module.exports = router;
