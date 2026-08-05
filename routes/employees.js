const express = require('express');
const router = express.Router();
const pool = require('../db/pg-client');

router.get('/', async (req, res) => {
    try {
        const [empRes, jobRes, surveyRes] = await Promise.all([
            pool.query('SELECT emp_id, emp_name, department, sst_id FROM employees'),
            pool.query('SELECT emp_id, job_number, customer_name, year FROM employee_master_data'),
            pool.query('SELECT project_name FROM survey_results')
        ]);

        const completedJobs = new Set();
        surveyRes.rows.forEach(s => { if (s.project_name) completedJobs.add(s.project_name); });

        const result = {};
        const codeToKey = {};
        for (const emp of empRes.rows) {
            const key = emp.sst_id || emp.emp_id;
            result[key] = {
                name: emp.emp_name,
                dept: emp.department || '',
                sst_id: emp.sst_id || null,
                jobs: []
            };
            codeToKey[emp.emp_id] = key;
        }

        for (const row of jobRes.rows) {
            if (!row.job_number) continue;
            const key = codeToKey[row.emp_id];
            if (!key || !result[key]) continue;
            const exists = result[key].jobs.some(j => j.jobNumber === row.job_number);
            if (!exists) {
                result[key].jobs.push({
                    jobNumber: row.job_number,
                    customer: row.customer_name || '',
                    year: row.year || '',
                    isCompleted: completedJobs.has(row.job_number)
                });
            }
        }

        res.json(result);
    } catch (err) {
        console.error('Failed to fetch employee data:', err);
        res.status(500).json({});
    }
});

module.exports = router;
