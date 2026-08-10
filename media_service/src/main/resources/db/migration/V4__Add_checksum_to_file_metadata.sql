ALTER TABLE file_metadata
    ADD COLUMN IF NOT EXISTS checksum      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS checksum_type VARCHAR(32);

COMMENT ON COLUMN file_metadata.checksum IS
    'Opaque integrity/change token for offline asset diffing. NULL until first requested via /media-service/internal/offline-asset-details.';
COMMENT ON COLUMN file_metadata.checksum_type IS
    'How to interpret checksum, e.g. S3_ETAG. NULL when checksum is NULL.';
