const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        let employees = [], jobs = [], completedProjects = [];

        if (process.env.DB_HOST) {
            const pool = require('../db/pg-client');
            const [empRes, jobRes, surveyRes] = await Promise.all([
                pool.query('SELECT emp_id, emp_name, department, sst_id FROM employees'),
                pool.query('SELECT emp_id, job_number, customer_name, year FROM employee_master_data'),
                pool.query('SELECT project_name FROM survey_results')
            ]);
            employees = empRes.rows;
            jobs = jobRes.rows;
            completedProjects = surveyRes.rows.map(r => r.project_name);
        } else {
            const { supabase } = require('../db/supabase-client');
            let empRes = await supabase.from('employees').select('emp_id, emp_name, department, sst_id');
            if (empRes.error && empRes.error.message && empRes.error.message.includes('sst_id')) {
                empRes = await supabase.from('employees').select('emp_id, emp_name, department');
            }
            if (empRes.error) throw empRes.error;
            employees = empRes.data || [];

            let allJobs = [], page = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('employee_master_data')
                    .select('emp_id, job_number, customer_name, year')
                    .range(page * 1000, (page + 1) * 1000 - 1);
                if (error || !data || data.length === 0) break;
                allJobs = allJobs.concat(data);
                if (data.length < 1000) break;
                page++;
            }
            jobs = allJobs;

            const { data: surveyData } = await supabase.from('survey_results').select('project_name');
            completedProjects = (surveyData || []).map(s => s.project_name);
        }

        const completedSet = new Set(completedProjects.filter(Boolean));
        const result = {};
        const codeToKey = {};

        for (const emp of employees) {
            const key = emp.sst_id || emp.emp_id;
            result[key] = { name: emp.emp_name, dept: emp.department || '', sst_id: emp.sst_id || null, jobs: [] };
            codeToKey[emp.emp_id] = key;
        }

        for (const row of jobs) {
            if (!row.job_number) continue;
            const key = codeToKey[row.emp_id];
            if (!key || !result[key]) continue;
            if (!result[key].jobs.some(j => j.jobNumber === row.job_number)) {
                result[key].jobs.push({
                    jobNumber: row.job_number,
                    customer: row.customer_name || '',
                    year: row.year || '',
                    isCompleted: completedSet.has(row.job_number)
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
