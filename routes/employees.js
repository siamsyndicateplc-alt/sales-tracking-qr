const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase-client');

router.get('/', async (req, res) => {
    try {
        // Fetch all flat data
        const { data, error } = await supabase
            .from('employee_master_data')
            .select('emp_id, emp_name, job_number, customer_name, department');

        if (error) throw error;

        // Fetch completed jobs to grey them out
        const { data: surveyData, error: surveyError } = await supabase
            .from('survey_results')
            .select('project_name');
        
        if (surveyError) console.warn('Could not fetch survey_results for completed check:', surveyError);
        
        const completedJobs = new Set();
        if (surveyData) {
            surveyData.forEach(s => {
                if (s.project_name) completedJobs.add(s.project_name);
            });
        }

        // Transform flat data to { "SST00888": { "name": "...", "jobs": [ { "jobNumber": "...", "customer": "..." } ] } }
        const result = {};

        for (const row of data) {
            if (!result[row.emp_id]) {
                result[row.emp_id] = {
                    name: row.emp_name,
                    dept: row.department || '',
                    jobs: []
                };
            }
            
            // Add job if job_number is present
            if (row.job_number) {
                // Ensure no duplicates in the array
                const exists = result[row.emp_id].jobs.some(j => j.jobNumber === row.job_number);
                if (!exists) {
                    result[row.emp_id].jobs.push({
                        jobNumber: row.job_number,
                        customer: row.customer_name || '',
                        isCompleted: completedJobs.has(row.job_number)
                    });
                }
            }
        }

        res.json(result);
    } catch (err) {
        console.error('Failed to fetch employee master data from Supabase:', err);
        res.status(500).json({});
    }
});

module.exports = router;
