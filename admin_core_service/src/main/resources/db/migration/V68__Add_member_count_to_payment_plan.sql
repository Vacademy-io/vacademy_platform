-- Add member_count column to payment_plan table
-- This column specifies the maximum number of members that can be added for sub-org plans

ALTER TABLE public.payment_plan 
ADD COLUMN member_count INTEGER DEFAULT 1;

COMMENT ON COLUMN public.payment_plan.member_count IS 'Maximum number of members that can be added for sub-org plans. Default is 1.';
