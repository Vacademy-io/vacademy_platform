-- Add allow_combine_offers column to referral_option table
ALTER TABLE referral_option 
ADD COLUMN allow_combine_offers BOOLEAN DEFAULT FALSE;