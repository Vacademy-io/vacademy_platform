-- Indexes for the leads custom-field filtering feature.
--
-- custom_field_values previously had only its primary key, so both the leads
-- list custom-field predicate (a correlated EXISTS on source_type + source_id)
-- and the new distinct-values dropdown query had to scan the table. These two
-- composite indexes keep both paths cheap as the table grows, so enabling
-- custom-field filters on the leads views does not turn the queries bulky.

-- Speeds up the per-lead match in findLeadsWithFilters / findInstituteLeadsWithFilters
-- (WHERE cfv.source_type = 'AUDIENCE_RESPONSE' AND cfv.source_id = ar.id) and the
-- bulk value fetch in findBySourceTypeAndSourceIdIn used to enrich lead rows.
CREATE INDEX IF NOT EXISTS idx_cfv_source
    ON custom_field_values (source_type, source_id);

-- Speeds up the distinct-values dropdown query
-- (WHERE custom_field_id = ? AND source_type = ? ... DISTINCT value, ILIKE search)
-- and the custom_field_id match inside the filter predicate.
CREATE INDEX IF NOT EXISTS idx_cfv_field_source_value
    ON custom_field_values (custom_field_id, source_type, value);
