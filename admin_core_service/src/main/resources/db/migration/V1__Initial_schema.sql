-- public.assessments definition

-- Drop table

-- DROP TABLE public.assessments;

CREATE TABLE public.assessments (
	id varchar(255) NOT NULL,
	title varchar(255) NULL,
	description varchar(255) NULL,
	rules_markdown text NULL,
	created_at timestamp NULL,
	updated_at timestamp NULL,
	CONSTRAINT pk_assessment_id PRIMARY KEY (id)
);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.assessments for each row execute function update_updated_on_user_task();


-- public.chapter definition

-- Drop table

-- DROP TABLE public.chapter;

CREATE TABLE public.chapter (
	id varchar(255) NOT NULL,
	chapter_name varchar(255) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(255) NULL,
	file_id varchar(255) NULL,
	description text NULL,
	parent_id varchar(255) NULL,
	created_by_user_id varchar(255) NULL,
	CONSTRAINT chapter_pk PRIMARY KEY (id)
);
CREATE INDEX idx_chapter_created_at ON public.chapter USING btree (created_at DESC);
CREATE INDEX idx_chapter_status ON public.chapter USING btree (status) WHERE ((status)::text <> 'DELETED'::text);

-- Table Triggers

create trigger trg_trim_lowercase_chapter_name before
insert
    or
update
    on
    public.chapter for each row execute function trim_and_lowercase_column('chapter_name');


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


-- public.coupon_code definition

-- Drop table

-- DROP TABLE public.coupon_code;

CREATE TABLE public.coupon_code (
	id varchar(255) NOT NULL,
	code varchar(255) NOT NULL,
	status varchar(255) NULL,
	source_type varchar(255) NULL,
	source_id varchar(255) NULL,
	is_email_restricted bool DEFAULT false NULL,
	allowed_email_ids text NULL,
	tag varchar(255) NULL,
	generation_date date NULL,
	redeem_start_date date NULL,
	redeem_end_date date NULL,
	usage_limit int8 NULL,
	can_be_added bool DEFAULT false NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT coupon_code_code_key UNIQUE (code),
	CONSTRAINT coupon_code_pkey PRIMARY KEY (id)
);


-- public.course_structure_changes_log definition

-- Drop table

-- DROP TABLE public.course_structure_changes_log;

CREATE TABLE public.course_structure_changes_log (
	id varchar(255) NOT NULL,
	user_id varchar(255) NULL,
	source_id varchar(255) NULL,
	source_type varchar(100) NULL,
	parent_id varchar(255) NULL,
	json_data text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(50) NULL,
	CONSTRAINT course_structure_changes_log_pkey PRIMARY KEY (id)
);


-- public.custom_fields definition

-- Drop table

-- DROP TABLE public.custom_fields;

CREATE TABLE public.custom_fields (
	id varchar(36) NOT NULL,
	field_key varchar(100) NOT NULL,
	field_name varchar(255) NOT NULL,
	field_type varchar(50) NOT NULL,
	default_value text NULL,
	config text NULL,
	form_order int4 DEFAULT 0 NULL,
	is_mandatory bool DEFAULT false NULL,
	is_filter bool DEFAULT false NULL,
	is_sortable bool DEFAULT false NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT now() NULL,
	CONSTRAINT custom_fields_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_custom_fields_key ON public.custom_fields USING btree (field_key);
CREATE INDEX idx_custom_fields_type ON public.custom_fields USING btree (field_type);


-- public.document_slide definition

-- Drop table

-- DROP TABLE public.document_slide;

CREATE TABLE public.document_slide (
	id varchar(255) NOT NULL,
	"type" varchar(255) NULL,
	"data" text NULL,
	title varchar(255) NULL,
	cover_file_id varchar(255) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	total_pages int4 NULL,
	published_data text NULL,
	published_document_total_pages int4 NULL,
	CONSTRAINT document_pk PRIMARY KEY (id)
);
CREATE INDEX idx_document_slide_type_pages ON public.document_slide USING btree (type, published_document_total_pages);


-- public.doubts definition

-- Drop table

-- DROP TABLE public.doubts;

CREATE TABLE public.doubts (
	id varchar(255) NOT NULL,
	user_id varchar(255) NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	raised_time timestamptz NULL,
	resolved_time timestamptz NULL,
	content_position varchar(255) NULL,
	content_type varchar(255) NULL,
	html_text text NULL,
	status varchar(255) NULL,
	parent_id varchar(255) NULL,
	parent_level int4 DEFAULT 0 NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	package_session_id varchar(255) NULL,
	CONSTRAINT doubts_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_doubts_status ON public.doubts USING btree (status) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_doubts_user_id ON public.doubts USING btree (user_id, created_at DESC) WHERE ((status)::text <> 'DELETED'::text);


-- public.embeddings definition

-- Drop table

-- DROP TABLE public.embeddings;

CREATE TABLE public.embeddings (
	id varchar(255) NOT NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	embedding public.vector NULL,
	created_at timestamp NULL,
	updated_at timestamp NULL,
	CONSTRAINT embeddings_pkey PRIMARY KEY (id)
);


-- public.enroll_invite definition

-- Drop table

-- DROP TABLE public.enroll_invite;

CREATE TABLE public.enroll_invite (
	id varchar(255) NOT NULL,
	"name" varchar(255) NULL,
	end_date date NULL,
	start_date date NULL,
	invite_code varchar(255) NULL,
	status varchar(255) NULL,
	institute_id varchar(255) NULL,
	vendor varchar(255) NULL,
	vendor_id varchar(255) NULL,
	currency varchar(255) NULL,
	tag varchar(255) NULL,
	web_page_meta_data_json text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	learner_access_days int4 NULL,
	CONSTRAINT enroll_invite_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_enroll_invite_status ON public.enroll_invite USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


-- public.folders definition

-- Drop table

-- DROP TABLE public.folders;

CREATE TABLE public.folders (
	id varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	status varchar(50) NULL,
	user_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT folders_pkey PRIMARY KEY (id)
);


-- public.institute_domain_routing definition

-- Drop table

-- DROP TABLE public.institute_domain_routing;

CREATE TABLE public.institute_domain_routing (
	id varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	subdomain varchar(255) NOT NULL,
	"role" varchar(100) NOT NULL,
	institute_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT now() NULL,
	updated_at timestamp DEFAULT now() NULL,
	redirect varchar(255) DEFAULT '/login'::character varying NULL,
	CONSTRAINT institute_domain_routing_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_idr_domain ON public.institute_domain_routing USING btree (lower((domain)::text));
CREATE INDEX idx_idr_domain_subdomain ON public.institute_domain_routing USING btree (lower((domain)::text), subdomain);
CREATE INDEX idx_idr_institute_id ON public.institute_domain_routing USING btree (institute_id);


-- public.institute_payment_gateway_mapping definition

-- Drop table

-- DROP TABLE public.institute_payment_gateway_mapping;

CREATE TABLE public.institute_payment_gateway_mapping (
	id varchar(36) NOT NULL,
	vendor varchar(100) NOT NULL,
	institute_id varchar(36) NOT NULL,
	payment_gateway_specific_data text NULL,
	status varchar(50) DEFAULT 'ACTIVE'::character varying NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT institute_payment_gateway_mapping_pkey PRIMARY KEY (id)
);


-- public.institute_submodule_mapping definition

-- Drop table

-- DROP TABLE public.institute_submodule_mapping;

CREATE TABLE public.institute_submodule_mapping (
	institute_id varchar(255) NULL,
	submodule_id varchar(255) NULL,
	id varchar(255) NOT NULL,
	CONSTRAINT pk_institute_submodule_mapping PRIMARY KEY (id)
);


-- public.institutes definition

-- Drop table

-- DROP TABLE public.institutes;

CREATE TABLE public.institutes (
	id varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	address_line varchar(255) NULL,
	pin_code varchar(255) NULL,
	mobile_number varchar(255) NULL,
	logo_file_id varchar(255) NULL,
	"language" varchar(255) NULL,
	institute_theme_code varchar(255) NULL,
	website_url varchar(255) NULL,
	description text NULL,
	founded_date date NULL,
	"type" varchar(255) NULL,
	held varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	country varchar(255) NULL,
	state varchar(255) NULL,
	city varchar(255) NULL,
	email varchar(255) NULL,
	letterhead_file_id varchar(255) NULL,
	cover_media_id varchar(511) NULL,
	subdomain text NULL,
	cover_image_file_id varchar(255) NULL,
	cover_text_json text NULL,
	setting_json text NULL,
	learner_portal_base_url varchar(255) DEFAULT 'learner.vacademy.io'::character varying NULL,
	teacher_portal_base_url varchar(255) DEFAULT 'teacher.vacademy.io'::character varying NULL,
	admin_portal_base_url varchar(255) DEFAULT 'dash.vacademy.io'::character varying NULL,
	CONSTRAINT pk_institute_id PRIMARY KEY (id)
);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.institutes for each row execute function update_updated_on_user_task();


-- public.learner_invitation definition

-- Drop table

-- DROP TABLE public.learner_invitation;

CREATE TABLE public.learner_invitation (
	id varchar(255) NOT NULL,
	"name" varchar(255) NULL,
	status varchar(255) NULL,
	date_generated date NULL,
	expiry_date date NULL,
	institute_id varchar(255) NULL,
	invite_code varchar(255) NULL,
	batch_options_json text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	CONSTRAINT learner_invitation_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_learner_invitation_status ON public.learner_invitation USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


-- public.learner_operation definition

-- Drop table

-- DROP TABLE public.learner_operation;

CREATE TABLE public.learner_operation (
	id varchar(255) NOT NULL,
	user_id varchar(255) NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	operation varchar(255) NULL,
	value varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT learner_operation_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_learner_operation_source_id_operation ON public.learner_operation USING btree (source_id, operation) WHERE ((operation)::text = ANY ((ARRAY['PERCENTAGE_COMPLETED'::character varying, 'PERCENTAGE_CHAPTER_COMPLETED'::character varying])::text[]));
CREATE INDEX idx_learner_operation_user_id_source ON public.learner_operation USING btree (user_id, source, source_id);
CREATE INDEX idx_learner_operation_user_operation ON public.learner_operation USING btree (user_id, operation, source);
CREATE INDEX idx_learner_progress_lookup ON public.learner_operation USING btree (user_id, operation, source_id, value) WHERE ((operation)::text = ANY ((ARRAY['PERCENTAGE_COMPLETED'::character varying, 'PERCENTAGE_CHAPTER_COMPLETED'::character varying])::text[]));


-- public."level" definition

-- Drop table

-- DROP TABLE public."level";

CREATE TABLE public."level" (
	id varchar(255) NOT NULL,
	level_name varchar(255) NULL,
	duration_in_days int4 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	status varchar(255) NULL,
	thumbnail_file_id varchar(255) NULL,
	CONSTRAINT pk_level_id PRIMARY KEY (id)
);
CREATE INDEX idx_level_name ON public.level USING btree (level_name) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_level_status ON public.level USING btree (status) WHERE ((status)::text <> 'DELETED'::text);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.level for each row execute function update_updated_on_user_task();
create trigger trg_trim_lowercase_level_name before
insert
    or
update
    on
    public.level for each row execute function trim_and_lowercase_column('level_name');


-- public.live_session definition

-- Drop table

-- DROP TABLE public.live_session;

CREATE TABLE public.live_session (
	id varchar(255) DEFAULT gen_random_uuid() NOT NULL,
	start_time timestamp NULL,
	last_entry_time timestamp NULL,
	access_level varchar(20) NULL,
	meeting_type varchar(20) NULL,
	default_meet_link text NULL,
	waiting_room_link text NULL,
	registration_form_link_for_public_sessions text NULL,
	created_by_user_id varchar(255) NOT NULL,
	title varchar(255) NULL,
	description_html text NULL,
	notification_email_message text NULL,
	attendance_email_message text NULL,
	cover_file_id text NULL,
	subject varchar(255) NULL,
	status varchar(20) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT now() NULL,
	link_type varchar(255) NULL,
	institute_id varchar(255) NULL,
	waiting_room_time int4 NULL,
	thumbnail_file_id varchar(255) NULL,
	background_score_file_id varchar(255) NULL,
	allow_rewind bool NULL,
	session_streaming_service_type varchar(255) NULL,
	allow_play_pause bool NULL,
	CONSTRAINT sessions_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_live_session_access_level ON public.live_session USING btree (access_level);
CREATE INDEX idx_live_session_created_at ON public.live_session USING btree (created_at DESC);
CREATE INDEX idx_live_session_institute_id_status ON public.live_session USING btree (institute_id, status);
CREATE INDEX idx_live_session_status ON public.live_session USING btree (status) WHERE ((status)::text = ANY ((ARRAY['LIVE'::character varying, 'DRAFT'::character varying])::text[]));


-- public.modules definition

-- Drop table

-- DROP TABLE public.modules;

CREATE TABLE public.modules (
	id varchar(255) NOT NULL,
	module_name varchar(255) NULL,
	status varchar(255) NULL,
	description varchar(255) NULL,
	thumbnail_id varchar(255) NULL,
	parent_id varchar(255) NULL,
	created_by_user_id varchar(255) NULL,
	CONSTRAINT modules_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_modules_status ON public.modules USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


-- public.node_dedupe_record definition

-- Drop table

-- DROP TABLE public.node_dedupe_record;

CREATE TABLE public.node_dedupe_record (
	id varchar NOT NULL,
	workflow_id varchar NOT NULL,
	node_template_id varchar NOT NULL,
	workflow_id_scope varchar NULL,
	schedule_run_id varchar NULL,
	operation_key varchar NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT node_dedupe_record_node_template_id_operation_key_schedule__key UNIQUE (node_template_id, operation_key, schedule_run_id),
	CONSTRAINT node_dedupe_record_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_dedupe_template_key_sr ON public.node_dedupe_record USING btree (node_template_id, operation_key, schedule_run_id);
CREATE INDEX idx_dedupe_wf_sr ON public.node_dedupe_record USING btree (workflow_id, schedule_run_id);


-- public.node_template definition

-- Drop table

-- DROP TABLE public.node_template;

CREATE TABLE public.node_template (
	id varchar NOT NULL,
	institute_id varchar NOT NULL,
	node_name varchar NOT NULL,
	node_type varchar NOT NULL,
	status varchar DEFAULT 'ACTIVE'::character varying NOT NULL,
	config_json text NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"version" int4 DEFAULT 1 NULL,
	CONSTRAINT node_template_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_node_template_inst_status ON public.node_template USING btree (institute_id, status);
CREATE INDEX idx_node_template_name ON public.node_template USING btree (institute_id, node_name);


-- public.notification_setting definition

-- Drop table

-- DROP TABLE public.notification_setting;

CREATE TABLE public.notification_setting (
	id varchar(64) NOT NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	comma_separated_communication_types text NULL,
	status varchar(50) NULL,
	comma_separated_email_ids text NULL,
	comma_separated_mobile_numbers text NULL,
	comma_separated_roles text NULL,
	monthly bool NULL,
	weekly bool NULL,
	daily bool NULL,
	"type" varchar(100) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT notification_setting_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_notification_setting_source ON public.notification_setting USING btree (source, source_id, status);
CREATE INDEX idx_notification_setting_type ON public.notification_setting USING btree (type, status);


-- public.package definition

-- Drop table

-- DROP TABLE public.package;

CREATE TABLE public.package (
	id varchar(255) NOT NULL,
	package_name varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	thumbnail_file_id varchar(255) NULL,
	status varchar(50) NOT NULL,
	is_course_published_to_catalaouge bool NULL,
	course_preview_image_media_id varchar(255) NULL,
	course_banner_media_id varchar(255) NULL,
	course_media_id varchar(255) NULL,
	why_learn text NULL,
	who_should_learn text NULL,
	about_the_course text NULL,
	comma_separated_tags text NULL,
	course_depth int4 NULL,
	course_html_description text NULL,
	original_course_id varchar(255) NULL,
	created_by_user_id varchar(255) NULL,
	version_number int4 DEFAULT 1 NULL,
	CONSTRAINT pk_package_id PRIMARY KEY (id)
);
CREATE INDEX idx_package_complete_lookup ON public.package USING btree (status, is_course_published_to_catalaouge, created_at DESC) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_package_name_search ON public.package USING gin (to_tsvector('english'::regconfig, (package_name)::text)) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_package_status_published ON public.package USING btree (status, is_course_published_to_catalaouge) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_package_tags_gin ON public.package USING gin (string_to_array(comma_separated_tags, ','::text)) WHERE (comma_separated_tags IS NOT NULL);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.package for each row execute function update_updated_on_user_task();
create trigger trg_titlecase_package_name before
insert
    or
update
    on
    public.package for each row execute function trim_and_titlecase_package_name();


-- public.payment_option definition

-- Drop table

-- DROP TABLE public.payment_option;

CREATE TABLE public.payment_option (
	id varchar(255) NOT NULL,
	"name" varchar(255) NULL,
	status varchar(255) NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	tag varchar(255) NULL,
	"type" varchar(255) NULL,
	require_approval bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	payment_option_metadata_json text NULL,
	CONSTRAINT payment_option_pkey PRIMARY KEY (id)
);


-- public.rating definition

-- Drop table

-- DROP TABLE public.rating;

CREATE TABLE public.rating (
	id varchar NOT NULL,
	points float8 NULL,
	user_id varchar NULL,
	likes int8 NULL,
	dislikes int8 NULL,
	source_id varchar NULL,
	source_type varchar NULL,
	"text" varchar NULL,
	status varchar NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT rating_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_rating_points ON public.rating USING btree (points) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_rating_source ON public.rating USING btree (source_type, source_id, status) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_rating_user_source ON public.rating USING btree (user_id, source_type, source_id) WHERE ((status)::text <> 'DELETED'::text);


-- public.referral_option definition

-- Drop table

-- DROP TABLE public.referral_option;

CREATE TABLE public.referral_option (
	id varchar(36) DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NULL,
	"source" varchar(100) NOT NULL,
	source_id varchar(100) NULL,
	status varchar(50) NOT NULL,
	referrer_discount_json text NULL,
	referee_discount_json text NULL,
	referrer_vesting_days int4 NULL,
	tag varchar(100) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	description text NULL,
	CONSTRAINT referral_option_pkey PRIMARY KEY (id)
);


-- public.rich_text_data definition

-- Drop table

-- DROP TABLE public.rich_text_data;

CREATE TABLE public.rich_text_data (
	id varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT rich_text_data_pkey PRIMARY KEY (id)
);


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


-- public."session" definition

-- Drop table

-- DROP TABLE public."session";

CREATE TABLE public."session" (
	id varchar(255) NOT NULL,
	session_name varchar(255) NULL,
	status varchar(255) NULL,
	start_date date NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT session_pk PRIMARY KEY (id)
);
CREATE INDEX idx_session_status ON public.session USING btree (status) WHERE ((status)::text <> 'DELETED'::text);

-- Table Triggers

create trigger trg_trim_lowercase_session_name before
insert
    or
update
    on
    public.session for each row execute function trim_and_lowercase_column('session_name');


-- public.slide definition

-- Drop table

-- DROP TABLE public.slide;

CREATE TABLE public.slide (
	id varchar(255) NOT NULL,
	source_id varchar(255) NULL,
	source_type varchar(255) NULL,
	title varchar(255) NULL,
	image_file_id varchar(255) NULL,
	description text NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(255) NULL,
	last_sync_date timestamp NULL,
	parent_id varchar(255) NULL,
	created_by_user_id varchar(255) NULL,
	CONSTRAINT slide_pk PRIMARY KEY (id)
);
CREATE INDEX idx_slide_created_at ON public.slide USING btree (created_at DESC) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_slide_source_id_type ON public.slide USING btree (source_id, source_type) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_slide_status_source_type ON public.slide USING btree (status, source_type) WHERE ((status)::text <> 'DELETED'::text);


-- public.student definition

-- Drop table

-- DROP TABLE public.student;

CREATE TABLE public.student (
	id varchar(255) NOT NULL,
	username varchar(255) NULL,
	user_id varchar(255) NULL,
	email varchar(255) NULL,
	full_name varchar(255) NULL,
	address_line varchar(255) NULL,
	region varchar(255) NULL,
	city varchar(255) NULL,
	pin_code varchar(20) NULL,
	mobile_number varchar(20) NULL,
	date_of_birth date NULL,
	gender varchar(10) NULL,
	fathers_name varchar(255) NULL,
	mothers_name varchar(255) NULL,
	parents_mobile_number varchar(20) NULL,
	parents_email varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	linked_institute_name varchar(255) NULL,
	face_file_id varchar(255) NULL,
	parents_to_mother_mobile_number varchar(255) NULL,
	parents_to_mother_email varchar(20) NULL,
	CONSTRAINT student_pkey PRIMARY KEY (id),
	CONSTRAINT student_unique UNIQUE (user_id, username)
);
CREATE INDEX idx_student_created_at ON public.student USING btree (created_at DESC);
CREATE INDEX idx_student_email ON public.student USING btree (email);
CREATE INDEX idx_student_full_name_gin ON public.student USING gin (to_tsvector('english'::regconfig, (full_name)::text));
CREATE INDEX idx_student_mobile_number ON public.student USING btree (mobile_number);
CREATE INDEX idx_student_search_composite ON public.student USING gin (to_tsvector('english'::regconfig, (((full_name)::text || ' '::text) || (username)::text)));
CREATE INDEX idx_student_user_id ON public.student USING btree (user_id);
CREATE INDEX idx_student_username ON public.student USING btree (username);


-- public.subject definition

-- Drop table

-- DROP TABLE public.subject;

CREATE TABLE public.subject (
	id varchar(255) NOT NULL,
	subject_name varchar(255) NULL,
	subject_code varchar(255) NULL,
	credit int4 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	status varchar(255) NULL,
	thumbnail_id varchar(255) NULL,
	parent_id varchar(255) NULL,
	created_by_user_id varchar(255) NULL,
	CONSTRAINT pk_subject_id PRIMARY KEY (id)
);
CREATE INDEX idx_subject_status ON public.subject USING btree (status) WHERE ((status)::text <> 'DELETED'::text);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.subject for each row execute function update_updated_on_user_task();
create trigger trg_trim_lowercase_subject_name before
insert
    or
update
    on
    public.subject for each row execute function trim_and_lowercase_column('subject_name');


-- public.video definition

-- Drop table

-- DROP TABLE public.video;

CREATE TABLE public.video (
	id varchar(255) NOT NULL,
	description varchar(255) NULL,
	title varchar(255) NULL,
	url varchar(255) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	video_length int8 NULL,
	published_url varchar(255) NULL,
	published_video_length int4 NULL,
	source_type varchar(255) NULL,
	embedded_type varchar(255) NULL,
	embedded_data text NULL,
	CONSTRAINT video_pk PRIMARY KEY (id)
);
CREATE INDEX idx_video_slide_published_length ON public.video USING btree (published_video_length) WHERE (published_video_length IS NOT NULL);


-- public.web_hook definition

-- Drop table

-- DROP TABLE public.web_hook;

CREATE TABLE public.web_hook (
	id varchar(255) NOT NULL,
	event_type varchar(255) NULL,
	vendor varchar(255) NOT NULL,
	payload text NOT NULL,
	status varchar(50) NOT NULL,
	order_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	processed_at timestamp NULL,
	error_message text NULL,
	CONSTRAINT web_hook_pkey PRIMARY KEY (id)
);


-- public.workflow definition

-- Drop table

-- DROP TABLE public.workflow;

CREATE TABLE public.workflow (
	id varchar NOT NULL,
	"name" varchar NOT NULL,
	description text NULL,
	status varchar DEFAULT 'ACTIVE'::character varying NOT NULL,
	workflow_type varchar NOT NULL,
	created_by_user_id varchar NOT NULL,
	institute_id varchar NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT workflow_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_workflow_institute_status ON public.workflow USING btree (institute_id, status, workflow_type);


-- public.activity_log definition

-- Drop table

-- DROP TABLE public.activity_log;

CREATE TABLE public.activity_log (
	id varchar(255) NOT NULL,
	source_id varchar(255) NULL,
	source_type varchar(255) NULL,
	start_time timestamp NULL,
	end_time timestamp NULL,
	user_id varchar(255) NULL,
	slide_id varchar(255) NULL,
	percentage_watched numeric NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT activity_log_pkey PRIMARY KEY (id),
	CONSTRAINT activity_log_slide_id_fkey FOREIGN KEY (slide_id) REFERENCES public.slide(id)
);
CREATE INDEX idx_activity_log_slide_id_user_id ON public.activity_log USING btree (slide_id, user_id);
CREATE INDEX idx_activity_log_source_type_source_id ON public.activity_log USING btree (source_type, source_id);
CREATE INDEX idx_activity_log_time_range ON public.activity_log USING btree (start_time, end_time);
CREATE INDEX idx_activity_log_user_id_created_at ON public.activity_log USING btree (user_id, created_at DESC);


-- public.applied_coupon_discount definition

-- Drop table

-- DROP TABLE public.applied_coupon_discount;

CREATE TABLE public.applied_coupon_discount (
	id varchar(255) NOT NULL,
	"name" varchar(255) NULL,
	discount_type varchar(255) NULL,
	media_ids text NULL,
	status varchar(255) NULL,
	validity_in_days int4 NULL,
	discount_source varchar(255) NULL,
	currency varchar(255) NULL,
	max_discount_point float8 NULL,
	discount_point float8 NULL,
	max_applicable_times int4 NULL,
	redeem_start_date date NULL,
	redeem_end_date date NULL,
	coupon_code_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT applied_coupon_discount_pkey PRIMARY KEY (id),
	CONSTRAINT applied_coupon_discount_coupon_code_id_fkey FOREIGN KEY (coupon_code_id) REFERENCES public.coupon_code(id)
);


-- public.assignment_slide definition

-- Drop table

-- DROP TABLE public.assignment_slide;

CREATE TABLE public.assignment_slide (
	id varchar(255) NOT NULL,
	parent_rich_text_id varchar(255) NULL,
	text_id varchar(255) NULL,
	live_date timestamp NULL,
	end_date timestamp NULL,
	re_attempt_count int4 NULL,
	comma_separated_media_ids varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT assignment_slide_pkey PRIMARY KEY (id),
	CONSTRAINT fk_parent_rich_text FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL,
	CONSTRAINT fk_text_data FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL
);


-- public.assignment_slide_question definition

-- Drop table

-- DROP TABLE public.assignment_slide_question;

CREATE TABLE public.assignment_slide_question (
	id varchar(255) NOT NULL,
	assignment_slide_id varchar(255) NULL,
	question_order int4 NULL,
	status varchar(50) NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	text_id varchar NULL,
	CONSTRAINT assignment_slide_question_pkey PRIMARY KEY (id),
	CONSTRAINT fk_assignment_slide FOREIGN KEY (assignment_slide_id) REFERENCES public.assignment_slide(id)
);
CREATE INDEX idx_assignment_slide_question_assignment_id ON public.assignment_slide_question USING btree (assignment_slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


-- public.assignment_slide_tracked definition

-- Drop table

-- DROP TABLE public.assignment_slide_tracked;

CREATE TABLE public.assignment_slide_tracked (
	id varchar(255) NOT NULL,
	comma_separated_file_ids text NULL,
	activity_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT assignment_slide_tracked_pkey PRIMARY KEY (id),
	CONSTRAINT fk_assignment_activity_log FOREIGN KEY (activity_id) REFERENCES public.activity_log(id) ON DELETE CASCADE
);
CREATE INDEX idx_assignment_slide_tracked_activity_id ON public.assignment_slide_tracked USING btree (activity_id);


-- public.chapter_to_slides definition

-- Drop table

-- DROP TABLE public.chapter_to_slides;

CREATE TABLE public.chapter_to_slides (
	id varchar(255) NOT NULL,
	chapter_id varchar(255) NULL,
	slide_id varchar(255) NULL,
	slide_order int4 NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(255) NULL,
	CONSTRAINT chapter_to_slides_pk PRIMARY KEY (id),
	CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id) ON DELETE CASCADE,
	CONSTRAINT fk_slide FOREIGN KEY (slide_id) REFERENCES public.slide(id) ON DELETE CASCADE
);
CREATE INDEX idx_chapter_to_slides_chapter_id ON public.chapter_to_slides USING btree (chapter_id, status) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_chapter_to_slides_slide_id ON public.chapter_to_slides USING btree (slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


-- public.concentration_score definition

-- Drop table

-- DROP TABLE public.concentration_score;

CREATE TABLE public.concentration_score (
	id varchar(255) NOT NULL,
	concentration_score float8 NOT NULL,
	tab_switch_count int4 NOT NULL,
	pause_count int4 NOT NULL,
	answer_times_in_sec _int4 NULL,
	activity_id varchar(255) NOT NULL,
	CONSTRAINT concentration_score_pkey PRIMARY KEY (id),
	CONSTRAINT fk_activity FOREIGN KEY (activity_id) REFERENCES public.activity_log(id)
);
CREATE INDEX idx_concentration_score_activity_id ON public.concentration_score USING btree (activity_id);


-- public.custom_field_values definition

-- Drop table

-- DROP TABLE public.custom_field_values;

CREATE TABLE public.custom_field_values (
	id varchar(255) NOT NULL,
	custom_field_id varchar(255) NOT NULL,
	source_type varchar(255) NOT NULL,
	source_id varchar(255) NOT NULL,
	"type" varchar(255) NULL,
	type_id varchar(255) NULL,
	value text NULL,
	CONSTRAINT custom_field_values_pkey PRIMARY KEY (id),
	CONSTRAINT custom_field_values_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE
);


-- public.document_tracked definition

-- Drop table

-- DROP TABLE public.document_tracked;

CREATE TABLE public.document_tracked (
	id varchar(255) NOT NULL,
	activity_id varchar(255) NULL,
	start_time timestamp NULL,
	end_time timestamp NULL,
	page_number int4 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT document_tracked_pkey PRIMARY KEY (id),
	CONSTRAINT document_tracked_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity_log(id) ON DELETE CASCADE
);
CREATE INDEX idx_document_tracked_activity_id ON public.document_tracked USING btree (activity_id);
CREATE INDEX idx_document_tracked_page_number ON public.document_tracked USING btree (activity_id, page_number);


-- public.documents definition

-- Drop table

-- DROP TABLE public.documents;

CREATE TABLE public.documents (
	id varchar(255) NOT NULL,
	file_id varchar(255) NOT NULL,
	folder_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	status varchar(50) NOT NULL,
	access_type varchar(50) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT documents_pkey PRIMARY KEY (id),
	CONSTRAINT fk_folder FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE
);


-- public.doubt_assignee definition

-- Drop table

-- DROP TABLE public.doubt_assignee;

CREATE TABLE public.doubt_assignee (
	id varchar(255) NOT NULL,
	doubt_id varchar(255) NULL,
	source_id varchar(255) NULL,
	"source" varchar(255) NULL,
	status varchar(255) NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT doubt_assignee_pkey PRIMARY KEY (id),
	CONSTRAINT fk_doubt FOREIGN KEY (doubt_id) REFERENCES public.doubts(id)
);
CREATE INDEX idx_doubt_assignee_doubt_id ON public.doubt_assignee USING btree (doubt_id, status) WHERE ((status)::text <> 'DELETED'::text);


-- public."groups" definition

-- Drop table

-- DROP TABLE public."groups";

CREATE TABLE public."groups" (
	id varchar(255) NOT NULL,
	group_name varchar(255) NULL,
	parent_group_id varchar(255) NULL,
	is_root bool NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	group_value varchar NULL,
	CONSTRAINT pk_group_id PRIMARY KEY (id),
	CONSTRAINT fk_parent_group_id FOREIGN KEY (parent_group_id) REFERENCES public."groups"(id)
);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.groups for each row execute function update_updated_on_user_task();


-- public.institute_custom_fields definition

-- Drop table

-- DROP TABLE public.institute_custom_fields;

CREATE TABLE public.institute_custom_fields (
	id varchar(255) NOT NULL,
	institute_id varchar(36) NOT NULL,
	custom_field_id varchar(36) NOT NULL,
	"type" varchar(50) NOT NULL,
	type_id varchar(36) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(50) DEFAULT 'ACTIVE'::character varying NULL,
	group_name varchar(255) NULL,
	CONSTRAINT institute_custom_fields_pkey PRIMARY KEY (id),
	CONSTRAINT fk_custom_field_id FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE
);


-- public.institute_metadata definition

-- Drop table

-- DROP TABLE public.institute_metadata;

CREATE TABLE public.institute_metadata (
	id varchar(255) NOT NULL,
	institute_id varchar(255) NULL,
	source_key varchar(255) NULL,
	source_key_string varchar(255) NULL,
	source_value varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT pk_metadata_id PRIMARY KEY (id),
	CONSTRAINT fk_institute_id FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.institute_metadata for each row execute function update_updated_on_user_task();


-- public.learner_invitation_custom_field definition

-- Drop table

-- DROP TABLE public.learner_invitation_custom_field;

CREATE TABLE public.learner_invitation_custom_field (
	id varchar(255) NOT NULL,
	field_name varchar(255) NULL,
	field_type varchar(100) NULL,
	comma_separated_options text NULL,
	is_mandatory bool NULL,
	description text NULL,
	default_value varchar(255) NULL,
	learner_invitation_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
	field_order int4 NULL,
	CONSTRAINT learner_invitation_custom_field_pkey PRIMARY KEY (id),
	CONSTRAINT learner_invitation_custom_field_learner_invitation_id_fkey FOREIGN KEY (learner_invitation_id) REFERENCES public.learner_invitation(id) ON DELETE CASCADE
);


-- public.learner_invitation_response definition

-- Drop table

-- DROP TABLE public.learner_invitation_response;

CREATE TABLE public.learner_invitation_response (
	id varchar(255) NOT NULL,
	learner_invitation_id varchar(255) NOT NULL,
	institute_id varchar(255) NOT NULL,
	status varchar(255) NOT NULL,
	full_name varchar(255) NULL,
	email varchar(255) NULL,
	contact_number varchar(20) NULL,
	batch_options_json text NULL,
	message_by_institute text NULL,
	batch_selection_json text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	recorded_on date DEFAULT CURRENT_DATE NULL,
	CONSTRAINT learner_invitation_response_pkey PRIMARY KEY (id),
	CONSTRAINT learner_invitation_response_learner_invitation_id_fkey FOREIGN KEY (learner_invitation_id) REFERENCES public.learner_invitation(id) ON DELETE CASCADE
);


-- public.live_session_participants definition

-- Drop table

-- DROP TABLE public.live_session_participants;

CREATE TABLE public.live_session_participants (
	id varchar(255) DEFAULT gen_random_uuid() NOT NULL,
	session_id varchar(255) NOT NULL,
	source_type varchar(20) NOT NULL,
	source_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT now() NULL,
	CONSTRAINT live_session_participants_pkey PRIMARY KEY (id),
	CONSTRAINT fk_live_session_participants FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE
);
CREATE INDEX idx_live_session_participants_session ON public.live_session_participants USING btree (session_id, source_type, source_id);
CREATE INDEX idx_live_session_participants_source ON public.live_session_participants USING btree (source_type, source_id);


-- public.module_chapter_mapping definition

-- Drop table

-- DROP TABLE public.module_chapter_mapping;

CREATE TABLE public.module_chapter_mapping (
	id varchar NOT NULL,
	chapter_id varchar NOT NULL,
	module_id varchar NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT module_chapter_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id),
	CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id)
);
CREATE INDEX idx_module_chapter_mapping ON public.module_chapter_mapping USING btree (module_id, chapter_id);


-- public.package_group_mapping definition

-- Drop table

-- DROP TABLE public.package_group_mapping;

CREATE TABLE public.package_group_mapping (
	id varchar(255) NOT NULL,
	group_id varchar(255) NOT NULL,
	package_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT package_group_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT package_group_mapping_group_id_fkey FOREIGN KEY (group_id) REFERENCES public."groups"(id),
	CONSTRAINT package_group_mapping_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.package(id)
);


-- public.package_institute definition

-- Drop table

-- DROP TABLE public.package_institute;

CREATE TABLE public.package_institute (
	package_id varchar(255) NULL,
	group_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	institute_id varchar NOT NULL,
	id varchar NOT NULL,
	CONSTRAINT package_institute_pk PRIMARY KEY (id),
	CONSTRAINT fk_group_id FOREIGN KEY (group_id) REFERENCES public."groups"(id),
	CONSTRAINT fk_package_id FOREIGN KEY (package_id) REFERENCES public.package(id),
	CONSTRAINT package_institute_institutes_fk FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
);
CREATE INDEX idx_package_institute_complete_lookup ON public.package_institute USING btree (institute_id, package_id, group_id);
CREATE INDEX idx_package_institute_group_id ON public.package_institute USING btree (group_id) WHERE (group_id IS NOT NULL);
CREATE INDEX idx_package_institute_institute_id ON public.package_institute USING btree (institute_id);
CREATE INDEX idx_package_institute_mapping ON public.package_institute USING btree (package_id, institute_id);
CREATE INDEX idx_package_institute_package_id ON public.package_institute USING btree (package_id);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.package_institute for each row execute function update_updated_on_user_task();


-- public.package_session definition

-- Drop table

-- DROP TABLE public.package_session;

CREATE TABLE public.package_session (
	id varchar(255) NOT NULL,
	level_id varchar(255) NULL,
	session_id varchar(255) NULL,
	start_time date NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	status varchar(255) NULL,
	package_id varchar(255) NULL,
	group_id varchar(255) NULL,
	CONSTRAINT pk_session_id PRIMARY KEY (id),
	CONSTRAINT fk_group_id FOREIGN KEY (group_id) REFERENCES public."groups"(id),
	CONSTRAINT fk_level_id FOREIGN KEY (level_id) REFERENCES public."level"(id),
	CONSTRAINT package_session_session_fk FOREIGN KEY (session_id) REFERENCES public."session"(id),
	CONSTRAINT session_package_fk FOREIGN KEY (package_id) REFERENCES public.package(id)
);
CREATE INDEX idx_package_session_package_id_status ON public.package_session USING btree (package_id, status) WHERE ((status)::text <> 'DELETED'::text);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.package_session for each row execute function update_updated_on_user_task();


-- public.package_session_learner_invitation_to_payment_option definition

-- Drop table

-- DROP TABLE public.package_session_learner_invitation_to_payment_option;

CREATE TABLE public.package_session_learner_invitation_to_payment_option (
	id varchar(255) NOT NULL,
	enroll_invite_id varchar(255) NULL,
	package_session_id varchar(255) NULL,
	payment_option_id varchar(255) NULL,
	status varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT package_session_learner_invitation_to_payment_option_pkey PRIMARY KEY (id),
	CONSTRAINT fk_payment_option FOREIGN KEY (payment_option_id) REFERENCES public.payment_option(id),
	CONSTRAINT package_session_learner_invitation_to_p_package_session_id_fkey FOREIGN KEY (package_session_id) REFERENCES public.package_session(id),
	CONSTRAINT package_session_learner_invitation_to_pay_enroll_invite_id_fkey FOREIGN KEY (enroll_invite_id) REFERENCES public.enroll_invite(id)
);


-- public.payment_plan definition

-- Drop table

-- DROP TABLE public.payment_plan;

CREATE TABLE public.payment_plan (
	id varchar(255) NOT NULL,
	"name" varchar(255) NULL,
	status varchar(255) NULL,
	validity_in_days int4 NULL,
	actual_price float8 NULL,
	elevated_price float8 NULL,
	currency varchar(255) NULL,
	description text NULL,
	tag varchar(255) NULL,
	feature_json text NULL,
	payment_option_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT payment_plan_pkey PRIMARY KEY (id),
	CONSTRAINT payment_plan_payment_option_id_fkey FOREIGN KEY (payment_option_id) REFERENCES public.payment_option(id)
);
CREATE INDEX idx_payment_plan_status ON public.payment_plan USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


-- public.question_slide definition

-- Drop table

-- DROP TABLE public.question_slide;

CREATE TABLE public.question_slide (
	id varchar(255) NOT NULL,
	text_id varchar(50) NOT NULL,
	media_id varchar(999) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	question_response_type varchar(50) NOT NULL,
	question_type varchar(50) NOT NULL,
	access_level varchar(50) NOT NULL,
	auto_evaluation_json text NULL,
	evaluation_type varchar(50) NULL,
	explanation_text_id varchar(50) NULL,
	default_question_time_mins int4 NULL,
	parent_rich_text_id varchar(255) NULL,
	points int4 NULL,
	re_attempt_count int4 NULL,
	source_type varchar(255) NULL,
	CONSTRAINT question_pkey PRIMARY KEY (id),
	CONSTRAINT fk_question_slide_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL,
	CONSTRAINT fk_question_slide_parent_rich_text_id FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL,
	CONSTRAINT fk_question_slide_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL
);


-- public.question_slide_tracked definition

-- Drop table

-- DROP TABLE public.question_slide_tracked;

CREATE TABLE public.question_slide_tracked (
	id varchar(255) NOT NULL,
	attempt_number int4 NULL,
	response_json text NULL,
	response_status varchar(255) NULL,
	marks float8 NULL,
	activity_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT question_slide_tracked_pkey PRIMARY KEY (id),
	CONSTRAINT fk_activity_log FOREIGN KEY (activity_id) REFERENCES public.activity_log(id) ON DELETE CASCADE
);
CREATE INDEX idx_question_slide_tracked_activity_id ON public.question_slide_tracked USING btree (activity_id);


-- public.quiz_slide definition

-- Drop table

-- DROP TABLE public.quiz_slide;

CREATE TABLE public.quiz_slide (
	id varchar(255) NOT NULL,
	description varchar(255) NULL,
	title varchar(255) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT quiz_pk PRIMARY KEY (id),
	CONSTRAINT fk_quiz_desc_rich_text_id FOREIGN KEY (description) REFERENCES public.rich_text_data(id) ON DELETE SET NULL
);


-- public.quiz_slide_question definition

-- Drop table

-- DROP TABLE public.quiz_slide_question;

CREATE TABLE public.quiz_slide_question (
	id varchar NOT NULL,
	parent_rich_text_id varchar NULL,
	text_id varchar NULL,
	explanation_text_id varchar NULL,
	media_id varchar NULL,
	status varchar NULL,
	question_response_type varchar NOT NULL,
	question_type varchar NOT NULL,
	access_level varchar NOT NULL,
	auto_evaluation_json text NULL,
	evaluation_type varchar NULL,
	question_order int4 NULL,
	quiz_slide_id varchar NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	can_skip bool DEFAULT true NULL,
	CONSTRAINT quiz_slide_question_pkey PRIMARY KEY (id),
	CONSTRAINT fk_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT fk_parent_rich_text FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT fk_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT quiz_slide_question_quiz_slide_id_fkey FOREIGN KEY (quiz_slide_id) REFERENCES public.quiz_slide(id)
);
CREATE INDEX idx_quiz_slide_question_quiz_id ON public.quiz_slide_question USING btree (quiz_slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


-- public.quiz_slide_question_options definition

-- Drop table

-- DROP TABLE public.quiz_slide_question_options;

CREATE TABLE public.quiz_slide_question_options (
	id varchar NOT NULL,
	quiz_slide_question_id varchar NOT NULL,
	text_id varchar NULL,
	explanation_text_id varchar NULL,
	media_id varchar NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT quiz_slide_question_options_pkey PRIMARY KEY (id),
	CONSTRAINT quiz_slide_question_options_explanation_text_id_fkey FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT quiz_slide_question_options_quiz_slide_question_id_fkey FOREIGN KEY (quiz_slide_question_id) REFERENCES public.quiz_slide_question(id),
	CONSTRAINT quiz_slide_question_options_text_id_fkey FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id)
);


-- public.quiz_slide_question_tracked definition

-- Drop table

-- DROP TABLE public.quiz_slide_question_tracked;

CREATE TABLE public.quiz_slide_question_tracked (
	id varchar(255) NOT NULL,
	response_json text NULL,
	response_status varchar(255) NULL,
	question_id varchar(255) NULL,
	activity_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT quiz_slide_question_tracked_pkey PRIMARY KEY (id),
	CONSTRAINT fk_activity_id FOREIGN KEY (activity_id) REFERENCES public.activity_log(id)
);
CREATE INDEX idx_quiz_slide_question_tracked_activity_id ON public.quiz_slide_question_tracked USING btree (activity_id);


-- public.rating_action definition

-- Drop table

-- DROP TABLE public.rating_action;

CREATE TABLE public.rating_action (
	id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	rating_id varchar(255) NOT NULL,
	action_type varchar(20) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT rating_action_pkey PRIMARY KEY (id),
	CONSTRAINT uc_user_rating UNIQUE (user_id, rating_id),
	CONSTRAINT fk_rating FOREIGN KEY (rating_id) REFERENCES public.rating(id)
);


-- public.schedule_notifications definition

-- Drop table

-- DROP TABLE public.schedule_notifications;

CREATE TABLE public.schedule_notifications (
	id varchar(255) DEFAULT gen_random_uuid() NOT NULL,
	session_id varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	message text NULL,
	status varchar(20) NULL,
	channel varchar(20) NULL,
	trigger_time timestamp NULL,
	offset_minutes int4 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT now() NULL,
	CONSTRAINT schedule_notifications_pkey PRIMARY KEY (id),
	CONSTRAINT fk_schedule_notifications FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE
);


-- public.sections definition

-- Drop table

-- DROP TABLE public.sections;

CREATE TABLE public.sections (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NULL,
	"name" varchar(255) NULL,
	max_score int4 NULL,
	active bool NULL,
	rules_markdown text NULL,
	created_at timestamp NULL,
	updated_at timestamp NULL,
	duration_in_min int4 NULL,
	CONSTRAINT pk_section_id PRIMARY KEY (id),
	CONSTRAINT fk_assessment_id FOREIGN KEY (assessment_id) REFERENCES public.assessments(id)
);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.sections for each row execute function update_updated_on_user_task();


-- public.session_guest_registrations definition

-- Drop table

-- DROP TABLE public.session_guest_registrations;

CREATE TABLE public.session_guest_registrations (
	id varchar(255) NOT NULL,
	session_id varchar(255) NOT NULL,
	email varchar(255) NOT NULL,
	registered_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT session_guest_registrations_pkey PRIMARY KEY (id),
	CONSTRAINT session_guest_registrations_session_id_email_key UNIQUE (session_id, email),
	CONSTRAINT session_guest_registrations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE
);


-- public.session_schedules definition

-- Drop table

-- DROP TABLE public.session_schedules;

CREATE TABLE public.session_schedules (
	id varchar(255) DEFAULT gen_random_uuid() NOT NULL,
	session_id varchar(255) NOT NULL,
	recurrence_type varchar(20) NOT NULL,
	recurrence_key varchar(15) NULL,
	meeting_date date NULL,
	start_time time NULL,
	last_entry_time time NULL,
	custom_meeting_link text NULL,
	custom_waiting_room_media_id text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT now() NULL,
	link_type varchar(255) NULL,
	status varchar(50) NULL,
	thumbnail_file_id varchar(255) NULL,
	daily_attendance bool DEFAULT false NOT NULL,
	CONSTRAINT session_schedules_pkey PRIMARY KEY (id),
	CONSTRAINT fk_session_schedule FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE
);
CREATE INDEX idx_session_schedule_meeting_date ON public.session_schedules USING btree (meeting_date, start_time);
CREATE INDEX idx_session_schedule_session_id ON public.session_schedules USING btree (session_id);
CREATE INDEX idx_session_schedule_time_range ON public.session_schedules USING btree (meeting_date, start_time, last_entry_time);


-- public.staff definition

-- Drop table

-- DROP TABLE public.staff;

CREATE TABLE public.staff (
	user_id varchar(255) NULL,
	institute_id varchar(255) NULL,
	id varchar(255) NOT NULL,
	CONSTRAINT staff_pkey PRIMARY KEY (id),
	CONSTRAINT staff_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
);


-- public.sub_modules definition

-- Drop table

-- DROP TABLE public.sub_modules;

CREATE TABLE public.sub_modules (
	id varchar(255) NOT NULL,
	submodule_name varchar(255) NULL,
	module_id varchar(255) NULL,
	CONSTRAINT sub_modules_pkey PRIMARY KEY (id),
	CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id)
);


-- public.subject_chapter_module_and_package_session_mapping definition

-- Drop table

-- DROP TABLE public.subject_chapter_module_and_package_session_mapping;

CREATE TABLE public.subject_chapter_module_and_package_session_mapping (
	id varchar(255) NOT NULL,
	subject_id varchar(255) NOT NULL,
	chapter_id varchar(255) NULL,
	module_id varchar(255) NULL,
	institute_id varchar(255) NULL,
	package_session_id varchar(255) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT subject_chapter_module_and_package_session_mapping_pk PRIMARY KEY (id),
	CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id),
	CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id),
	CONSTRAINT fk_package_session FOREIGN KEY (package_session_id) REFERENCES public.package_session(id),
	CONSTRAINT fk_subject FOREIGN KEY (subject_id) REFERENCES public.subject(id)
);


-- public.subject_module_mapping definition

-- Drop table

-- DROP TABLE public.subject_module_mapping;

CREATE TABLE public.subject_module_mapping (
	id varchar NOT NULL,
	subject_id varchar NOT NULL,
	module_id varchar NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	module_order int4 NULL,
	CONSTRAINT subject_module_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id),
	CONSTRAINT fk_subject FOREIGN KEY (subject_id) REFERENCES public.subject(id)
);
CREATE INDEX idx_subject_module_mapping ON public.subject_module_mapping USING btree (subject_id, module_id);


-- public.subject_session definition

-- Drop table

-- DROP TABLE public.subject_session;

CREATE TABLE public.subject_session (
	subject_id varchar(255) NULL,
	session_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id varchar(255) NOT NULL,
	subject_order int4 NULL,
	CONSTRAINT subject_session_pk PRIMARY KEY (id),
	CONSTRAINT fk_group_id FOREIGN KEY (session_id) REFERENCES public.package_session(id),
	CONSTRAINT fk_subject_id FOREIGN KEY (subject_id) REFERENCES public.subject(id)
);
CREATE INDEX idx_subject_session_mapping ON public.subject_session USING btree (subject_id, session_id);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.subject_session for each row execute function update_updated_on_user_task();


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


-- public.user_institute_payment_gateway_mapping definition

-- Drop table

-- DROP TABLE public.user_institute_payment_gateway_mapping;

CREATE TABLE public.user_institute_payment_gateway_mapping (
	id varchar(36) NOT NULL,
	user_id varchar(36) NOT NULL,
	institute_payment_gateway_mapping_id varchar(36) NOT NULL,
	payment_gateway_customer_id varchar(100) NULL,
	payment_gateway_customer_data text NULL,
	status varchar(50) DEFAULT 'ACTIVE'::character varying NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT user_institute_payment_gateway_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_institute_payment_gateway_mapping FOREIGN KEY (institute_payment_gateway_mapping_id) REFERENCES public.institute_payment_gateway_mapping(id) ON DELETE CASCADE
);


-- public.user_plan definition

-- Drop table

-- DROP TABLE public.user_plan;

CREATE TABLE public.user_plan (
	id varchar(255) NOT NULL,
	user_id varchar(255) NULL,
	plan_id varchar(255) NULL,
	plan_json text NULL,
	applied_coupon_discount_id varchar(255) NULL,
	applied_coupon_discount_json text NULL,
	status varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	json_payment_details text NULL,
	enroll_invite_id varchar(255) NULL,
	payment_option_id varchar(255) NULL,
	payment_option_json text NULL,
	CONSTRAINT user_plan_pkey PRIMARY KEY (id),
	CONSTRAINT fk_user_plan_enroll_invite FOREIGN KEY (enroll_invite_id) REFERENCES public.enroll_invite(id),
	CONSTRAINT fk_user_plan_payment_option FOREIGN KEY (payment_option_id) REFERENCES public.payment_option(id),
	CONSTRAINT user_plan_applied_coupon_discount_id_fkey FOREIGN KEY (applied_coupon_discount_id) REFERENCES public.applied_coupon_discount(id)
);
CREATE INDEX idx_user_plan_user_id ON public.user_plan USING btree (user_id, status);


-- public.video_slide_question definition

-- Drop table

-- DROP TABLE public.video_slide_question;

CREATE TABLE public.video_slide_question (
	id varchar NOT NULL,
	parent_rich_text_id varchar NULL,
	text_id varchar NULL,
	explanation_text_id varchar NULL,
	media_id varchar NULL,
	status varchar NULL,
	question_response_type varchar NOT NULL,
	question_type varchar NOT NULL,
	access_level varchar NOT NULL,
	auto_evaluation_json text NULL,
	evaluation_type varchar NULL,
	question_order int4 NULL,
	question_time_in_millis int8 NULL,
	video_slide_id varchar NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	can_skip bool DEFAULT true NULL,
	CONSTRAINT video_slide_question_pkey PRIMARY KEY (id),
	CONSTRAINT fk_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT fk_parent_rich_text FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT fk_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT video_slide_question_video_slide_id_fkey FOREIGN KEY (video_slide_id) REFERENCES public.video(id)
);
CREATE INDEX idx_video_slide_question_video_id ON public.video_slide_question USING btree (video_slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


-- public.video_slide_question_options definition

-- Drop table

-- DROP TABLE public.video_slide_question_options;

CREATE TABLE public.video_slide_question_options (
	id varchar NOT NULL,
	video_slide_question_id varchar NOT NULL,
	text_id varchar NULL,
	explanation_text_id varchar NULL,
	media_id varchar NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT video_slide_question_options_pkey PRIMARY KEY (id),
	CONSTRAINT video_slide_question_options_explanation_text_id_fkey FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT video_slide_question_options_text_id_fkey FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id),
	CONSTRAINT video_slide_question_options_video_slide_question_id_fkey FOREIGN KEY (video_slide_question_id) REFERENCES public.video_slide_question(id)
);


-- public.video_slide_question_tracked definition

-- Drop table

-- DROP TABLE public.video_slide_question_tracked;

CREATE TABLE public.video_slide_question_tracked (
	id varchar NOT NULL,
	response_json text NULL,
	response_status text NULL,
	activity_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT video_slide_question_tracked_pkey PRIMARY KEY (id),
	CONSTRAINT fk_activity FOREIGN KEY (activity_id) REFERENCES public.activity_log(id)
);


-- public.video_tracked definition

-- Drop table

-- DROP TABLE public.video_tracked;

CREATE TABLE public.video_tracked (
	id varchar(255) NOT NULL,
	activity_id varchar(255) NULL,
	start_time timestamp NULL,
	end_time timestamp NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT video_tracked_pkey PRIMARY KEY (id),
	CONSTRAINT video_tracked_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity_log(id)
);
CREATE INDEX idx_video_tracked_activity_id ON public.video_tracked USING btree (activity_id);
CREATE INDEX idx_video_tracked_time_range ON public.video_tracked USING btree (start_time, end_time);


-- public.workflow_node_mapping definition

-- Drop table

-- DROP TABLE public.workflow_node_mapping;

CREATE TABLE public.workflow_node_mapping (
	id varchar NOT NULL,
	workflow_id varchar NOT NULL,
	node_template_id varchar NOT NULL,
	node_order int4 NOT NULL,
	is_start_node bool DEFAULT false NULL,
	is_end_node bool DEFAULT false NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	override_config text NULL,
	CONSTRAINT workflow_node_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT workflow_node_mapping_workflow_id_node_order_key UNIQUE (workflow_id, node_order),
	CONSTRAINT workflow_node_mapping_workflow_id_node_template_id_key UNIQUE (workflow_id, node_template_id),
	CONSTRAINT workflow_node_mapping_node_template_id_fkey FOREIGN KEY (node_template_id) REFERENCES public.node_template(id),
	CONSTRAINT workflow_node_mapping_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE
);
CREATE INDEX idx_wf_node_link_wf_order ON public.workflow_node_mapping USING btree (workflow_id, node_order);


-- public.workflow_schedule definition

-- Drop table

-- DROP TABLE public.workflow_schedule;

CREATE TABLE public.workflow_schedule (
	id varchar NOT NULL,
	workflow_id varchar NOT NULL,
	schedule_type varchar NOT NULL,
	cron_expr varchar NULL,
	interval_minutes int4 NULL,
	day_of_month int4 NULL,
	timezone varchar DEFAULT 'UTC'::character varying NOT NULL,
	start_date timestamp NOT NULL,
	end_date timestamp NULL,
	status varchar DEFAULT 'ACTIVE'::character varying NOT NULL,
	last_run_at timestamp NULL,
	next_run_at timestamp NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT chk_ws_cron_requires_expr CHECK ((((schedule_type)::text <> 'CRON'::text) OR (cron_expr IS NOT NULL))),
	CONSTRAINT chk_ws_dom_range CHECK (((day_of_month IS NULL) OR ((day_of_month >= 1) AND (day_of_month <= 31)))),
	CONSTRAINT chk_ws_interval_requires_value CHECK ((((schedule_type)::text <> 'INTERVAL'::text) OR (interval_minutes IS NOT NULL))),
	CONSTRAINT workflow_schedule_pkey PRIMARY KEY (id),
	CONSTRAINT workflow_schedule_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE
);
CREATE INDEX idx_workflow_schedule_next_run ON public.workflow_schedule USING btree (status, next_run_at);
CREATE INDEX idx_workflow_schedule_workflow_stat ON public.workflow_schedule USING btree (workflow_id, status);


-- public.workflow_schedule_run definition

-- Drop table

-- DROP TABLE public.workflow_schedule_run;

CREATE TABLE public.workflow_schedule_run (
	id varchar NOT NULL,
	schedule_id varchar NOT NULL,
	workflow_id varchar NOT NULL,
	planned_run_at timestamp NOT NULL,
	fired_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	status varchar DEFAULT 'CREATED'::character varying NOT NULL,
	dedupe_key varchar NOT NULL,
	error_message text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT workflow_schedule_run_pkey PRIMARY KEY (id),
	CONSTRAINT workflow_schedule_run_schedule_id_dedupe_key_key UNIQUE (schedule_id, dedupe_key),
	CONSTRAINT workflow_schedule_run_schedule_id_planned_run_at_key UNIQUE (schedule_id, planned_run_at),
	CONSTRAINT workflow_schedule_run_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedule(id) ON DELETE CASCADE,
	CONSTRAINT workflow_schedule_run_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE
);
CREATE INDEX idx_schedule_run_planned ON public.workflow_schedule_run USING btree (schedule_id, planned_run_at);
CREATE INDEX idx_schedule_run_status ON public.workflow_schedule_run USING btree (schedule_id, status);


-- public.chapter_package_session_mapping definition

-- Drop table

-- DROP TABLE public.chapter_package_session_mapping;

CREATE TABLE public.chapter_package_session_mapping (
	id varchar NOT NULL,
	chapter_id varchar NOT NULL,
	package_session_id varchar NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(50) NULL,
	chapter_order int4 NULL,
	CONSTRAINT chapter_package_session_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id),
	CONSTRAINT fk_package_session FOREIGN KEY (package_session_id) REFERENCES public.package_session(id)
);
CREATE INDEX idx_chapter_package_session_mapping ON public.chapter_package_session_mapping USING btree (chapter_id, package_session_id, status) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_cpsm_package_session_id ON public.chapter_package_session_mapping USING btree (package_session_id, status) WHERE ((status)::text <> 'DELETED'::text);


-- public.discount_option definition

-- Drop table

-- DROP TABLE public.discount_option;

CREATE TABLE public.discount_option (
	id varchar(255) NOT NULL,
	package_session_learner_invitation_to_payment_option_id varchar(255) NULL,
	payment_plan_id varchar(255) NULL,
	discount_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT discount_option_pkey PRIMARY KEY (id),
	CONSTRAINT discount_option_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.applied_coupon_discount(id),
	CONSTRAINT discount_option_package_session_learner_invitation_to_paym_fkey FOREIGN KEY (package_session_learner_invitation_to_payment_option_id) REFERENCES public.package_session_learner_invitation_to_payment_option(id),
	CONSTRAINT discount_option_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plan(id)
);


-- public.faculty_session_institute_group definition

-- Drop table

-- DROP TABLE public.faculty_session_institute_group;

CREATE TABLE public.faculty_session_institute_group (
	user_id varchar(255) NULL,
	session_id varchar(255) NULL,
	institute_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT fk_institute_id FOREIGN KEY (institute_id) REFERENCES public.institutes(id),
	CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES public.package_session(id)
);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.faculty_session_institute_group for each row execute function update_updated_on_user_task();


-- public.faculty_subject_package_session_mapping definition

-- Drop table

-- DROP TABLE public.faculty_subject_package_session_mapping;

CREATE TABLE public.faculty_subject_package_session_mapping (
	id varchar(255) NOT NULL,
	user_id varchar(255) NULL,
	package_session_id varchar(255) NULL,
	subject_id varchar(255) NULL,
	created_at timestamp DEFAULT now() NULL,
	updated_at timestamp DEFAULT now() NULL,
	"name" varchar(255) NULL,
	status varchar(255) NULL,
	CONSTRAINT faculty_subject_package_session_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_teacher_mapping_package_session FOREIGN KEY (package_session_id) REFERENCES public.package_session(id),
	CONSTRAINT fk_teacher_mapping_subject FOREIGN KEY (subject_id) REFERENCES public.subject(id)
);
CREATE INDEX idx_faculty_package_session_mapping ON public.faculty_subject_package_session_mapping USING btree (package_session_id, user_id, status) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_faculty_subject_id ON public.faculty_subject_package_session_mapping USING btree (subject_id, status) WHERE ((status)::text <> 'DELETED'::text);
CREATE INDEX idx_faculty_user_id_status ON public.faculty_subject_package_session_mapping USING btree (user_id, status) WHERE ((status)::text <> 'DELETED'::text);


-- public.learner_invitation_custom_field_response definition

-- Drop table

-- DROP TABLE public.learner_invitation_custom_field_response;

CREATE TABLE public.learner_invitation_custom_field_response (
	id varchar(255) NOT NULL,
	custom_field_id varchar(255) NOT NULL,
	learner_invitation_response_id varchar(255) NOT NULL,
	value text NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT learner_invitation_custom_field_response_pkey PRIMARY KEY (id),
	CONSTRAINT learner_invitation_custom_fie_learner_invitation_response__fkey FOREIGN KEY (learner_invitation_response_id) REFERENCES public.learner_invitation_response(id) ON DELETE CASCADE,
	CONSTRAINT learner_invitation_custom_field_response_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.learner_invitation_custom_field(id) ON DELETE CASCADE
);


-- public.live_session_logs definition

-- Drop table

-- DROP TABLE public.live_session_logs;

CREATE TABLE public.live_session_logs (
	id varchar(255) DEFAULT nextval('live_session_logs_id_seq'::regclass) NOT NULL,
	session_id varchar(255) NOT NULL,
	schedule_id varchar(255) NOT NULL,
	user_source_type varchar(30) NOT NULL,
	user_source_id varchar(255) NOT NULL,
	log_type varchar(30) NOT NULL,
	status varchar(20) NULL,
	details text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT now() NULL,
	CONSTRAINT live_session_logs_pkey PRIMARY KEY (id),
	CONSTRAINT fk_live_session_logs FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE,
	CONSTRAINT fk_live_session_logs_schedule_id FOREIGN KEY (schedule_id) REFERENCES public.session_schedules(id) ON DELETE CASCADE
);


-- public."option" definition

-- Drop table

-- DROP TABLE public."option";

CREATE TABLE public."option" (
	id varchar(255) NOT NULL,
	question_id varchar(255) NULL,
	text_id varchar(255) NOT NULL,
	media_id varchar(255) NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	explanation_text_id varchar(255) NULL,
	CONSTRAINT option_pkey PRIMARY KEY (id),
	CONSTRAINT fk_option_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL,
	CONSTRAINT fk_option_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL,
	CONSTRAINT fk_question_slide FOREIGN KEY (question_id) REFERENCES public.question_slide(id) ON DELETE SET NULL,
	CONSTRAINT option_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_slide(id) ON DELETE CASCADE
);


-- public.package_session_enroll_invite_payment_plan_to_referral_option definition

-- Drop table

-- DROP TABLE public.package_session_enroll_invite_payment_plan_to_referral_option;

CREATE TABLE public.package_session_enroll_invite_payment_plan_to_referral_option (
	id varchar(36) NOT NULL,
	payment_plan_id varchar(36) NOT NULL,
	referral_option_id varchar(36) NOT NULL,
	package_session_invite_payment_option_id varchar(36) NOT NULL,
	status varchar(50) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT package_session_enroll_invite_payment_plan_to_referral_opt_pkey PRIMARY KEY (id),
	CONSTRAINT fk_package_session_invite_payment_option FOREIGN KEY (package_session_invite_payment_option_id) REFERENCES public.package_session_learner_invitation_to_payment_option(id),
	CONSTRAINT fk_payment_plan FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plan(id),
	CONSTRAINT fk_referral_option FOREIGN KEY (referral_option_id) REFERENCES public.referral_option(id)
);


-- public.payment_log definition

-- Drop table

-- DROP TABLE public.payment_log;

CREATE TABLE public.payment_log (
	id varchar(255) NOT NULL,
	status varchar(255) NULL,
	payment_status varchar(255) NULL,
	user_id varchar(255) NULL,
	vendor varchar(255) NULL,
	vendor_id varchar(255) NULL,
	"date" date NULL,
	currency varchar(255) NULL,
	user_plan_id varchar(255) NULL,
	payment_amount float8 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	payment_specific_data text NULL,
	CONSTRAINT payment_log_pkey PRIMARY KEY (id),
	CONSTRAINT payment_log_user_plan_id_fkey FOREIGN KEY (user_plan_id) REFERENCES public.user_plan(id)
);
CREATE INDEX idx_payment_log_status ON public.payment_log USING btree (status);
CREATE INDEX idx_payment_log_user_id ON public.payment_log USING btree (user_id, created_at DESC);


-- public.payment_log_line_item definition

-- Drop table

-- DROP TABLE public.payment_log_line_item;

CREATE TABLE public.payment_log_line_item (
	id varchar(255) NOT NULL,
	payment_log_id varchar(255) NULL,
	"type" varchar(255) NULL,
	amount int4 NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	CONSTRAINT payment_log_line_item_pkey PRIMARY KEY (id),
	CONSTRAINT payment_log_line_item_payment_log_id_fkey FOREIGN KEY (payment_log_id) REFERENCES public.payment_log(id)
);


-- public.student_session_institute_group_mapping definition

-- Drop table

-- DROP TABLE public.student_session_institute_group_mapping;

CREATE TABLE public.student_session_institute_group_mapping (
	user_id varchar(255) NULL,
	package_session_id varchar(255) NULL,
	institute_id varchar(255) NULL,
	group_id varchar(255) NULL,
	enrolled_date date NULL,
	status varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	institute_enrollment_number varchar NULL,
	id varchar NOT NULL,
	expiry_date timestamp NULL,
	destination_package_session_id varchar(255) NULL,
	user_plan_id varchar(255) NULL,
	CONSTRAINT student_session_institute_group_mapping_pk PRIMARY KEY (id),
	CONSTRAINT uq_dest_pkg_inst_user_status UNIQUE (destination_package_session_id, package_session_id, institute_id, user_id, status),
	CONSTRAINT uq_destination_pkg_inst_status_pkg_user UNIQUE (destination_package_session_id, institute_id, status, package_session_id, user_id),
	CONSTRAINT fk_group_id FOREIGN KEY (group_id) REFERENCES public."groups"(id),
	CONSTRAINT fk_institute_id FOREIGN KEY (institute_id) REFERENCES public.institutes(id),
	CONSTRAINT fk_session_id FOREIGN KEY (package_session_id) REFERENCES public.package_session(id),
	CONSTRAINT fk_student_ssigm_user_plan_id FOREIGN KEY (user_plan_id) REFERENCES public.user_plan(id)
);
CREATE INDEX idx_ssigm_composite_lookup ON public.student_session_institute_group_mapping USING btree (user_id, package_session_id, institute_id, status);
CREATE INDEX idx_ssigm_enrollment_number ON public.student_session_institute_group_mapping USING btree (institute_enrollment_number);
CREATE INDEX idx_ssigm_expiry_date ON public.student_session_institute_group_mapping USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX idx_ssigm_group_id_status ON public.student_session_institute_group_mapping USING btree (group_id, status) WHERE ((status)::text = 'ACTIVE'::text);
CREATE INDEX idx_ssigm_institute_id_status ON public.student_session_institute_group_mapping USING btree (institute_id, status) WHERE ((status)::text = 'ACTIVE'::text);
CREATE INDEX idx_ssigm_package_session_id_status ON public.student_session_institute_group_mapping USING btree (package_session_id, status) WHERE ((status)::text = 'ACTIVE'::text);
CREATE INDEX idx_ssigm_user_id_status ON public.student_session_institute_group_mapping USING btree (user_id, status) WHERE ((status)::text = 'ACTIVE'::text);
CREATE INDEX idx_student_batch_lookup ON public.student_session_institute_group_mapping USING btree (package_session_id, institute_id, user_id, status) WHERE ((status)::text = 'ACTIVE'::text);

-- Table Triggers

create trigger update_user_task_updated_on before
update
    on
    public.student_session_institute_group_mapping for each row execute function update_updated_on_user_task();


-- public.workflow_execution definition

-- Drop table

-- DROP TABLE public.workflow_execution;

CREATE TABLE public.workflow_execution (
	id varchar NOT NULL,
	workflow_id varchar NOT NULL,
	execution_id varchar NOT NULL,
	schedule_id varchar NULL,
	schedule_run_id varchar NULL,
	status varchar DEFAULT 'RUNNING'::character varying NOT NULL,
	current_node_link_id varchar NULL,
	input_data text NULL,
	output_data text NULL,
	started_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	completed_at timestamp NULL,
	CONSTRAINT workflow_execution_execution_id_key UNIQUE (execution_id),
	CONSTRAINT workflow_execution_pkey PRIMARY KEY (id),
	CONSTRAINT workflow_execution_schedule_run_id_key UNIQUE (schedule_run_id),
	CONSTRAINT workflow_execution_current_node_link_id_fkey FOREIGN KEY (current_node_link_id) REFERENCES public.workflow_node_mapping(id),
	CONSTRAINT workflow_execution_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedule(id),
	CONSTRAINT workflow_execution_schedule_run_id_fkey FOREIGN KEY (schedule_run_id) REFERENCES public.workflow_schedule_run(id),
	CONSTRAINT workflow_execution_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE
);
CREATE INDEX idx_wf_exec_schedule ON public.workflow_execution USING btree (schedule_run_id);
CREATE INDEX idx_wf_exec_wf_status ON public.workflow_execution USING btree (workflow_id, status);


-- public.node_execution definition

-- Drop table

-- DROP TABLE public.node_execution;

CREATE TABLE public.node_execution (
	id varchar NOT NULL,
	workflow_execution_id varchar NOT NULL,
	node_link_id varchar NOT NULL,
	node_template_id varchar NOT NULL,
	execution_order int4 NOT NULL,
	status varchar DEFAULT 'PENDING'::character varying NOT NULL,
	input_data text NULL,
	output_data text NULL,
	routing_decision_json text NULL,
	error_message text NULL,
	started_at timestamp NULL,
	completed_at timestamp NULL,
	CONSTRAINT node_execution_pkey PRIMARY KEY (id),
	CONSTRAINT node_execution_node_link_id_fkey FOREIGN KEY (node_link_id) REFERENCES public.workflow_node_mapping(id) ON DELETE CASCADE,
	CONSTRAINT node_execution_node_template_id_fkey FOREIGN KEY (node_template_id) REFERENCES public.node_template(id),
	CONSTRAINT node_execution_workflow_execution_id_fkey FOREIGN KEY (workflow_execution_id) REFERENCES public.workflow_execution(id) ON DELETE CASCADE
);
CREATE INDEX idx_node_exec_st ON public.node_execution USING btree (status, started_at);
CREATE INDEX idx_node_exec_wf ON public.node_execution USING btree (workflow_execution_id, execution_order);