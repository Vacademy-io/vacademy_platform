-- Add report_pdf_file_id column to cache generated PDF for student reports
ALTER TABLE student_attempt ADD COLUMN IF NOT EXISTS report_pdf_file_id VARCHAR(255);
