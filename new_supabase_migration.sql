-- ============================================================
-- Migration Script สำหรับ Supabase Account ใหม่
-- รันทั้งหมดนี้ใน SQL Editor ของ Supabase project ใหม่
-- ============================================================

-- 1. สร้างตาราง employee_master_data
CREATE TABLE IF NOT EXISTS public.employee_master_data (
    emp_id TEXT NOT NULL,
    emp_name TEXT,
    job_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sales_person TEXT,
    project_description TEXT,
    PRIMARY KEY (emp_id, job_number)
);

-- 2. สร้างตาราง events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID NOT NULL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE,
    session_id CHARACTER VARYING,
    event_type CHARACTER VARYING,
    employee_id CHARACTER VARYING,
    employee_name CHARACTER VARYING,
    customer_name CHARACTER VARYING,
    project_name CHARACTER VARYING,
    metadata JSONB
);

-- 3. สร้างตาราง qr_logs
CREATE TABLE IF NOT EXISTS public.qr_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    employee_id CHARACTER VARYING,
    employee_name CHARACTER VARYING,
    project_name CHARACTER VARYING,
    customer_name CHARACTER VARYING,
    generated_url TEXT,
    user_agent TEXT
);

-- 4. สร้างตาราง survey_results
CREATE TABLE IF NOT EXISTS public.survey_results (
    id UUID NOT NULL PRIMARY KEY,
    submitted_at TIMESTAMP WITH TIME ZONE,
    session_id CHARACTER VARYING,
    employee_id CHARACTER VARYING,
    employee_name CHARACTER VARYING,
    project_name CHARACTER VARYING,
    customer_name CHARACTER VARYING,
    pdpa_consent_1 CHARACTER VARYING,
    score_q1 INTEGER,
    score_q2 INTEGER,
    score_q3 INTEGER,
    score_q4 INTEGER,
    improvements TEXT,
    improvements_other TEXT,
    contact_name CHARACTER VARYING,
    contact_phone CHARACTER VARYING,
    contact_email CHARACTER VARYING,
    pdpa_consent_2 CHARACTER VARYING
);

-- ============================================================
-- 5. เปิด Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.employee_master_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_results ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. กำหนด Policy (อนุญาตให้ anon อ่าน employee_master_data ได้)
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_master_data' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON public.employee_master_data FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_results' AND policyname = 'Enable insert for all users') THEN
        CREATE POLICY "Enable insert for all users" ON public.survey_results FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qr_logs' AND policyname = 'Enable insert for all users') THEN
        CREATE POLICY "Enable insert for all users" ON public.qr_logs FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Enable insert for all users') THEN
        CREATE POLICY "Enable insert for all users" ON public.events FOR INSERT WITH CHECK (true);
    END IF;
END $$;
