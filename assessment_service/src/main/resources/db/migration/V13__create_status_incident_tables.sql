-- Status / health-dashboard incidents.
-- Served by community-service (lives in the shared assessment_service DB, whose
-- schema is owned by assessment-service's Flyway). Kept here so the public status
-- page stays available even when admin-core / auth are down.
--
-- Single table: the incident plus its timeline of updates, which is stored inline
-- as a JSON array (newest-first) rather than in a separate table.

CREATE TABLE IF NOT EXISTS public.status_incident (
    id                   varchar(255) PRIMARY KEY,
    title                varchar(500) NOT NULL,
    status               varchar(50)  NOT NULL,                       -- INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED
    severity             varchar(50)  NOT NULL,                       -- MINOR | MAJOR | CRITICAL | MAINTENANCE
    affected_components  text         NULL,                           -- comma-separated component / service names
    updates              jsonb        NOT NULL DEFAULT '[]'::jsonb,   -- [{id,status,message,createdBy,createdByName,createdAt}, ...]
    started_at           timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at          timestamp    NULL,
    created_by           varchar(255) NULL,                           -- user id of the admin who declared it
    created_by_name      varchar(255) NULL,
    created_at           timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at           timestamp    DEFAULT CURRENT_TIMESTAMP
);

-- Read-path indexes for the status page (newest-first listing + active-incident filter).
CREATE INDEX IF NOT EXISTS idx_status_incident_started_at ON public.status_incident (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_incident_status     ON public.status_incident (status);
