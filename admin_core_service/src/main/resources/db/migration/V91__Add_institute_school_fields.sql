-- Add institute school-specific fields
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS board varchar(255) NULL;
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS gst_details text NULL;
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS affiliation_number varchar(255) NULL;
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS staff_strength integer NULL;
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS school_strength integer NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.institutes.board IS 'Education board (e.g., CBSE, ICSE, State Board)';
COMMENT ON COLUMN public.institutes.gst_details IS 'GST registration number and details';
COMMENT ON COLUMN public.institutes.affiliation_number IS 'Official affiliation number from the board';
COMMENT ON COLUMN public.institutes.staff_strength IS 'Total number of staff members';
COMMENT ON COLUMN public.institutes.school_strength IS 'Total number of students enrolled';
