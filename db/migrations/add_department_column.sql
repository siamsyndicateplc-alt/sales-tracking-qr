-- Migration: add department column to employee_master_data
-- Run this in Supabase SQL Editor once

ALTER TABLE employee_master_data
    ADD COLUMN IF NOT EXISTS department VARCHAR(10);
