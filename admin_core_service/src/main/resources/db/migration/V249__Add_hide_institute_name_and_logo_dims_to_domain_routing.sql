ALTER TABLE institute_domain_routing
    ADD COLUMN IF NOT EXISTS hide_institute_name BOOLEAN,
    ADD COLUMN IF NOT EXISTS logo_width_px       INTEGER,
    ADD COLUMN IF NOT EXISTS logo_height_px      INTEGER;
