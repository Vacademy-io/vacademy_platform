-- Migration: Create system_field_custom_field_mapping table
-- Purpose: Maps system fields (database columns) to custom fields for bidirectional sync

CREATE TABLE IF NOT EXISTS system_field_custom_field_mapping (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id VARCHAR(36) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,           -- STUDENT, USER, ENQUIRY, etc.
    system_field_name VARCHAR(100) NOT NULL,    -- Database column name: full_name, mobile_number, etc.
    custom_field_id VARCHAR(36) NOT NULL,
    sync_direction VARCHAR(20) NOT NULL DEFAULT 'BIDIRECTIONAL',  -- BIDIRECTIONAL, TO_SYSTEM, TO_CUSTOM, NONE
    converter_class VARCHAR(255),               -- Optional type converter class name
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate mappings for the same combination
    CONSTRAINT uk_system_field_mapping UNIQUE (institute_id, entity_type, system_field_name, custom_field_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sfcfm_custom_field_id ON system_field_custom_field_mapping(custom_field_id);
CREATE INDEX IF NOT EXISTS idx_sfcfm_institute_entity ON system_field_custom_field_mapping(institute_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_sfcfm_system_field ON system_field_custom_field_mapping(institute_id, entity_type, system_field_name);
CREATE INDEX IF NOT EXISTS idx_sfcfm_status ON system_field_custom_field_mapping(status);

-- Trigger to update updated_at on modification
CREATE OR REPLACE FUNCTION update_sfcfm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sfcfm_updated_at ON system_field_custom_field_mapping;
CREATE TRIGGER trigger_update_sfcfm_updated_at
    BEFORE UPDATE ON system_field_custom_field_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_sfcfm_updated_at();

COMMENT ON TABLE system_field_custom_field_mapping IS 'Maps system fields (database columns) to custom fields for bidirectional synchronization';
COMMENT ON COLUMN system_field_custom_field_mapping.entity_type IS 'The entity type: STUDENT, USER, ENQUIRY, etc.';
COMMENT ON COLUMN system_field_custom_field_mapping.system_field_name IS 'The database column name in snake_case: full_name, mobile_number, etc.';
COMMENT ON COLUMN system_field_custom_field_mapping.sync_direction IS 'Sync direction: BIDIRECTIONAL (both ways), TO_SYSTEM (custom->system only), TO_CUSTOM (system->custom only), NONE (manual only)';
