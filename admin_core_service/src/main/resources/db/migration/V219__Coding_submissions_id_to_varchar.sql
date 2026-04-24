-- V218 created coding_submissions.id as UUID, but the JPA entity uses a
-- String id with @UuidGenerator (Hibernate binds as VARCHAR), matching the
-- rest of this service's tables. Convert id to VARCHAR(255) so inserts work.
ALTER TABLE coding_submissions
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(255) USING id::text;
