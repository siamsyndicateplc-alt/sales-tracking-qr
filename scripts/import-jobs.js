// scripts/import-jobs.js
// รัน: node scripts/import-jobs.js "path/to/JOBLISTDETAIL.csv"
// - ลบข้อมูลเก่าใน employee_master_data ทั้งหมด
// - import jobs ใหม่จาก Skyfrog CSV
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

function parseCSV(filePath) {
    const lines = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '').split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Simple CSV split (handles quoted fields)
        const values = [];
        let cur = '', inQ = false;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '"') { inQ = !inQ; }
            else if (line[c] === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
            else { cur += line[c]; }
        }
        values.push(cur.trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        rows.push(row);
    }
    return rows;
}

function parseShortName(shortName) {
    if (!shortName) return { dept: '', emp_name: '' };
    const s = shortName.trim();
    // Pattern: "EF/PM  ชื่อ นามสกุล" or "EE/PM - ชื่อ" or "EF ชื่อ"
    const m = s.match(/^([A-Z]+(?:\/[A-Z]+)?(?:\/PM)?)\s*[-\s]+\s*(.+)$/) ||
              s.match(/^([A-Z]+(?:\/[A-Z]+)?)\s+(.+)$/);
    if (m) return { dept: m[1].trim(), emp_name: m[2].trim() };
    return { dept: '', emp_name: s };
}

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node scripts/import-jobs.js "<path/to/file.csv>"');
        process.exit(1);
    }

    // 1. Load employees from Supabase for name matching
    console.log('โหลดข้อมูลพนักงานจาก Supabase...');
    const { data: employees, error: empErr } = await supabase
        .from('employees')
        .select('emp_id, emp_name');
    if (empErr) { console.error('ดึงข้อมูลพนักงานไม่ได้:', empErr.message); process.exit(1); }

    // Build name → emp_id map (exact and first-name fallback)
    const nameMap = {};
    const firstNameMap = {}; // first name → [emp_id, ...] (for partial match)
    for (const e of employees) {
        const key = e.emp_name.replace(/\s+/g, ' ').trim();
        nameMap[key] = e.emp_id;
        const firstName = key.split(' ')[0];
        if (!firstNameMap[firstName]) firstNameMap[firstName] = [];
        firstNameMap[firstName].push({ emp_id: e.emp_id, emp_name: e.emp_name });
    }
    console.log(`พบพนักงาน ${employees.length} คนในระบบ`);

    // 2. Read CSV
    const rows = parseCSV(filePath);
    console.log(`อ่าน CSV ได้ ${rows.length} แถว`);

    // Deduplicate by JobNo + ShortName
    const seen = new Set();
    const jobs = [];
    for (const row of rows) {
        const jobNo = (row['JobNo'] || '').trim();
        const shortName = (row['ShortName'] || '').trim();
        const customer = (row['CustomerName'] || '').trim();
        if (!jobNo || !shortName) continue;
        const key = `${jobNo}|${shortName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push({ jobNo, shortName, customer });
    }
    console.log(`Jobs unique: ${jobs.length}`);

    // 3. Clear existing employee_master_data
    console.log('\nลบข้อมูลเก่าใน employee_master_data...');
    const { error: delErr } = await supabase
        .from('employee_master_data')
        .delete()
        .neq('emp_id', 'KEEP_NOTHING'); // delete all rows
    if (delErr) { console.error('ลบข้อมูลเก่าไม่ได้:', delErr.message); process.exit(1); }
    console.log('ลบเรียบร้อย');

    // 4. Insert new jobs
    console.log('\nImport jobs...');
    let success = 0, noMatch = 0, errors = 0;
    const unmatched = [];

    for (const { jobNo, shortName, customer } of jobs) {
        const { emp_name } = parseShortName(shortName);
        const normalizedName = emp_name.replace(/\s+/g, ' ').trim();
        let emp_id = nameMap[normalizedName] || null;

        if (!emp_id) {
            // Partial match by first name
            const firstName = normalizedName.split(' ')[0];
            const candidates = firstNameMap[firstName] || [];
            if (candidates.length === 1) {
                emp_id = candidates[0].emp_id;
            } else if (candidates.length > 1) {
                unmatched.push({ jobNo, emp_name, reason: `ชื่อซ้ำ: ${candidates.map(c => c.emp_name).join(', ')}` });
                noMatch++;
            } else {
                unmatched.push({ jobNo, emp_name, reason: 'ไม่พบในระบบ' });
                noMatch++;
            }
        }

        const { error } = await supabase
            .from('employee_master_data')
            .insert({
                emp_id: emp_id || '',
                emp_name,
                job_number: jobNo,
                customer_name: customer,
            });

        if (error) {
            console.error(`  ERROR: ${jobNo} —`, error.message);
            errors++;
        } else {
            success++;
        }
    }

    console.log(`\n=============================`);
    console.log(`สรุป: เพิ่ม ${success} | จับคู่ emp_id ไม่ได้ ${noMatch} | Error ${errors}`);

    if (unmatched.length > 0) {
        console.log(`\n⚠️  match ไม่ได้ (${unmatched.length} รายการ):`);
        const seen = new Set();
        unmatched.forEach(u => {
            const key = u.emp_name;
            if (!seen.has(key)) {
                seen.add(key);
                console.log(`  - ${u.emp_name} → ${u.reason}`);
            }
        });
    }
}

main().catch(err => {
    console.error('Script failed:', err.message);
    process.exit(1);
});
