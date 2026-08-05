const express = require('express');
const router = express.Router();
const pool = require('../db/pg-client');
const basicAuth = require('express-basic-auth');

router.use(basicAuth({
    users: { [process.env.DASHBOARD_USER || 'admin']: process.env.DASHBOARD_PASS || 'sstadmin2026' },
    challenge: true,
    realm: 'SST Dashboard'
}));

router.get('/summary', async (req, res) => {
    try {
        const [qrRes, surveyRes, eventRes] = await Promise.all([
            pool.query('SELECT * FROM qr_logs ORDER BY created_at DESC'),
            pool.query('SELECT * FROM survey_results ORDER BY submitted_at DESC'),
            pool.query('SELECT * FROM events ORDER BY timestamp DESC')
        ]);

        const qrLogs  = qrRes.rows;
        const surveys = surveyRes.rows;
        const events  = eventRes.rows;

        const qrCreated = qrLogs.length;
        const surveyCompleted = surveys.length;
        const responseRate = qrCreated > 0
            ? Math.round((surveyCompleted / qrCreated) * 1000) / 10
            : 0;

        const allScores = surveys.flatMap(s =>
            ['q1','q2','q3','q4']
                .map(q => parseFloat(s[`score_${q}`]))
                .filter(n => !isNaN(n) && n > 0)
        );
        const avgScore = allScores.length > 0
            ? Math.round((allScores.reduce((a,b) => a+b, 0) / allScores.length) * 10) / 10
            : 0;

        const overallDistribution = {5:0, 4:0, 3:0, 2:0, 1:0};
        allScores.forEach(s => {
            const rounded = Math.round(s);
            if (overallDistribution[rounded] !== undefined) overallDistribution[rounded]++;
        });

        const employeeMap = {};
        surveys.forEach(s => {
            const key = s.employee_id;
            if (!employeeMap[key]) {
                employeeMap[key] = { employee_id: s.employee_id, employee_name: s.employee_name, scores: [], count: 0 };
            }
            employeeMap[key].count++;
            ['q1','q2','q3','q4'].forEach(q => {
                const v = parseFloat(s[`score_${q}`]);
                if (!isNaN(v) && v > 0) employeeMap[key].scores.push(v);
            });
        });

        const byEmployee = Object.values(employeeMap).map(e => ({
            employee_id: e.employee_id,
            employee_name: e.employee_name,
            count: e.count,
            avg_score: e.scores.length > 0
                ? Math.round((e.scores.reduce((a,b) => a+b, 0) / e.scores.length) * 10) / 10
                : 0
        }));

        const surveyKeys = new Set(surveys.map(s => `${s.employee_id}|${s.project_name}|${s.customer_name}`));
        const scannedKeys = new Set(
            events.filter(e => e.event_type === 'scanned')
                  .map(e => `${e.employee_id}|${e.project_name}|${e.customer_name}`)
        );

        const pendingCustomers = qrLogs
            .filter(q => !surveyKeys.has(`${q.employee_id}|${q.project_name}|${q.customer_name}`))
            .map(q => {
                const key = `${q.employee_id}|${q.project_name}|${q.customer_name}`;
                return {
                    scan_time: q.created_at,
                    customer_name: q.customer_name,
                    project_name: q.project_name,
                    employee_name: q.employee_name,
                    status: scannedKeys.has(key) ? 'สแกนแล้วยังไม่ตอบ' : 'ยังไม่ได้สแกน'
                };
            })
            .sort((a, b) => new Date(b.scan_time) - new Date(a.scan_time))
            .slice(0, 20);

        const avgPerQuestion = {};
        ['q1','q2','q3','q4'].forEach(q => {
            const scores = surveys.map(s => parseFloat(s[`score_${q}`])).filter(n => !isNaN(n) && n > 0);
            const distribution = {5:0, 4:0, 3:0, 2:0, 1:0};
            scores.forEach(s => { const r = Math.round(s); if (distribution[r] !== undefined) distribution[r]++; });
            avgPerQuestion[q] = {
                avg: scores.length > 0 ? Math.round((scores.reduce((a,b) => a+b, 0) / scores.length) * 10) / 10 : 0,
                distribution,
                total: scores.length
            };
        });

        const improvementOptions = ['ไม่มีสิ่งที่ควรปรับปรุง','การให้บริการหลังการขาย','ราคาสินค้า','ความรวดเร็วในการประสานงานขาย','คุณภาพสินค้า','การประชาสัมพันธ์','อื่น ๆ'];
        const counts = {};
        improvementOptions.forEach(opt => counts[opt] = 0);
        surveys.forEach(s => {
            const values = (s.improvements || '').split('|').filter(Boolean);
            values.forEach(v => {
                const matched = improvementOptions.find(opt => opt === v || opt.includes(v.slice(0,5)) || v.includes(opt.slice(0,5)));
                if (matched) counts[matched]++;
            });
        });
        const total = Object.values(counts).reduce((a,b) => a+b, 0);
        const improvementBreakdown = improvementOptions.map(opt => ({
            label: opt, count: counts[opt],
            percent: total > 0 ? Math.round((counts[opt] / total) * 1000) / 10 : 0
        }));

        const recentFeedback = surveys
            .filter(s => s.improvements_other && s.improvements_other.trim())
            .slice(0, 10)
            .map(s => ({
                submitted_at: s.submitted_at,
                customer_name: s.customer_name || 'ลูกค้า',
                project_name: s.project_name,
                text: s.improvements_other
            }));

        res.json({
            totals: { qr_created: qrCreated, survey_completed: surveyCompleted, response_rate: responseRate, avg_score: avgScore, overall_distribution: overallDistribution, overall_total_scores: allScores.length },
            by_employee: byEmployee,
            pending_customers: pendingCustomers,
            avg_per_question: avgPerQuestion,
            improvement_breakdown: improvementBreakdown,
            recent_feedback: recentFeedback
        });
    } catch (err) {
        console.error('Dashboard summary error:', err);
        res.status(500).json({ error: 'Failed to load summary' });
    }
});

function toThaiTimeString(isoString) {
    if (!isoString) return '';
    try { return new Date(isoString).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }); }
    catch { return isoString; }
}

router.get('/export-csv', async (req, res) => {
    try {
        const { rows: surveys } = await pool.query('SELECT * FROM survey_results ORDER BY submitted_at DESC');
        const headers = ['submitted_at','employee_id','employee_name','project_name','customer_name','score_q1','score_q2','score_q3','score_q4','avg_score','improvements','improvements_other','contact_name','contact_phone','contact_email'];
        let csv = headers.join(',') + '\n';
        surveys.forEach(s => {
            const scores = ['q1','q2','q3','q4'].map(q => parseFloat(s[`score_${q}`]) || 0);
            const avg = scores.reduce((a,b) => a+b, 0) / 4;
            csv += [
                toThaiTimeString(s.submitted_at), s.employee_id, s.employee_name,
                s.project_name, s.customer_name,
                s.score_q1, s.score_q2, s.score_q3, s.score_q4, avg.toFixed(2),
                `"${(s.improvements||'').replace(/"/g,'""')}"`,
                `"${(s.improvements_other||'').replace(/"/g,'""')}"`,
                s.contact_name||'', s.contact_phone||'', s.contact_email||''
            ].join(',') + '\n';
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=survey_${Date.now()}.csv`);
        res.send('﻿' + csv);
    } catch (err) {
        console.error('Export CSV error:', err);
        res.status(500).send('Export failed');
    }
});

module.exports = router;
