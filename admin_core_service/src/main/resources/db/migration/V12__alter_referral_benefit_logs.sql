-- V12__alter_referral_benefit_logs.sql
-- Migration to change benefit_value and beneficiary column to TEXT

ALTER TABLE referral_benefit_logs
    ALTER COLUMN benefit_value TYPE TEXT;
