-- =============================================================================
-- V89: Add Booking System Tables and Columns
-- =============================================================================
-- This migration adds support for the calendar booking system:
-- 1. Creates booking_types table for categorizing different types of bookings
-- 2. Adds booking_type_id, source, and source_id columns to live_session table
-- =============================================================================

-- Create booking_types table
CREATE TABLE IF NOT EXISTS booking_types (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    description TEXT,
    institute_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint on code (to prevent duplicate codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_types_code ON booking_types(code);

-- Add index on institute_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_types_institute_id ON booking_types(institute_id);

-- Add new columns to live_session table
ALTER TABLE live_session 
    ADD COLUMN IF NOT EXISTS booking_type_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

-- Add index on booking_type_id for filtering by booking type
CREATE INDEX IF NOT EXISTS idx_live_session_booking_type_id ON live_session(booking_type_id);

-- Add composite index on source and source_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_live_session_source ON live_session(source, source_id);

-- Add foreign key constraint (optional, but recommended for data integrity)
-- Note: Using IF NOT EXISTS pattern with DO block for foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_live_session_booking_type'
    ) THEN
        ALTER TABLE live_session
            ADD CONSTRAINT fk_live_session_booking_type
            FOREIGN KEY (booking_type_id)
            REFERENCES booking_types(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Insert some default global booking types (institute_id = NULL means global)
INSERT INTO booking_types (id, type, code, description, institute_id)
VALUES 
    (gen_random_uuid()::text, 'School Visit', 'SCHOOL_VISIT', 'Campus tour or school visit for prospective students', NULL),
    (gen_random_uuid()::text, 'Parent Meeting', 'PARENT_MEETING', 'Meeting with parents or guardians', NULL),
    (gen_random_uuid()::text, 'Counseling Session', 'COUNSELING_SESSION', 'One-on-one counseling or guidance session', NULL),
    (gen_random_uuid()::text, 'Enquiry Meeting', 'ENQUIRY_MEETING', 'Meeting related to admission or general enquiry', NULL),
    (gen_random_uuid()::text, 'General Meeting', 'GENERAL_MEETING', 'General purpose meeting', NULL)
ON CONFLICT (code) DO NOTHING;

-- Add CANCELLED status support to session_schedules if not exists
-- (The status column already exists, this just documents that CANCELLED is a valid value)
COMMENT ON COLUMN session_schedules.status IS 'Valid values: ACTIVE, DELETED, CANCELLED, COMPLETED';

-- Update trigger for updated_at on booking_types
CREATE OR REPLACE FUNCTION update_booking_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_booking_types_updated_at ON booking_types;
CREATE TRIGGER trigger_update_booking_types_updated_at
    BEFORE UPDATE ON booking_types
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_types_updated_at();
