const express = require('express');
const router = express.Router();
const pool = require('../db/pg-client');

const sanitizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\p{M}\s\-_./()]/gu, '').trim().substring(0, 100);
};
const sanitizeLongString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().substring(0, 1000);
};
const sanitizeEmail = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[^\w.@+-]/g, '').trim().substring(0, 100);
};

router.get('/check-completed', async (req, res) => {
    const rawProject = req.query.project;
    if (!rawProject) {
        return res.status(400).json({ error: 'Missing required query parameter: project' });
    }

    const project = sanitizeString(rawProject);

    try {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const [surveyRes, eventRes, scanRes] = await Promise.all([
            pool.query('SELECT id FROM survey_results WHERE project_name = $1 LIMIT 1', [project]),
            pool.query(
                `SELECT id FROM events WHERE project_name = $1 AND event_type = ANY($2) AND timestamp >= $3 LIMIT 1`,
                [project, ['survey_submitted', 'declined_at_step_1'], oneDayAgo]
            ),
            pool.query(
                `SELECT id FROM events WHERE project_name = $1 AND event_type = 'scanned' AND timestamp >= $2 LIMIT 1`,
                [project, thirtyMinsAgo]
            )
        ]);

        res.json({
            completed: surveyRes.rows.length > 0,
            final_step_done: eventRes.rows.length > 0,
            scanned: scanRes.rows.length > 0
        });
    } catch (err) {
        console.error('Check completed failed:', err);
        res.status(500).json({ error: 'Failed to check completion status' });
    }
});

router.post('/', async (req, res) => {
    if (!req.body.employee_id || !req.body.score_q1 || !req.body.score_q2 || !req.body.score_q3 || !req.body.score_q4 || !req.body.pdpa_consent_1) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const session_id    = sanitizeString(req.body.session_id);
    const employee_id   = sanitizeString(req.body.employee_id);
    const employee_name = sanitizeString(req.body.employee_name);
    const project_name  = sanitizeString(req.body.project_name);
    const customer_name = sanitizeString(req.body.customer_name);
    const pdpa_consent_1 = sanitizeString(req.body.pdpa_consent_1);
    const score_q1 = parseInt(req.body.score_q1, 10);
    const score_q2 = parseInt(req.body.score_q2, 10);
    const score_q3 = parseInt(req.body.score_q3, 10);
    const score_q4 = parseInt(req.body.score_q4, 10);
    const improvements       = sanitizeLongString(req.body.improvements);
    const improvements_other = sanitizeLongString(req.body.improvements_other);
    const contact_name  = sanitizeString(req.body.contact_name);
    const contact_phone = sanitizeString(req.body.contact_phone);
    const contact_email = sanitizeEmail(req.body.contact_email);
    const pdpa_consent_2 = sanitizeString(req.body.pdpa_consent_2);

    try {
        if (session_id) {
            const { rows } = await pool.query(
                `SELECT id FROM events WHERE session_id = $1 AND event_type = 'survey_submitted' LIMIT 1`,
                [session_id]
            );
            if (rows.length > 0) {
                return res.json({ id: session_id, message: 'คุณได้ส่งความคิดเห็นนี้เรียบร้อยแล้ว' });
            }
        }

        if (project_name) {
            const { rows } = await pool.query(
                'SELECT id FROM survey_results WHERE project_name = $1 LIMIT 1',
                [project_name]
            );
            if (rows.length > 0) {
                return res.json({ id: 'duplicate', message: 'คุณได้ส่งความคิดเห็นนี้เรียบร้อยแล้ว' });
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO survey_results
             (session_id, employee_id, employee_name, project_name, customer_name,
              pdpa_consent_1, score_q1, score_q2, score_q3, score_q4,
              improvements, improvements_other, contact_name, contact_phone, contact_email, pdpa_consent_2)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             RETURNING id, submitted_at`,
            [session_id||'', employee_id||'', employee_name||'', project_name||'', customer_name||'',
             pdpa_consent_1||'', score_q1, score_q2, score_q3, score_q4,
             improvements||'', improvements_other||'', contact_name||'', contact_phone||'', contact_email||'', pdpa_consent_2||'']
        );

        res.json({ id: rows[0].id, submitted_at: rows[0].submitted_at, message: 'ขอบคุณสำหรับความเห็น' });
    } catch (err) {
        console.error('Survey insert failed:', err);
        res.status(500).json({ error: 'Failed to save survey' });
    }
});

module.exports = router;
