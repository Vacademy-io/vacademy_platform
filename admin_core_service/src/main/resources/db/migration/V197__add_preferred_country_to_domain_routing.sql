-- Add comma-separated list of preferred countries (ISO 3166-1 alpha-2 codes) to institute_domain_routing
ALTER TABLE institute_domain_routing ADD COLUMN comma_separated_preferred_country VARCHAR(500);
