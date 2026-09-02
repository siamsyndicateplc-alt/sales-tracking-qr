-- pg_setup.sql: Create schema and seed data for sst_db on PostgreSQL 18

-- 1. employees table
CREATE TABLE IF NOT EXISTS public.employees (
    emp_id TEXT PRIMARY KEY,
    emp_name TEXT NOT NULL,
    department TEXT DEFAULT '',
    sst_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. employee_master_data table
CREATE TABLE IF NOT EXISTS public.employee_master_data (
    emp_id TEXT NOT NULL,
    job_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    year TEXT DEFAULT '',
    sales_person TEXT DEFAULT '',
    project_description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (emp_id, job_number)
);

-- 3. survey_results table
CREATE TABLE IF NOT EXISTS public.survey_results (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id TEXT,
    employee_id TEXT,
    employee_name TEXT,
    project_name TEXT,
    customer_name TEXT,
    pdpa_consent_1 TEXT,
    score_q1 INTEGER,
    score_q2 INTEGER,
    score_q3 INTEGER,
    score_q4 INTEGER,
    improvements TEXT,
    improvements_other TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    pdpa_consent_2 TEXT
);

-- 4. events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id TEXT,
    event_type TEXT,
    employee_id TEXT,
    employee_name TEXT,
    customer_name TEXT,
    project_name TEXT,
    metadata JSONB
);

-- 5. qr_logs table
CREATE TABLE IF NOT EXISTS public.qr_logs (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    employee_id TEXT,
    employee_name TEXT,
    project_name TEXT,
    customer_name TEXT,
    generated_url TEXT,
    user_agent TEXT
);

-- 6. Grant permissions to sst_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sst_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sst_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sst_user;

-- 7. Seed employees
INSERT INTO public.employees (emp_id, emp_name, sst_id) VALUES
('E00001', 'สรวิศ รัตนพิพัฒน์', 'SST00001'),
('E00008', 'ชานนท์ ชัยวัฒน์', 'SST00008'),
('E00012', 'วรวุฒิ นพรัตน์', 'SST00012'),
('E00015', 'กิตติพงษ์ แสนสุข', 'SST00015'),
('E00023', 'ธนพล ศรีวิชัย', 'SST00023'),
('E00045', 'ณัฐวุฒิ เกียรติขจร', 'SST00045'),
('E00057', 'สมยศ เลิศรัตนชัย', 'SST00057'),
('E00062', 'พีรพงษ์ จรัสแสง', 'SST00062'),
('E00078', 'อัครพล วงศ์สว่าง', 'SST00078'),
('E00099', 'วีรพงษ์ อุดมผล', 'SST00099'),
('E00101', 'สุรเดช กิตติพร', 'SST00101'),
('E00259', 'นิธิวัฒน์ หวังวัฒนากูล', 'SST00259'),
('E00710', 'พสธร เรืองพระยา', 'SST00710'),
('E00721', 'ภาสวิชญ์ คัชมาตย์', 'SST00721'),
('E00730', 'พิมทอง บริบูรณ์', 'SST00730'),
('E00888', 'กิตติทัศน์ ส่วนสมพงษ์', 'SST00888')
ON CONFLICT (emp_id) DO UPDATE SET emp_name = EXCLUDED.emp_name, sst_id = EXCLUDED.sst_id;

-- 8. Seed employee_master_data
INSERT INTO public.employee_master_data (emp_id, job_number, customer_name) VALUES
('E00001','JOB-WTBR-2024-0012','โรงแรมแกรนด์ ไฮแอท เอราวัณ'),
('E00001','JOB-WTDO-2025-0045','การประปาส่วนภูมิภาค สาขาพัทยา'),
('E00001','JOB-MMEC-2025-0189','โรงพยาบาลบำรุงราษฎร์'),
('E00001','JOB-MMVA-2026-0005','บจก. ไทยน้ำทิพย์ ปทุมธานี'),
('E00001','JOB-WTFL-2026-0034','โรงงานเบียร์สิงห์ ปทุมธานี'),
('E00008','JOB-WTBR-2025-0104','บจก. พีทีที เคมิคอล'),
('E00008','JOB-WTDO-2026-0032','การประปานครหลวง'),
('E00008','JOB-WTEV-2025-0089','บจก. เอสซีจี เปเปอร์'),
('E00008','JOB-EENO-2026-0045','อาคารตึกช้าง'),
('E00008','JOB-EENN-2024-0210','ธนาคารกสิกรไทย สำนักงานใหญ่'),
('E00008','JOB-NCZA-2026-0012','ห้องเซิร์ฟเวอร์ ธ.ไทยพาณิชย์'),
('E00008','JOB-NCBL-2025-0155','รถโดยสาร ขสมก.'),
('E00012','JOB-EENO-2025-0098','ศูนย์ราชการเฉลิมพระเกียรติฯ แจ้งวัฒนะ'),
('E00012','JOB-EESI-2026-0014','สถานีรถไฟฟ้ากลางกรุงเทพอภิวัฒน์'),
('E00012','JOB-EFMC-2025-0142','พระบรมมหาราชวัง'),
('E00012','JOB-EFPR-2026-0023','ท่าเรือแหลมฉบัง เฟส 3'),
('E00012','JOB-EEME-2024-0305','โรงพยาบาลจุฬาภรณ์'),
('E00015','JOB-MMKO-2024-0015','คลังสินค้า ซีเจ เอ็กซ์เพรส'),
('E00015','JOB-MMIN-2025-0078','โรงงานสิ่งทอสมุทรปราการ'),
('E00015','JOB-MMMB-2026-0033','บจก. ไทยเบฟเวอเรจ สุราษฎร์ธานี'),
('E00015','JOB-WTWP-2024-0102','บริษัท บีซีพีจี จำกัด (มหาชน)'),
('E00015','JOB-WTBC-2025-0099','เทศบาลเมืองหัวหิน'),
('E00023','JOB-WTDO-2024-0230','นิคมอุตสาหกรรมบางปู'),
('E00023','JOB-WTFL-2025-0115','โรงผลิตไฟฟ้า นวนคร'),
('E00023','JOB-WTHA-2026-0010','โรงแรมดุสิตธานี พัทยา'),
('E00023','JOB-MMEC-2025-0210','อาคารสยามพิวรรธน์ทาวเวอร์'),
('E00023','JOB-MMVA-2026-0044','โรงพยาบาลกรุงเทพ'),
('E00045','JOB-EENO-2025-0220','ศูนย์การค้าเอ็มสเฟียร์ (Emsphere)'),
('E00045','JOB-NCAG-2026-0015','ศูนย์ข้อมูลธนาคารกรุงไทย'),
('E00045','JOB-NCZA-2025-0102','ห้องมั่นคงธนาคารแห่งประเทศไทย'),
('E00045','JOB-NCLE-2026-0077','ห้องครัวศูนย์ประชุมแห่งชาติสิริกิติ์'),
('E00045','JOB-EESI-2024-0180','สถานีโทรทัศน์สีกองทัพบกช่อง 7'),
('E00057','JOB-MMKO-2025-0091','คลังสินค้า อะเมซอน วังน้อย'),
('E00057','JOB-MMIN-2026-0011','บจก. สยามคราฟท์อุตสาหกรรม'),
('E00057','JOB-MMMB-2024-0150','โรงงานไทยแอร์เอเชีย ดอนเมือง'),
('E00057','JOB-EENO-2025-0082','อาคารจีแลนด์ ทาวเวอร์ พระราม 9'),
('E00057','JOB-EEME-2026-0034','อาคารสยามสแควร์วัน'),
('E00062','JOB-EFMC-2024-0010','โรงกลั่นน้ำมันไทยออยล์ ศรีราชา'),
('E00062','JOB-EFPR-2025-0205','ท่าอากาศยานดอนเมือง อาคาร 3'),
('E00062','JOB-EFPI-2026-0092','คลังสินค้า โลตัส วังน้อย'),
('E00062','JOB-EFMC-2025-0310','นิคมอุตสาหกรรมมาบตาพุด'),
('E00062','JOB-EFPR-2026-0118','สถานีไฟฟ้าแรงสูง กฟผ. บางกรวย'),
('E00078','JOB-WTWP-2025-0062','คอนโดมิเนียม แอสทรา เชียงใหม่'),
('E00078','JOB-MMEC-2024-0110','โรงแรมแมนดาริน โอเรียนเต็ล'),
('E00078','JOB-EENO-2026-0022','ตึกทรู ดิจิทัล พาร์ค'),
('E00078','JOB-EFPR-2025-0088','สวนสนุกดรีมเวิลด์'),
('E00078','JOB-NCZA-2026-0145','ห้องควบคุมระบบรถไฟฟ้า BTS หมอชิต'),
('E00099','JOB-WTDO-2025-0150','นิคมอุตสาหกรรมโรจนะ อยุธยา'),
('E00099','JOB-WTFL-2026-0088','โรงงานยาหอมห้าเจดีย์'),
('E00099','JOB-WTHA-2024-0204','โรงพยาบาลกรุงเทพ คริสเตียน'),
('E00099','JOB-MMVA-2025-0077','โรงพยาบาลสมิติเวช สุขุมวิท'),
('E00099','JOB-MMMB-2026-0112','โรงงานนมโฟร์โมสต์ สำโรง'),
('E00101','JOB-EFMC-2026-0003','โรงงานกระดาษดับเบิ้ลเอ'),
('E00101','JOB-EFPR-2025-0110','โรงไฟฟ้าบางปะกง'),
('E00101','JOB-EFPI-2026-0047','ท่าอากาศยานสุวรรณภูมิ'),
('E00101','JOB-NCAG-2025-0082','นิคมอุตสาหกรรมอมตะซิตี้ ระยอง'),
('E00101','JOB-NCZA-2026-0059','ห้องเซิร์ฟเวอร์กรมการกงสุล'),
('E00259','JOB-WTBC-2024-0006','ห้างหุ้นส่วนจำกัด บุญชอบการประปา'),
('E00259','JOB-WTWP-2024-0014','บริษัท เวลท์ แอนด์ โปรส์ จำกัด'),
('E00259','JOB-MMEC-2026-0022','โรงพยาบาลรามาธิบดี'),
('E00259','JOB-MMIN-2025-0054','โรงงานสิ่งทอไทยราลอน'),
('E00259','JOB-MMMB-2026-0081','บจก. ไทยเบฟเวอเรจ'),
('E00259','JOB-MMVA-2025-0144','ศูนย์การค้าสยามพารากอน'),
('E00710','JOB-WTBC-2024-0004','ห้างหุ้นส่วนจำกัด บุญชอบการประปา'),
('E00710','JOB-WTBC-2024-0006','ห้างหุ้นส่วนจำกัด บุญชอบการประปา'),
('E00710','JOB-NCZA-2025-0092','ธนาคารกรุงเทพ สำนักงานใหญ่'),
('E00710','JOB-NCBL-2026-0018','รถไฟฟ้า MRT สายสีส้ม'),
('E00710','JOB-NCLE-2024-0150','ศูนย์การค้าเซ็นทรัล เอ็มบาสซี่'),
('E00710','JOB-EENO-2026-0090','ตึกคิง เพาเวอร์ มหานคร'),
('E00721','JOB-WTBC-2024-0003','ห้างหุ้นส่วนจำกัด บุญชอบการประปา'),
('E00721','JOB-WTWP-2024-0014','บริษัท เวลท์ แอนด์ โปรส์ จำกัด'),
('E00721','JOB-WTBR-2026-0011','โรงแรมแชงกรี-ล่า กรุงเทพฯ'),
('E00721','JOB-WTDO-2025-0098','การประปาส่วนภูมิภาค สาขารังสิต'),
('E00721','JOB-WTHA-2026-0056','เทศบาลนครนครปฐม'),
('E00721','JOB-WTFL-2025-0180','โรงงานอาหารไทยเพรซิเดนท์'),
('E00730','JOB-WTBC-2024-0003','ห้างหุ้นส่วนจำกัด บุญชอบการประปา'),
('E00730','JOB-WTBC-2024-0004','ห้างหุ้นส่วนจำกัด บุญชอบการประปา'),
('E00730','JOB-EENO-2025-0112','ศูนย์การค้าไอคอนสยาม'),
('E00730','JOB-EESI-2026-0008','ศูนย์ข้อมูลสำนักราชเลขาธิการ'),
('E00730','JOB-EEME-2025-0204','โรงพยาบาลจุฬาลงกรณ์'),
('E00730','JOB-EENN-2026-0077','โรงพยาบาลศิริราช'),
('E00730','JOB-NCLE-2025-0062','ห้องครัวโรงแรมโอเรียนเต็ล'),
('E00730','JOB-NCAG-2026-0105','โรงงานโตโยต้า สำโรง'),
('E00888','JOB-WTWP-2024-0025','บริษัท เวลท์ แอนด์ โปรส์ จำกัด'),
('E00888','JOB-WTBC-2024-0003','ห้างหุ้นส่วนจำกัด บุญชอบการประปา'),
('E00888','JOB-MMEC-2025-0120','คอนโดมิเนียม แอสปาย พระราม 9'),
('E00888','JOB-MMKO-2026-0028','คลังสินค้า บิ๊กซี วังน้อย'),
('E00888','JOB-EFMC-2025-0074','ปั๊มน้ำมันบางจาก วิภาวดี'),
('E00888','JOB-EFPR-2026-0015','โรงไฟฟ้าแม่เมาะ'),
('E00888','JOB-EFPI-2024-0312','คลังน้ำมัน ปตท. พระโขนง')
ON CONFLICT (emp_id, job_number) DO UPDATE SET customer_name = EXCLUDED.customer_name;
