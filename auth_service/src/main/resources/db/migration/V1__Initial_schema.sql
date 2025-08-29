-- public.client_credentials definition

-- Drop table

-- DROP TABLE public.client_credentials;

CREATE TABLE public.client_credentials (
	id varchar(255) NOT NULL,
	client_name varchar(255) NULL,
	"token" varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT client_credentials_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_client_credentials_client_name ON public.client_credentials USING btree (client_name);
CREATE INDEX idx_client_credentials_created_at ON public.client_credentials USING btree (created_at DESC);
CREATE INDEX idx_client_credentials_token ON public.client_credentials USING btree (token);


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

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.client_secret_key for each row execute function update_updated_on_user_task();


-- public.daily_user_activity_summary definition

-- Drop table

-- DROP TABLE public.daily_user_activity_summary;

CREATE TABLE public.daily_user_activity_summary (
	id uuid NOT NULL,
	user_id uuid NOT NULL,
	institute_id uuid NOT NULL,
	activity_date date NOT NULL,
	total_sessions int4 DEFAULT 0 NULL,
	total_activity_time_minutes int8 DEFAULT 0 NULL,
	total_api_calls int4 DEFAULT 0 NULL,
	unique_services_used int4 DEFAULT 0 NULL,
	first_activity_time timestamp NULL,
	last_activity_time timestamp NULL,
	services_used varchar(1000) NULL,
	device_types_used varchar(500) NULL,
	peak_activity_hour int4 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT daily_user_activity_summary_pkey PRIMARY KEY (id),
	CONSTRAINT daily_user_activity_summary_user_id_institute_id_activity_d_key UNIQUE (user_id, institute_id, activity_date)
);
CREATE INDEX idx_daily_activity_institute_date ON public.daily_user_activity_summary USING btree (institute_id, activity_date);
CREATE INDEX idx_daily_activity_user_institute_date ON public.daily_user_activity_summary USING btree (user_id, institute_id, activity_date);
CREATE INDEX idx_daily_summary_activity_date ON public.daily_user_activity_summary USING btree (activity_date);
CREATE INDEX idx_daily_summary_analytics ON public.daily_user_activity_summary USING btree (institute_id, activity_date, total_sessions);
CREATE INDEX idx_daily_summary_institute_date ON public.daily_user_activity_summary USING btree (institute_id, activity_date);
CREATE INDEX idx_daily_summary_institute_id ON public.daily_user_activity_summary USING btree (institute_id);
CREATE INDEX idx_daily_summary_user_id ON public.daily_user_activity_summary USING btree (user_id);


-- public.oauth2_vendor_to_user_detail definition

-- Drop table

-- DROP TABLE public.oauth2_vendor_to_user_detail;

CREATE TABLE public.oauth2_vendor_to_user_detail (
	id varchar NOT NULL,
	email_id varchar(255) NULL,
	provider_id varchar(100) NULL,
	subject varchar(255) NULL,
	CONSTRAINT oauth2_vendor_to_user_detail_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_oauth2_vendor_provider_id ON public.oauth2_vendor_to_user_detail USING btree (provider_id);
CREATE INDEX idx_oauth2_vendor_provider_subject ON public.oauth2_vendor_to_user_detail USING btree (provider_id, subject);


-- public.permissions definition

-- Drop table

-- DROP TABLE public.permissions;

CREATE TABLE public.permissions (
	id varchar(255) NOT NULL,
	permission_name varchar(255) NOT NULL,
	tag varchar(100) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT pk_permissions PRIMARY KEY (id),
	CONSTRAINT uk_permissions_name UNIQUE (permission_name)
);
CREATE INDEX idx_permissions_created_at ON public.permissions USING btree (created_at DESC);
CREATE INDEX idx_permissions_name ON public.permissions USING btree (permission_name);
CREATE INDEX idx_permissions_tag ON public.permissions USING btree (tag) WHERE (tag IS NOT NULL);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.permissions for each row execute function update_updated_on_user_task();


-- public.roles definition

-- Drop table

-- DROP TABLE public.roles;

CREATE TABLE public.roles (
	id varchar(255) NOT NULL,
	role_name varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT pk_roles PRIMARY KEY (id),
	CONSTRAINT uk_roles_name UNIQUE (role_name)
);
CREATE INDEX idx_roles_created_at ON public.roles USING btree (created_at DESC);
CREATE INDEX idx_roles_name ON public.roles USING btree (role_name);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.roles for each row execute function update_updated_on_user_task();


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


-- public.user_activity_log definition

-- Drop table

-- DROP TABLE public.user_activity_log;

CREATE TABLE public.user_activity_log (
	id varchar(36) NOT NULL,
	user_id varchar(36) NOT NULL,
	institute_id varchar(36) NULL,
	service_name varchar(100) NULL,
	endpoint varchar(500) NULL,
	action_type varchar(50) NULL,
	session_id varchar(255) NULL,
	ip_address varchar(45) NULL,
	user_agent varchar(500) NULL,
	device_type varchar(50) NULL,
	response_status int4 NULL,
	response_time_ms int8 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT user_activity_log_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_activity_log_analytics ON public.user_activity_log USING btree (institute_id, created_at, user_id);
CREATE INDEX idx_failed_login_tracking ON public.user_activity_log USING btree (user_id, created_at, response_status) WHERE (response_status >= 400);
CREATE INDEX idx_ip_activity_tracking ON public.user_activity_log USING btree (ip_address, created_at) WHERE (ip_address IS NOT NULL);
CREATE INDEX idx_user_activity_created_at ON public.user_activity_log USING btree (created_at);
CREATE INDEX idx_user_activity_institute_id ON public.user_activity_log USING btree (institute_id);
CREATE INDEX idx_user_activity_log_created_at ON public.user_activity_log USING btree (created_at DESC);
CREATE INDEX idx_user_activity_log_device_type ON public.user_activity_log USING btree (device_type) WHERE (device_type IS NOT NULL);
CREATE INDEX idx_user_activity_log_institute_date ON public.user_activity_log USING btree (institute_id, created_at DESC) WHERE (institute_id IS NOT NULL);
CREATE INDEX idx_user_activity_log_institute_id ON public.user_activity_log USING btree (institute_id) WHERE (institute_id IS NOT NULL);
CREATE INDEX idx_user_activity_log_performance_analysis ON public.user_activity_log USING btree (service_name, institute_id, response_time_ms, created_at) WHERE ((response_time_ms IS NOT NULL) AND (institute_id IS NOT NULL));
CREATE INDEX idx_user_activity_log_response_status ON public.user_activity_log USING btree (response_status) WHERE (response_status IS NOT NULL);
CREATE INDEX idx_user_activity_log_response_time ON public.user_activity_log USING btree (response_time_ms) WHERE (response_time_ms IS NOT NULL);
CREATE INDEX idx_user_activity_log_service_institute_date ON public.user_activity_log USING btree (service_name, institute_id, created_at DESC) WHERE (service_name IS NOT NULL);
CREATE INDEX idx_user_activity_log_service_name ON public.user_activity_log USING btree (service_name) WHERE (service_name IS NOT NULL);
CREATE INDEX idx_user_activity_log_session_id ON public.user_activity_log USING btree (session_id) WHERE (session_id IS NOT NULL);
CREATE INDEX idx_user_activity_log_user_id ON public.user_activity_log USING btree (user_id);
CREATE INDEX idx_user_activity_log_user_institute_date ON public.user_activity_log USING btree (user_id, institute_id, created_at DESC);
CREATE INDEX idx_user_activity_log_user_service_date ON public.user_activity_log USING btree (user_id, service_name, created_at DESC) WHERE (service_name IS NOT NULL);
CREATE INDEX idx_user_activity_service_name ON public.user_activity_log USING btree (service_name);
CREATE INDEX idx_user_activity_session_id ON public.user_activity_log USING btree (session_id);
CREATE INDEX idx_user_activity_user_id ON public.user_activity_log USING btree (user_id);
CREATE INDEX idx_user_activity_user_institute_date ON public.user_activity_log USING btree (user_id, institute_id, created_at);


-- public.user_session definition

-- Drop table

-- DROP TABLE public.user_session;

CREATE TABLE public.user_session (
	id varchar(36) NOT NULL,
	user_id varchar(36) NOT NULL,
	institute_id varchar(36) NULL,
	session_token varchar(255) NOT NULL,
	ip_address varchar(45) NULL,
	user_agent varchar(500) NULL,
	device_type varchar(50) NULL,
	device_id varchar(100) NULL,
	is_active bool DEFAULT true NOT NULL,
	login_time timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	last_activity_time timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	logout_time timestamp NULL,
	session_duration_minutes int8 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT user_session_pkey PRIMARY KEY (id),
	CONSTRAINT user_session_session_token_key UNIQUE (session_token)
);
CREATE INDEX idx_realtime_session_mgmt ON public.user_session USING btree (user_id, is_active, session_token, last_activity_time) WHERE (is_active = true);
CREATE INDEX idx_session_analytics ON public.user_session USING btree (institute_id, is_active, last_activity_time);
CREATE INDEX idx_session_duration_analysis ON public.user_session USING btree (user_id, session_duration_minutes, login_time) WHERE (session_duration_minutes IS NOT NULL);
CREATE INDEX idx_session_validation_lookup ON public.user_session USING btree (session_token, is_active, last_activity_time) WHERE (is_active = true);
CREATE INDEX idx_user_session_active ON public.user_session USING btree (is_active);
CREATE INDEX idx_user_session_active_token ON public.user_session USING btree (session_token, is_active) WHERE (is_active = true);
CREATE INDEX idx_user_session_device_id ON public.user_session USING btree (device_id) WHERE (device_id IS NOT NULL);
CREATE INDEX idx_user_session_device_type ON public.user_session USING btree (device_type) WHERE (device_type IS NOT NULL);
CREATE INDEX idx_user_session_institute_id ON public.user_session USING btree (institute_id);
CREATE INDEX idx_user_session_is_active ON public.user_session USING btree (is_active);
CREATE INDEX idx_user_session_last_activity ON public.user_session USING btree (last_activity_time);
CREATE INDEX idx_user_session_login_time ON public.user_session USING btree (login_time);
CREATE INDEX idx_user_session_logout_time ON public.user_session USING btree (logout_time) WHERE (logout_time IS NOT NULL);
CREATE INDEX idx_user_session_token ON public.user_session USING btree (session_token);
CREATE INDEX idx_user_session_user_active_login ON public.user_session USING btree (user_id, institute_id, is_active, login_time DESC);
CREATE INDEX idx_user_session_user_id ON public.user_session USING btree (user_id);
CREATE INDEX idx_user_session_user_institute ON public.user_session USING btree (user_id, institute_id);

-- Table Triggers

create trigger update_user_session_updated_at before
update
    on
    public.user_session for each row execute function update_updated_at_column();


-- public.users definition

-- Drop table

-- DROP TABLE public.users;

CREATE TABLE public.users (
	id varchar(255) NOT NULL,
	username varchar(255) NOT NULL,
	email varchar(255) NOT NULL,
	password_hash varchar(255) NOT NULL,
	full_name varchar(255) NULL,
	address_line varchar(255) NULL,
	city varchar(255) NULL,
	pin_code varchar(10) NULL,
	mobile_number varchar(25) NULL,
	date_of_birth date NULL,
	gender varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	is_root_user bool DEFAULT false NULL,
	profile_pic_file_id varchar(255) NULL,
	last_token_update_time timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT pk_users PRIMARY KEY (id),
	CONSTRAINT uk_users_username UNIQUE (username)
);
CREATE INDEX idx_ultra_fast_auth ON public.users USING btree (username, email, password_hash, is_root_user);
CREATE INDEX idx_users_auth_lookup ON public.users USING btree (username, email, is_root_user) WHERE (is_root_user = true);
CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_email_created_at ON public.users USING btree (email, created_at DESC);
CREATE INDEX idx_users_full_name_gin ON public.users USING gin (to_tsvector('english'::regconfig, (full_name)::text)) WHERE (full_name IS NOT NULL);
CREATE INDEX idx_users_is_root_user ON public.users USING btree (is_root_user) WHERE (is_root_user = true);
CREATE INDEX idx_users_last_token_update ON public.users USING btree (last_token_update_time) WHERE (last_token_update_time IS NOT NULL);
CREATE INDEX idx_users_mobile_number ON public.users USING btree (mobile_number) WHERE (mobile_number IS NOT NULL);
CREATE INDEX idx_users_username ON public.users USING btree (username);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.users for each row execute function update_updated_on_user_task();


-- public.refresh_token definition

-- Drop table

-- DROP TABLE public.refresh_token;

CREATE TABLE public.refresh_token (
	id varchar(255) NOT NULL,
	expiry_date timestamptz(6) NULL,
	"token" varchar(255) NULL,
	user_id varchar(255) NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	client_name varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT refresh_token_pkey PRIMARY KEY (id),
	CONSTRAINT uk_f95ixxe7pa48ryn1awmh2evt7 UNIQUE (user_id),
	CONSTRAINT fkjtx87i0jvq2svedphegvdwcuy FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_token_client_name ON public.refresh_token USING btree (client_name) WHERE (client_name IS NOT NULL);
CREATE INDEX idx_refresh_token_expiry ON public.refresh_token USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX idx_refresh_token_token ON public.refresh_token USING btree (token);
CREATE INDEX idx_refresh_token_user_client ON public.refresh_token USING btree (user_id, client_name);
CREATE INDEX idx_refresh_token_user_id ON public.refresh_token USING btree (user_id);


-- public.role_permission definition

-- Drop table

-- DROP TABLE public.role_permission;

CREATE TABLE public.role_permission (
	role_id varchar(255) NULL,
	permission_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT fk_permission_id FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE,
	CONSTRAINT fk_role_id FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE
);
CREATE INDEX idx_role_permission_composite ON public.role_permission USING btree (role_id, permission_id);
CREATE INDEX idx_role_permission_permission_id ON public.role_permission USING btree (permission_id);
CREATE INDEX idx_role_permission_role_id ON public.role_permission USING btree (role_id);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.role_permission for each row execute function update_updated_on_user_task();


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


-- public.user_permission definition

-- Drop table

-- DROP TABLE public.user_permission;

CREATE TABLE public.user_permission (
	user_id varchar(255) NULL,
	permission_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	institute_id varchar(255) NULL,
	id varchar(255) NOT NULL,
	CONSTRAINT user_permission_pkey PRIMARY KEY (id),
	CONSTRAINT fk_permission_id_user_permission FOREIGN KEY (permission_id) REFERENCES public.permissions(id),
	CONSTRAINT fk_user_id_user_permission FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE INDEX idx_permission_resolution_user_institute ON public.user_permission USING btree (user_id, institute_id, permission_id);
CREATE INDEX idx_user_permission_created_at ON public.user_permission USING btree (created_at DESC);
CREATE INDEX idx_user_permission_institute_id ON public.user_permission USING btree (institute_id) WHERE (institute_id IS NOT NULL);
CREATE INDEX idx_user_permission_permission_id ON public.user_permission USING btree (permission_id);
CREATE INDEX idx_user_permission_user_id ON public.user_permission USING btree (user_id);
CREATE INDEX idx_user_permission_user_institute ON public.user_permission USING btree (user_id, institute_id);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.user_permission for each row execute function update_updated_on_user_task();


-- public.user_role definition

-- Drop table

-- DROP TABLE public.user_role;

CREATE TABLE public.user_role (
	user_id varchar(255) NULL,
	role_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	institute_id varchar(255) NULL,
	id varchar(255) NOT NULL,
	status varchar(255) DEFAULT 'ACTIVE'::character varying NULL,
	CONSTRAINT user_role_pk PRIMARY KEY (id),
	CONSTRAINT fk_role_id FOREIGN KEY (role_id) REFERENCES public.roles(id),
	CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_complete_role_resolution ON public.user_role USING btree (user_id, institute_id, role_id, status, created_at) WHERE ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'PENDING'::character varying])::text[]));
CREATE INDEX idx_rbac_complete_lookup ON public.user_role USING btree (user_id, role_id, institute_id, status) WHERE ((status)::text = 'ACTIVE'::text);
CREATE INDEX idx_user_role_composite_lookup ON public.user_role USING btree (user_id, role_id, institute_id);
CREATE INDEX idx_user_role_created_at ON public.user_role USING btree (created_at DESC);
CREATE INDEX idx_user_role_institute_id ON public.user_role USING btree (institute_id) WHERE (institute_id IS NOT NULL);
CREATE INDEX idx_user_role_role_id ON public.user_role USING btree (role_id);
CREATE INDEX idx_user_role_status ON public.user_role USING btree (status);
CREATE INDEX idx_user_role_user_id ON public.user_role USING btree (user_id);
CREATE INDEX idx_user_role_user_institute ON public.user_role USING btree (user_id, institute_id, status);
CREATE INDEX idx_user_role_user_status ON public.user_role USING btree (user_id, status);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.user_role for each row execute function update_updated_on_user_task();