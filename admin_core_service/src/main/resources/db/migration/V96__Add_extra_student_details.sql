ALTER TABLE student
ADD COLUMN id_number VARCHAR(50),
ADD COLUMN id_type VARCHAR(20),

ADD COLUMN previous_school_name VARCHAR(255),
ADD COLUMN previous_school_board VARCHAR(50),
ADD COLUMN last_class_attended VARCHAR(50),
ADD COLUMN last_exam_result VARCHAR(50),
ADD COLUMN subjects_studied TEXT,

ADD COLUMN applying_for_class VARCHAR(50),
ADD COLUMN academic_year VARCHAR(20),
ADD COLUMN board_preference VARCHAR(50),

ADD COLUMN tc_number VARCHAR(50),
ADD COLUMN tc_issue_date DATE,
ADD COLUMN tc_pending BOOLEAN DEFAULT FALSE,

ADD COLUMN has_special_education_needs BOOLEAN DEFAULT FALSE,
ADD COLUMN is_physically_challenged BOOLEAN DEFAULT FALSE,
ADD COLUMN medical_conditions TEXT,
ADD COLUMN dietary_restrictions TEXT,

ADD COLUMN blood_group VARCHAR(10),
ADD COLUMN mother_tongue VARCHAR(50),
ADD COLUMN languages_known TEXT,
ADD COLUMN category VARCHAR(20),
ADD COLUMN nationality VARCHAR(50);
