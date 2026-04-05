-- Fix type mismatch: JPA entity maps bbb_server_pool.id as String,
-- but V192 created it as UUID. Hibernate sends it as VARCHAR which
-- PostgreSQL rejects in WHERE clauses. Change to VARCHAR(36).
ALTER TABLE bbb_server_pool
    ALTER COLUMN id TYPE VARCHAR(36) USING id::VARCHAR;
