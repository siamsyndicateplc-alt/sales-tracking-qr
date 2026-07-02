// scripts/import-sales-data.js
// รัน: node scripts/import-sales-data.js "<Jobs_Export.xlsx>" "<ราชชื่อช่างไซต์งาน.xlsx>"
require('dotenv').config();
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

async function main() {
    const jobsFile = process.argv[2];
    const empFile  = process.argv[3];
    if (!jobsFile || !empFile) {
        console.error('Usage: node scripts/import-sales-data.js "<Jobs_Export.xlsx>" "<ราชชื่อช่างไซต์งาน.xlsx>"');
        process.exit(1);
    }

    // --- Build name + sst_id map from ราชชื่อช่างไซต์งาน.xlsx ---
    const nameMap = {};   // code → name
    const sstIdMap = {};  // code → SST ID
    const empWb = XLSX.readFile(empFile);
    for (const sheetName of empWb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(empWb.Sheets[sheetName], { defval: '' });
        for (const row of rows) {
            const code = String(row['Sales Person'] || '').trim();
            const name = String(row['name'] || '').trim();
            const sst  = String(row['id'] || '').trim();
            if (code && name) nameMap[code] = name;
            if (code && sst)  sstIdMap[code] = sst;
        }
    }
    console.log(`อ่านชื่อพนักงานได้ ${Object.keys(nameMap).length} คน`);

    // --- Read Jobs_Export.xlsx (all sheets) ---
    const wb = XLSX.readFile(jobsFile);
    let rows = [];
    for (const sheetName of wb.SheetNames) {
        const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        rows = rows.concat(sheetRows);
    }
    console.log(`อ่าน Jobs ได้ ${rows.length} แถว (${wb.SheetNames.length} sheets: ${wb.SheetNames.join(', ')})`);

    // --- 0. Clear existing data ---
    console.log('\n[0/2] ลบข้อมูลเก่า...');
    const { error: delJobsErr } = await supabase.from('employee_master_data').delete().neq('emp_id', '');
    if (delJobsErr) console.error('  ERROR ลบ employee_master_data:', delJobsErr.message);
    else console.log('  ✓ ลบ employee_master_data เรียบร้อย');

    const { error: delEmpErr } = await supabase.from('employees').delete().neq('emp_id', '');
    if (delEmpErr) console.error('  ERROR ลบ employees:', delEmpErr.message);
    else console.log('  ✓ ลบ employees เรียบร้อย');

    // --- 1. Import Employees (from name file as source of truth) ---
    console.log('\n[1/2] Import พนักงาน...');

    // Build dept map from ราชชื่อช่างไซต์งาน.xlsx (sheet name = dept)
    const deptMap = {};
    for (const sheetName of empWb.SheetNames) {
        const rows2 = XLSX.utils.sheet_to_json(empWb.Sheets[sheetName], { defval: '' });
        for (const row of rows2) {
            const code = String(row['Sales Person'] || '').trim();
            if (code) deptMap[code] = sheetName;
        }
    }

    // All 10 employees from name file
    const empList = Object.keys(nameMap).map(emp_id => ({
        emp_id,
        emp_name: nameMap[emp_id],
        department: deptMap[emp_id] || '',
        sst_id: sstIdMap[emp_id] || null
    }));

    const noName = empList.filter(e => e.emp_name === e.emp_id).map(e => e.emp_id);
    console.log(`  พบ Sales Person unique: ${empList.length} คน`);
    if (noName.length) console.log(`  ไม่มีชื่อจริง (ใช้ code แทน): ${noName.join(', ')}`);

    let empSuccess = 0, empErr = 0;
    for (const emp of empList) {
        const { error } = await supabase.from('employees').insert(emp);
        if (error) { console.error(`  ERROR: ${emp.emp_id} —`, error.message); empErr++; }
        else empSuccess++;
    }
    console.log(`  ✓ เพิ่มพนักงาน ${empSuccess} | Error ${empErr}`);

    // --- 2. Import Jobs (INV100 only, deduplicated by job_number) ---
    console.log('\n[2/2] Import งาน (INV100 เท่านั้น)...');
    const inv100Raw = rows.filter(r => String(r['Status NAV'] || '').trim() === 'INV100');
    // Deduplicate by job_number (keep first occurrence)
    const seenJobs = new Set();
    const inv100 = inv100Raw.filter(r => {
        const jn = String(r['No.'] || '').trim();
        if (!jn || seenJobs.has(jn)) return false;
        seenJobs.add(jn);
        return true;
    });
    console.log(`  งาน INV100: ${inv100Raw.length} รายการ → หลัง dedup: ${inv100.length} รายการ`);

    let jobSuccess = 0, jobSkip = 0, jobErr = 0;
    for (const row of inv100) {
        const emp_id        = String(row['Sales Person'] || '').trim();
        const job_number    = String(row['No.'] || '').trim();
        const customer_name = String(row['Bill-to Name'] || '').trim();
        const year          = String(row['Year'] || '').trim();

        if (!emp_id || !job_number) { jobSkip++; continue; }

        const { error } = await supabase.from('employee_master_data').insert({
            emp_id,
            emp_name: nameMap[emp_id] || emp_id,
            job_number,
            customer_name,
            year
        });

        if (error) { console.error(`  ERROR: ${job_number} —`, error.message); jobErr++; }
        else jobSuccess++;
    }

    console.log(`  ✓ เพิ่มงาน ${jobSuccess} | ข้าม ${jobSkip} | Error ${jobErr}`);
    console.log('\n=== Import เสร็จสิ้น ===');
}

main().catch(err => {
    console.error('Script failed:', err.message);
    process.exit(1);
});
