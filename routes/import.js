const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') cb(null, true);
        else cb(new Error('รองรับเฉพาะไฟล์ Excel (.xlsx, .xls)'));
    }
});

function readExcelBuffer(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function extractJobs(rows, empMap) {
    const result = [];
    const skipped = [];
    for (const r of rows) {
        const jobNo = String(r['No.'] || r['Job No'] || r['Job Number'] || '').trim();
        const customer = String(r['Bill-to Name'] || r['Sell-to Customer Name'] || r['Customer'] || '').trim();
        const sp = String(r['Salesperson Code'] || r['Sales Person'] || r['SalesPersonCode'] || '').trim();
        let year = String(r['Year'] || r['year'] || '').trim().replace(/\.0$/, '');
        if (!jobNo || !customer) continue;
        if (empMap[sp]) {
            const { emp_id, emp_name } = empMap[sp];
            result.push({ emp_id, emp_name, job_number: jobNo, customer_name: customer, year });
        } else {
            skipped.push({ job_number: jobNo, salesperson_code: sp });
        }
    }
    return { result, skipped };
}

// GET /api/import/emp-map — return current salesperson_code→emp mapping
router.get('/emp-map', async (req, res) => {
    try {
        const pool = require('../db/pg-client');
        const { rows } = await pool.query(
            'SELECT emp_id, emp_name, salesperson_code FROM employees WHERE salesperson_code IS NOT NULL AND salesperson_code <> \'\' ORDER BY emp_name'
        );
        res.json(rows);
    } catch (err) {
        console.error('emp-map error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import/preview — upload files, return preview without saving
router.post('/preview', upload.fields([
    { name: 'jobs_file', maxCount: 1 },
    { name: 'sales_file', maxCount: 1 }
]), async (req, res) => {
    try {
        const pool = require('../db/pg-client');
        const { rows: empRows } = await pool.query(
            'SELECT emp_id, emp_name, salesperson_code FROM employees WHERE salesperson_code IS NOT NULL AND salesperson_code <> \'\''
        );
        const empMap = {};
        for (const e of empRows) empMap[e.salesperson_code] = { emp_id: e.emp_id, emp_name: e.emp_name };

        let allRows = [];
        let allSkipped = [];

        if (req.files['jobs_file']) {
            const { result, skipped } = extractJobs(readExcelBuffer(req.files['jobs_file'][0].buffer), empMap);
            allRows = allRows.concat(result);
            allSkipped = allSkipped.concat(skipped);
        }
        if (req.files['sales_file']) {
            const { result, skipped } = extractJobs(readExcelBuffer(req.files['sales_file'][0].buffer), empMap);
            allRows = allRows.concat(result);
            allSkipped = allSkipped.concat(skipped);
        }

        // Deduplicate by job_number
        const seen = new Set();
        const unique = [];
        for (const r of allRows) {
            if (!seen.has(r.job_number)) { seen.add(r.job_number); unique.push(r); }
        }

        // Check which already exist in DB
        if (unique.length > 0) {
            const jobNos = unique.map(r => r.job_number);
            const { rows: existing } = await pool.query(
                `SELECT job_number FROM employee_master_data WHERE job_number = ANY($1)`,
                [jobNos]
            );
            const existingSet = new Set(existing.map(r => r.job_number));
            for (const r of unique) r.exists = existingSet.has(r.job_number);
        }

        res.json({
            total: unique.length,
            new_count: unique.filter(r => !r.exists).length,
            duplicate_count: unique.filter(r => r.exists).length,
            skipped_count: allSkipped.length,
            rows: unique.slice(0, 50),
            skipped: allSkipped.slice(0, 20)
        });
    } catch (err) {
        console.error('Preview error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import/confirm — upload and actually insert
router.post('/confirm', upload.fields([
    { name: 'jobs_file', maxCount: 1 },
    { name: 'sales_file', maxCount: 1 }
]), async (req, res) => {
    try {
        const pool = require('../db/pg-client');
        const { rows: empRows } = await pool.query(
            'SELECT emp_id, emp_name, salesperson_code FROM employees WHERE salesperson_code IS NOT NULL AND salesperson_code <> \'\''
        );
        const empMap = {};
        for (const e of empRows) empMap[e.salesperson_code] = { emp_id: e.emp_id, emp_name: e.emp_name };

        let allRows = [];
        if (req.files['jobs_file']) {
            const { result } = extractJobs(readExcelBuffer(req.files['jobs_file'][0].buffer), empMap);
            allRows = allRows.concat(result);
        }
        if (req.files['sales_file']) {
            const { result } = extractJobs(readExcelBuffer(req.files['sales_file'][0].buffer), empMap);
            allRows = allRows.concat(result);
        }

        const seen = new Set();
        const unique = [];
        for (const r of allRows) {
            if (!seen.has(r.job_number)) { seen.add(r.job_number); unique.push(r); }
        }

        if (unique.length === 0) return res.json({ inserted: 0, skipped: 0 });

        let inserted = 0;
        let skipped = 0;
        for (const r of unique) {
            const result = await pool.query(
                `INSERT INTO employee_master_data (emp_id, job_number, customer_name, year)
                 VALUES ($1,$2,$3,$4) ON CONFLICT (job_number) DO NOTHING`,
                [r.emp_id, r.job_number, r.customer_name, r.year]
            );
            if (result.rowCount > 0) inserted++;
            else skipped++;
        }

        res.json({ inserted, skipped, total: unique.length });
    } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/import/employees — list all employees
router.get('/employees', async (req, res) => {
    try {
        const pool = require('../db/pg-client');
        const { rows } = await pool.query(
            'SELECT emp_id, emp_name, department, sst_id, salesperson_code FROM employees ORDER BY emp_name'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import/employees — add new employee
router.post('/employees', async (req, res) => {
    const { emp_id, emp_name, department, sst_id, salesperson_code } = req.body;
    if (!emp_id || !emp_name) return res.status(400).json({ error: 'emp_id และ emp_name จำเป็นต้องกรอก' });
    try {
        const pool = require('../db/pg-client');
        await pool.query(
            `INSERT INTO employees (emp_id, emp_name, department, sst_id, salesperson_code)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (emp_id) DO UPDATE SET emp_name=$2, department=$3, sst_id=$4, salesperson_code=$5`,
            [emp_id.trim(), emp_name.trim(), department?.trim() || '', sst_id?.trim() || null, salesperson_code?.trim() || null]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Add employee error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/import/employees/:emp_id
router.delete('/employees/:emp_id', async (req, res) => {
    try {
        const pool = require('../db/pg-client');
        await pool.query('DELETE FROM employees WHERE emp_id = $1', [req.params.emp_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
