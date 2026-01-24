-- Expand varchar length from 20 to 50 for student contact fields

ALTER TABLE public.student
    ALTER COLUMN pin_code TYPE varchar(50),
    ALTER COLUMN mobile_number TYPE varchar(50),
    ALTER COLUMN parents_mobile_number TYPE varchar(50),
    ALTER COLUMN parents_to_mother_email TYPE varchar(50);
