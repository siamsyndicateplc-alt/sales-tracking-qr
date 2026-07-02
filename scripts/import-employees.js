// scripts/import-employees.js
// รัน: node scripts/import-employees.js "path/to/file.xlsx"
require('dotenv').config();
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node scripts/import-employees.js "<path/to/file.xlsx>"');
        process.exit(1);
    }

    const wb = XLSX.readFile(filePath);
    let totalSuccess = 0, totalSkipped = 0, totalErrors = 0;

    for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        console.log(`\n--- แผนก: ${sheetName} (${rows.length} คน) ---`);

        for (const row of rows) {
            const emp_id = String(row['id'] || '').trim();
            const emp_name = String(row['name'] || '').trim();

            if (!emp_id || !emp_name) {
                console.warn(`  ข้าม: ข้อมูลไม่ครบ →`, row);
                totalSkipped++;
                continue;
            }

            const { data: existing } = await supabase
                .from('employees')
                .select('emp_id')
                .eq('emp_id', emp_id)
                .limit(1);

            if (existing && existing.length > 0) {
                console.log(`  ข้าม: ${emp_id} — มีอยู่แล้ว`);
                totalSkipped++;
                continue;
            }

            const { error } = await supabase
                .from('employees')
                .insert({ emp_id, emp_name, department: sheetName });

            if (error) {
                console.error(`  ERROR: ${emp_id} (${emp_name}) —`, error.message);
                totalErrors++;
            } else {
                console.log(`  เพิ่มสำเร็จ: ${emp_id} — ${emp_name}`);
                totalSuccess++;
            }
        }
    }

    console.log(`\n=============================`);
    console.log(`สรุปทั้งหมด: เพิ่ม ${totalSuccess} | ข้าม ${totalSkipped} | Error ${totalErrors}`);
}

main().catch(err => {
    console.error('Script failed:', err.message);
    process.exit(1);
});
