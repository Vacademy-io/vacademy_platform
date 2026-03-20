-- V156: Add start_date and end_date to aft_installments
-- Adds validity period for each fee installment

ALTER TABLE aft_installments
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE;
