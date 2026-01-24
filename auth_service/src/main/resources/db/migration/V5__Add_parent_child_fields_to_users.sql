-- Add is_parent and linked_parent_id fields to users table for parent-child relationship

ALTER TABLE public.users 
ADD COLUMN is_parent BOOLEAN DEFAULT FALSE,
ADD COLUMN linked_parent_id VARCHAR(255) NULL;

-- Create index for parent-child relationship queries
CREATE INDEX idx_users_linked_parent_id ON public.users USING btree (linked_parent_id) WHERE (linked_parent_id IS NOT NULL);
CREATE INDEX idx_users_is_parent ON public.users USING btree (is_parent) WHERE (is_parent = TRUE);

-- Add foreign key constraint (optional, for data integrity)
ALTER TABLE public.users
ADD CONSTRAINT fk_users_linked_parent FOREIGN KEY (linked_parent_id) REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.is_parent IS 'Indicates if this user is a parent/guardian';
COMMENT ON COLUMN public.users.linked_parent_id IS 'Reference to parent user ID for child users';
