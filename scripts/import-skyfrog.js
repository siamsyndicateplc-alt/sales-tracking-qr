/**
 * scripts/import-skyfrog.js
 *
 * นำเข้าข้อมูลงานจาก Skyfrog CSV เข้า Supabase ตาราง employee_master_data
 *
 * วิธีใช้:
 *   node scripts/import-skyfrog.js "C:\path\to\JOBLISTDETAIL-xxx.csv"
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ใช้ service role key เพื่อ bypass RLS สำหรับ script นี้
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ====================================================
// MAPPING: ชื่อพนักงาน → { id, name, dept }
// เพิ่มพนักงานใหม่ได้ที่นี่
// ====================================================
const EMPLOYEES = [
    // EE-SV
    { name: 'วิชิต ไชยวัน',            id: 'SST00370', dept: 'EESV' },
    { name: 'อดิเรก อินหนอง',           id: 'SST00316', dept: 'EESV' },
    { name: 'วิวัฒน์ ชนะแก้ว',          id: 'SST00344', dept: 'EESV' },
    { name: 'สุรเดช จันทร์คำมา',        id: 'SST00361', dept: 'EESV' },
    { name: 'สุริยัณห์ อินราชา',        id: 'SST00374', dept: 'EESV' },
    { name: 'วัชระ อินทร์ฉ่ำ',          id: 'SST00520', dept: 'EESV' },
    { name: 'พีชวิทย์ พุฒทอง',          id: 'SST00538', dept: 'EESV' },
    { name: 'พีระพัฒน์ ไชยสงเคราะห์',  id: 'SST00575', dept: 'EESV' },
    { name: 'ปิยวัฒน์ ทีเจริญ',         id: 'SST00488', dept: 'EESV' },
    { name: 'ทวีศักดิ์ เกษแก้ว',        id: 'SST00893', dept: 'EESV' },
    // ES
    { name: 'ศักดิ์ชัย ศรีสุวรรณ',      id: 'SST00314', dept: 'ES' },
    { name: 'วรพันธุ์ มั่งคำ',           id: 'SST00429', dept: 'ES' },
    { name: 'มานะ นราภัย',              id: 'SST00697', dept: 'ES' },
    { name: 'จักรพันธ์ ก๋าใจ',           id: 'SST00467', dept: 'ES' },
    { name: 'สุรพล สุกันทา',            id: 'SST00571', dept: 'ES' },
    { name: 'ชัชวาลย์ รำมะนา',          id: 'SST00745', dept: 'ES' },
    { name: 'กิตติพงค์ มีแก้ว',          id: 'SST00762', dept: 'ES' },
    { name: 'ฆนากร ภูติวัฒนชัย',        id: 'SST00468', dept: 'ES' },
    { name: 'ปรีชา พลอาจ',             id: 'SST00527', dept: 'ES' },
    { name: 'ชัยวัฒน์ หัวหนองหาญ',      id: 'SST00569', dept: 'ES' },
    { name: 'คณาวุฒิ หมีกุระ',           id: 'SST00572', dept: 'ES' },
    { name: 'ชญานนท์ สีสืบมา',          id: 'SST00870', dept: 'ES' },
    { name: 'ภานุวัฒน์ ศรีเมือง',        id: 'SST00570', dept: 'ES' },
    { name: 'โกวิท วงศ์เขียว',           id: 'SST00662', dept: 'ES' },
    { name: 'จตุรพล แย้มกลิ่น',          id: 'SST00702', dept: 'ES' },
    { name: 'เขมวันต์ พรมภักดี',         id: 'SST00803', dept: 'ES' },
    { name: 'พงษ์รวี เทพวัลย์',          id: 'SST00796', dept: 'ES' },
    { name: 'สุวิทย์ วิวาสุข',            id: 'SST00798', dept: 'ES' },
    { name: 'วุฒิชัย นามศิลป์',           id: 'SST00799', dept: 'ES' },
    { name: 'กฤษณะ ปกป้องเกียรติ',      id: 'SST00470', dept: 'ES' },
    { name: 'อดิศักดิ์ เจริญผล',         id: 'SST00494', dept: 'ES' },
    { name: 'สราวุธ เจริญผล',           id: 'SST00495', dept: 'ES' },
    // EF-SV
    { name: 'ชนกานต์ ต่ายหลี',          id: 'SST00781', dept: 'EFSV' },
    { name: 'อดิรุจ จ้อยรุ่ง',            id: 'SST00899', dept: 'EFSV' },
    { name: 'กิรติ เจ๊ะซำและ',            id: 'SST00816', dept: 'EFSV' },
    { name: 'อดิศร จันทร์อุมา',           id: 'SST00780', dept: 'EFSV' },
    { name: 'ศรีนันท์ เย็นวอน',          id: 'SST00205', dept: 'EFSV' },
    { name: 'ศิรสิทธิ ปลื้มชัย',          id: 'SST00644', dept: 'EFSV' },
    { name: 'สามารถ พิมา',              id: 'SST00718', dept: 'EFSV' },
    { name: 'ธิราวุฒิ วะหาโล',           id: 'SST00775', dept: 'EFSV' },
    { name: 'พัศณะพล โพธิ์พันธ์',        id: 'SST00903', dept: 'EFSV' },
    { name: 'พรภิรมย์ บุญเหลือ',         id: 'SST00825', dept: 'EFSV' },
    { name: 'ศรุต วุฒิยา',               id: 'SST00827', dept: 'EFSV' },
    { name: 'เอกชัย ทองเจือ',            id: 'SST00901', dept: 'EFSV' },
    { name: 'เอกราช สายเครือวงศ์',       id: 'SST00733', dept: 'EFSV' },
    { name: 'จักรพันธุ์ ถาวรวงค์',        id: 'SST00605', dept: 'EFSV' },
    { name: 'ชาลี ปานนพภา',            id: 'SST00821', dept: 'EFSV' },
    { name: 'ณัชพล ขวัญเซ่ง',           id: 'SST00844', dept: 'EFSV' },
    { name: 'ตรัยวรัตม์ จำปาดง',         id: 'SST00811', dept: 'EFSV' },
    { name: 'ภคนันท์ ศุกระเศรณี',        id: 'SST00850', dept: 'EFSV' },
    { name: 'รุ่งโรจน์ พุดลา',            id: 'SST00886', dept: 'EFSV' },
    { name: 'สินทรัพย์ ไตรสถาพรชัย',    id: 'SST00770', dept: 'EFSV' },
    { name: 'อดิศักดิ์ สบายเหลือ',       id: 'SST00902', dept: 'EFSV' },
    { name: 'วศิน อัครวิทยาภูมิ',         id: 'SST00597', dept: 'EFSV' },
    { name: 'อภิรัตน์ อวนศรี',            id: 'SST00878', dept: 'EFSV' },
    { name: 'สร้อยมณี กวยเกิดผล',        id: 'SST00885', dept: 'EFSV' },
    { name: 'พงศธร ปัตตังเวสา',          id: 'SST00908', dept: 'EFSV' },
    { name: 'ณรงค์กร ผิวบัวคำ',          id: 'SST00911', dept: 'EFSV' },
    // EE-SV เพิ่มเติม (พบใน CSV แต่ไม่อยู่ใน Excel)
    { name: 'พีรพล สิงหกาญจน์',          id: 'SST00000', dept: 'EESV' }, // ⚠️ แก้รหัสให้ถูกต้อง
    { name: 'สมหวัง',                    id: 'SST00000', dept: 'EESV' }, // ⚠️ แก้รหัสให้ถูกต้อง
    // WT
    { name: 'สุทิวัส แสนหลวง',           id: 'SST00894', dept: 'WT' },
    { name: 'วิชยุตม์ พูลทอง',           id: 'SST00867', dept: 'WT' },
    { name: 'ศรเทพ พุ่มสุข',             id: 'SST00857', dept: 'WT' },
    { name: 'สุกฤษฎิ์ สิรินันทจิตร์',     id: 'SST00694', dept: 'WT' },
    { name: 'พงษ์ศักดิ์ ภูพวก',          id: 'SST00683', dept: 'WT' },
];

// สร้าง lookup index จากชื่อ (ชื่อจริง และชื่อย่อ)
const nameIndex = {};
for (const emp of EMPLOYEES) {
    // full name
    nameIndex[emp.name.trim()] = emp;
    // first name only (คำแรก)
    const firstName = emp.name.trim().split(' ')[0];
    if (!nameIndex[firstName]) nameIndex[firstName] = emp;
}

// ====================================================
// แยกชื่อออกจาก ShortName ของ Skyfrog
// เช่น "EE/SV - วิชิต" → "วิชิต"
//      "WT-สุกฤษฎิ์ สิรินันทจิตร์" → "สุกฤษฎิ์ สิรินันทจิตร์"
// ====================================================
function extractName(shortName) {
    if (!shortName || typeof shortName !== 'string') return null;
    // ลบ prefix เช่น "EE/SV - ", "WT-", "EF ", "EF/PM "
    const cleaned = shortName
        .replace(/^[A-Z0-9/]+[\s\-–]+/i, '') // "EE/SV - " หรือ "WT-"
        .replace(/^[A-Z]+\s+/i, '')           // "EF " หรือ "ES "
        .trim();
    return cleaned || null;
}

// ====================================================
// หา employee จาก ShortName
// ====================================================
function findEmployee(shortName) {
    const extracted = extractName(shortName);
    if (!extracted) return null;

    // 1. ตรงเป๊ะ
    if (nameIndex[extracted]) return nameIndex[extracted];

    // 2. ค้นหาด้วย partial match (ชื่อใน DB เริ่มต้นด้วยชื่อที่ extract ได้)
    for (const emp of EMPLOYEES) {
        if (emp.name.startsWith(extracted) || extracted.startsWith(emp.name.split(' ')[0])) {
            return emp;
        }
    }

    return null;
}

// ====================================================
// Parse CSV (ไม่ใช้ library ภายนอก)
// ====================================================
function parseCSV(content) {
    const lines = content.split('\n');
    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((h, idx) => {
            row[h.trim()] = (values[idx] || '').trim().replace(/^"|"$/g, '');
        });
        rows.push(row);
    }
    return rows;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// ====================================================
// Main
// ====================================================
async function main() {
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('❌ กรุณาระบุ path ของ CSV\nวิธีใช้: node scripts/import-skyfrog.js "C:\\path\\to\\file.csv"');
        process.exit(1);
    }

    if (!fs.existsSync(csvPath)) {
        console.error(`❌ ไม่พบไฟล์: ${csvPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(content);

    console.log(`📂 อ่าน CSV: ${path.basename(csvPath)} (${rows.length} rows)`);

    // filter เฉพาะ Completed + มีเลขที่ใบสั่งขาย
    const completed = rows.filter(r => {
        const status = (r['JobStatus'] || '').toLowerCase();
        return (status === 'completed' || status === 'complete') && r['เลขที่ใบสั่งขาย'];
    });

    console.log(`✅ งานที่ Completed: ${completed.length} rows`);

    // dedup โดย emp_id + job_number
    const seen = new Set();
    const toUpsert = [];
    const notFound = new Set();

    for (const row of completed) {
        const shortName = row['ShortName'];
        const emp = findEmployee(shortName);

        if (!emp) {
            notFound.add(shortName);
            continue;
        }

        const jobNumber = row['เลขที่ใบสั่งขาย'].trim();
        const key = `${emp.id}|${jobNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);

        toUpsert.push({
            emp_id: emp.id,
            emp_name: emp.name,
            job_number: jobNumber,
            customer_name: (row['CustomerName'] || '').trim(),
            department: emp.dept,
        });
    }

    if (notFound.size > 0) {
        console.warn(`\n⚠️  ไม่พบ mapping สำหรับ ShortName เหล่านี้ (ข้ามไป):`);
        [...notFound].forEach(n => console.warn(`   - "${n}"`));
    }

    console.log(`\n📝 จะ upsert ${toUpsert.length} records เข้า Supabase...`);

    if (toUpsert.length === 0) {
        console.log('ไม่มีข้อมูลที่จะ import');
        return;
    }

    // upsert เป็น batch
    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH) {
        const batch = toUpsert.slice(i, i + BATCH);
        const { error } = await supabase
            .from('employee_master_data')
            .upsert(batch, { onConflict: 'emp_id,job_number' });

        if (error) {
            console.error(`❌ Error batch ${i / BATCH + 1}:`, error.message);
        } else {
            inserted += batch.length;
            console.log(`   batch ${i / BATCH + 1}: ${batch.length} records ✓`);
        }
    }

    console.log(`\n🎉 เสร็จสิ้น! import สำเร็จ ${inserted}/${toUpsert.length} records`);
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});
