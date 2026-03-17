-- V12__add_otp_type_and_phone_number.sql
-- Add support for WhatsApp OTP authentication

-- Add phone_number column for storing WhatsApp phone numbers
ALTER TABLE email_otp 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add type column to distinguish between EMAIL and WHATSAPP OTPs
ALTER TABLE email_otp 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'EMAIL';
