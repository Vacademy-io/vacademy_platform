-- Adds a per-domain white-label branding toggle: when true, the institute name
-- is rendered stacked BELOW the logo (centered vertical) instead of to its right.
-- NULL / false preserves the existing side-by-side layout.
ALTER TABLE institute_domain_routing
    ADD COLUMN IF NOT EXISTS stack_name_below_logo BOOLEAN;
