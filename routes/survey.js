const express = require('express');
const router = express.Router();
const { supabase, insertRow } = require('../db/supabase-client');
const { randomUUID } = require('crypto');

// Helper functions for sanitizing inputs
const sanitizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\p{M}\s\-_./()]/gu, '').trim().substring(0, 100);
};

// \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A field \u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27 \u0E40\u0E0A\u0E48\u0E19 \u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19 \u0E41\u0E25\u0E30\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1B\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E38\u0E07
const sanitizeLongString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().substring(0, 1000);
};

const sanitizeEmail = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[^\w.@+-]/g, '').trim().substring(0, 100);
};

// ตรวจสอบการส่งแบบประเมินซ้ำ (GET /api/survey/check-completed)
router.get('/check-completed', async (req, res) => {
    const rawProject = req.query.project;

    if (!rawProject) {
        return res.status(400).json({ error: 'Missing required query parameter: project' });
    }

    const project = sanitizeString(rawProject);

    try {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const oneDayAgo = new Date(Date.now() - ONE_DAY_MS).toISOString();
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const [surveyResponse, eventResponse, scanResponse] = await Promise.all([
            supabase
                .from('survey_results')
                .select('id')
                .eq('project_name', project)
                .limit(1),
            supabase
                .from('events')
                .select('id')
                .eq('project_name', project)
                .in('event_type', ['survey_submitted', 'declined_at_step_1'])
                .gte('timestamp', oneDayAgo)
                .limit(1),
            supabase
                .from('events')
                .select('id')
                .eq('project_name', project)
                .eq('event_type', 'scanned')
                .gte('timestamp', thirtyMinsAgo)
                .limit(1)
        ]);

        const alreadyCompleted = surveyResponse.data && surveyResponse.data.length > 0;
        const finalStepDone = eventResponse.data && eventResponse.data.length > 0;
        const recentlyScanned = scanResponse.data && scanResponse.data.length > 0;

        res.json({ 
            completed: !!alreadyCompleted,
            final_step_done: !!finalStepDone,
            scanned: !!recentlyScanned
        });
    } catch (err) {
        console.error('Check completed failed:', err);
        res.status(500).json({ error: 'Failed to check completion status' });
    }
});

router.post('/', async (req, res) => {
    // Validation
    if (!req.body.employee_id || !req.body.score_q1 || !req.body.score_q2 || !req.body.score_q3 || !req.body.score_q4 || !req.body.pdpa_consent_1) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const session_id = sanitizeString(req.body.session_id);
    const employee_id = sanitizeString(req.body.employee_id);
    const employee_name = sanitizeString(req.body.employee_name);
    const project_name = sanitizeString(req.body.project_name);
    const customer_name = sanitizeString(req.body.customer_name);
    const pdpa_consent_1 = sanitizeString(req.body.pdpa_consent_1);
    const score_q1 = parseInt(req.body.score_q1, 10);
    const score_q2 = parseInt(req.body.score_q2, 10);
    const score_q3 = parseInt(req.body.score_q3, 10);
    const score_q4 = parseInt(req.body.score_q4, 10);
    const improvements = sanitizeLongString(req.body.improvements);
    const improvements_other = sanitizeLongString(req.body.improvements_other);
    const contact_name = sanitizeString(req.body.contact_name);
    const contact_phone = sanitizeString(req.body.contact_phone);
    const contact_email = sanitizeEmail(req.body.contact_email);
    const pdpa_consent_2 = sanitizeString(req.body.pdpa_consent_2);

    try {
        // 1. ป้องกันการบันทึกซ้ำ (Idempotency) ที่ฝั่ง Server โดยตรวจเช็คจาก session_id ในตาราง events
        if (session_id) {
            const { data: events, error } = await supabase
                .from('events')
                .select('id')
                .eq('session_id', session_id)
                .eq('event_type', 'survey_submitted')
                .limit(1);

            if (error) {
                console.warn('Failed to fetch events for duplicate check, skipping:', error);
            } else if (events && events.length > 0) {
                console.log(`[Duplicate survey block] session_id: ${session_id} has already submitted score.`);
                return res.json({ id: session_id, message: 'คุณได้ส่งความคิดเห็นนี้เรียบร้อยแล้ว' });
            }
        }

        // 2. ป้องกันการบันทึกซ้ำแบบข้าม Session — ใช้ชื่อโครงการ (เลข Job งาน) ในการตรวจสอบระบบ
        if (project_name) {
            const { data: surveys, error: surveyError } = await supabase
                .from('survey_results')
                .select('id')
                .eq('project_name', project_name)
                .limit(1);

            if (surveyError) {
                console.warn('Failed to fetch survey results for backend cross-session duplicate check:', surveyError);
            } else if (surveys && surveys.length > 0) {
                console.log(`[Duplicate survey block] project (Job Number): ${project_name} has already submitted score.`);
                return res.json({ id: 'duplicate', message: 'คุณได้ส่งความคิดเห็นนี้เรียบร้อยแล้ว' });
            }
        }

        const id = randomUUID();
        const submitted_at = new Date().toISOString();

        await insertRow('survey_results', {
            id,
            submitted_at,
            session_id: session_id || '',
            employee_id: employee_id || '',
            employee_name: employee_name || '',
            project_name: project_name || '',
            customer_name: customer_name || '',
            pdpa_consent_1: pdpa_consent_1 || '',
            score_q1,
            score_q2,
            score_q3,
            score_q4,
            improvements: improvements || '',
            improvements_other: improvements_other || '',
            contact_name: contact_name || '',
            contact_phone: contact_phone || '',
            contact_email: contact_email || '',
            pdpa_consent_2: pdpa_consent_2 || ''
        });
        res.json({ id, submitted_at, message: 'ขอบคุณสำหรับความเห็น' });
    } catch (err) {
        console.error('Sheets append failed:', err);
        res.status(500).json({ error: 'Failed to save survey' });
    }
});

module.exports = router;
