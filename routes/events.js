const express = require('express');
const router = express.Router();
const { insertRow } = require('../db/supabase-client');
const { randomUUID } = require('crypto');

const sanitizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s\-_./()]/g, '').trim().substring(0, 100);
};

/**
 * POST /api/events
 * Body: { session_id, event_type, employee_id, employee_name, customer_name, project_name, metadata }
 * 
 * event_type อาจเป็น:
 *   - "scanned"           → ลูกค้าสแกน QR Code สำเร็จ
 *   - "survey_submitted"  → ลูกค้าให้ดาวเสร็จแล้ว
 *   - "ms_forms_opened"   → ลูกค้ากดปุ่ม "ดำเนินการต่อ" ไป MS Forms
 *   - "skipped_ms_forms"  → ลูกค้ากด "ข้ามขั้นตอนนี้"
 */
router.post('/', async (req, res) => {
    // Basic Validation
    if (!req.body.session_id || !req.body.event_type) {
        return res.status(400).json({ error: 'Missing required fields: session_id, event_type' });
    }

    const session_id = sanitizeString(req.body.session_id);
    const event_type = sanitizeString(req.body.event_type);
    const employee_id = sanitizeString(req.body.employee_id);
    const employee_name = sanitizeString(req.body.employee_name);
    const customer_name = sanitizeString(req.body.customer_name);
    const project_name = sanitizeString(req.body.project_name);
    
    // metadata: store as JSON string without sanitizing (sanitizeString strips { } " : which destroys JSON)
    let metadata = req.body.metadata;
    if (metadata) {
        if (typeof metadata === 'object') {
            metadata = JSON.stringify(metadata);
        } else if (typeof metadata !== 'string') {
            metadata = null;
        }
    }

    const VALID_EVENTS = ['scanned', 'survey_submitted', 'ms_forms_opened', 'skipped_ms_forms'];
    if (!VALID_EVENTS.includes(event_type)) {
        return res.status(400).json({ error: `Invalid event_type. Must be one of: ${VALID_EVENTS.join(', ')}` });
    }

    const id = randomUUID();
    const timestamp = new Date().toISOString();

    try {
        await insertRow('events', {
            id,
            timestamp,
            session_id,
            event_type,
            employee_id: employee_id || '',
            employee_name: employee_name || '',
            customer_name: customer_name || '',
            project_name: project_name || '',
            metadata: metadata || null
        });

        res.json({ id, timestamp, event_type, message: 'Event recorded' });
    } catch (err) {
        console.error('Event tracking failed:', err);
        res.status(500).json({ error: 'Failed to record event' });
    }
});

module.exports = router;
