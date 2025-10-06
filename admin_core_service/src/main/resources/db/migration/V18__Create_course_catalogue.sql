CREATE TABLE course_catalogue (
    id VARCHAR(255) PRIMARY KEY,
    catalogue_json TEXT,
    status VARCHAR(255),
    tag_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_cc_tg_name ON public.course_catalogue USING btree (tag_name);


CREATE TABLE catalogue_institute_mapping (
    id VARCHAR(255) PRIMARY KEY,
    course_catalogue VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    source_id VARCHAR(255),
    status VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT fk_course_catalogue FOREIGN KEY (course_catalogue) REFERENCES public.course_catalogue(id)
);

CREATE INDEX idx_cim_ins_id ON public.catalogue_institute_mapping USING btree (institute_id);
CREATE INDEX idx_cim_src ON public.catalogue_institute_mapping USING btree (source,source_id);