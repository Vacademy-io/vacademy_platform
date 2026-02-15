-- Add short_url column to referral_mapping
ALTER TABLE public.referral_mapping ADD COLUMN short_url VARCHAR(512);

-- Remove short_url from referral_option as it's now managed in referral_mapping
ALTER TABLE public.referral_option DROP COLUMN short_url;
