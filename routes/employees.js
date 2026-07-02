const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase-client');

router.get('/', async (req, res) => {
    try {
        let empRes = await supabase.from('employees').select('emp_id, emp_name, department, sst_id');
        if (empRes.error && empRes.error.message && empRes.error.message.includes('sst_id')) {
            empRes = await supabase.from('employees').select('emp_id, emp_name, department');
        }
        // Fetch all jobs with pagination (Supabase default limit is 1000)
        let allJobRows = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('employee_master_data')
                .select('emp_id, job_number, customer_name, year')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error || !data || data.length === 0) break;
            allJobRows = allJobRows.concat(data);
            if (data.length < pageSize) break;
            page++;
        }
        const jobRes = { data: allJobRows, error: null };

        const [surveyRes] = await Promise.all([
            supabase.from('survey_results').select('project_name')
        ]);

        if (empRes.error) throw empRes.error;
        if (jobRes.error) console.warn('Could not fetch employee_master_data:', jobRes.error);
        if (surveyRes.error) console.warn('Could not fetch survey_results:', surveyRes.error);

        const completedJobs = new Set();
        if (surveyRes.data) {
            surveyRes.data.forEach(s => { if (s.project_name) completedJobs.add(s.project_name); });
        }

        // Build result keyed by sst_id (when available) or emp_id
        const result = {};
        const codeToKey = {}; // Sales Person code → result key
        for (const emp of (empRes.data || [])) {
            const key = emp.sst_id || emp.emp_id;
            result[key] = {
                name: emp.emp_name,
                dept: emp.department || '',
                sst_id: emp.sst_id || null,
                jobs: []
            };
            codeToKey[emp.emp_id] = key;
        }

        // Attach jobs from employee_master_data (linked via Sales Person code)
        for (const row of (jobRes.data || [])) {
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
