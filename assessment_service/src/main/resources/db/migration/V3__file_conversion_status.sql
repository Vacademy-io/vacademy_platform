-- File Conversion Status Table
-- Stores the status and results of file processing operations (e.g., PDF to HTML conversion)
CREATE TABLE file_conversion_status (
    id VARCHAR(36) PRIMARY KEY,
    file_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    vendor_file_id VARCHAR(255),
    html_text TEXT,
    file_type VARCHAR(50),
    vendor VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_file_id ON file_conversion_status(vendor_file_id);
CREATE INDEX idx_file_id ON file_conversion_status(file_id);