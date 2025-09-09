-- public.client_secret_key definition

-- Drop table

-- DROP TABLE public.client_secret_key;

CREATE TABLE public.client_secret_key (
	client_name varchar(255) NOT NULL,
	secret_key varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT client_secret_key_pkey PRIMARY KEY (client_name)
);


-- public.evaluation_user definition

-- Drop table

-- DROP TABLE public.evaluation_user;

CREATE TABLE public.evaluation_user (
	id varchar(255) NULL,
	source_id varchar(255) NULL,
	source_type varchar(255) NULL,
	response_json text NULL,
	user_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL
);


-- public.file_conversion_status definition

-- Drop table

-- DROP TABLE public.file_conversion_status;

CREATE TABLE public.file_conversion_status (
	id varchar(255) NOT NULL,
	file_id varchar(255) NULL,
	status varchar(255) NULL,
	vendor_file_id varchar(255) NULL,
	html_text text NULL,
	file_type varchar(255) NULL,
	vendor varchar(255) NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT file_conversion_status_pkey PRIMARY KEY (id)
);


-- public.file_metadata definition

-- Drop table

-- DROP TABLE public.file_metadata;

CREATE TABLE public.file_metadata (
	id varchar(255) NOT NULL,
	file_name varchar(255) NOT NULL,
	file_type varchar(100) NOT NULL,
	file_size int8 NULL,
	"key" varchar(255) NOT NULL,
	"source" varchar(255) NOT NULL,
	source_id varchar(255) NOT NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	width float8 NULL,
	height float8 NULL,
	CONSTRAINT file_metadata_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.file_metadata for each row execute function update_updated_on_user_task();


-- public.scheduler_activity_log definition

-- Drop table

-- DROP TABLE public.scheduler_activity_log;

CREATE TABLE public.scheduler_activity_log (
	id varchar(255) NOT NULL,
	task_name varchar(255) NULL,
	status varchar(255) NULL,
	execution_time timestamptz NULL,
	cron_profile_id varchar(255) NULL,
	cron_profile_type varchar(255) NULL,
	created_at timestamptz DEFAULT now() NULL,
	update_at timestamptz DEFAULT now() NULL,
	CONSTRAINT scheduler_activity_log_pkey PRIMARY KEY (id)
);


-- public.task_status definition

-- Drop table

-- DROP TABLE public.task_status;

CREATE TABLE public.task_status (
	id varchar(255) NOT NULL,
	"type" varchar(255) NULL,
	status varchar(255) NULL,
	institute_id varchar(255) NULL,
	result_json text NULL,
	input_id varchar(255) NULL,
	input_type varchar(255) NULL,
	task_name varchar(255) NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	parent_id varchar(255) NULL,
	dynamic_values_map text NULL,
	status_message text NULL,
	CONSTRAINT task_status_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger set_task_status_timestamps before
insert
    on
    public.task_status for each row execute function set_timestamp();


-- public.task_execution_audit definition

-- Drop table

-- DROP TABLE public.task_execution_audit;

CREATE TABLE public.task_execution_audit (
	id varchar(255) NOT NULL,
	task_id varchar(255) NULL,
	status varchar(255) NULL,
	status_message text NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT task_execution_audit_pkey PRIMARY KEY (id),
	CONSTRAINT fk_task_id FOREIGN KEY (task_id) REFERENCES public.scheduler_activity_log(id)
);


-- public.user_to_file definition

-- Drop table

-- DROP TABLE public.user_to_file;

CREATE TABLE public.user_to_file (
	id varchar(255) NOT NULL,
	file_id varchar(255) NOT NULL,
	folder_icon varchar(255) NULL,
	folder_name varchar(255) NULL,
	user_id varchar(255) NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	source_id varchar(255) NULL,
	status varchar(255) NULL,
	source_type varchar(255) NULL,
	CONSTRAINT user_to_file_pkey PRIMARY KEY (id),
	CONSTRAINT fk_file_id_user_to_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id),
	CONSTRAINT fk_folder_icon_user_to_file FOREIGN KEY (folder_icon) REFERENCES public.file_metadata(id)
);

-- Table Triggers

create trigger update_user_to_file_updated_on before
update
    on
    public.user_to_file for each row execute function update_updated_on_user_task();