DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'enquiry'
          AND column_name = 'student_relation_with_parent'
    ) THEN
        ALTER TABLE enquiry
        RENAME COLUMN student_relation_with_parent TO parent_relation_with_child;
    ELSIF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'enquiry'
          AND column_name = 'parent_relation_with_child'
    ) THEN
        ALTER TABLE enquiry
        ADD COLUMN parent_relation_with_child VARCHAR(100);
    END IF;
END $$;
