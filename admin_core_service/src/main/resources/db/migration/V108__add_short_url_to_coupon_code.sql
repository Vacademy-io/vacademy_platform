-- Add short_url column to coupon_code table
ALTER TABLE public.coupon_code ADD COLUMN short_url VARCHAR(512);

-- Comment explaining the column
COMMENT ON COLUMN public.coupon_code.short_url IS 'Generated short URL for the referral/coupon code';
