 
-- Add type column (EMAIL or WHATSAPP)
ALTER TABLE public.email_otp 
ADD COLUMN type VARCHAR(20) DEFAULT 'EMAIL' NOT NULL;

-- Add phone_number column for WhatsApp OTP
ALTER TABLE public.email_otp 
ADD COLUMN phone_number VARCHAR(20) NULL;

-- Create index on phone_number for efficient lookups
CREATE INDEX idx_email_otp_phone_number ON public.email_otp USING btree (phone_number);

-- Create index on type for filtering
CREATE INDEX idx_email_otp_type ON public.email_otp USING btree (type);

-- Create composite index for phone_number and type lookups
CREATE INDEX idx_email_otp_phone_type ON public.email_otp USING btree (phone_number, type);

-- Add comment to document the table's dual purpose
COMMENT ON TABLE public.email_otp IS 'Stores OTP for both email and WhatsApp authentication';
COMMENT ON COLUMN public.email_otp.type IS 'Type of OTP: EMAIL or WHATSAPP';
COMMENT ON COLUMN public.email_otp.phone_number IS 'Phone number for WhatsApp OTP (null for email OTP)';
