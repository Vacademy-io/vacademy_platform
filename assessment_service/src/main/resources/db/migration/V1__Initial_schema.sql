-- public.assessment definition

-- Drop table

-- DROP TABLE public.assessment;

CREATE TABLE public.assessment (
	id varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	about_id varchar(255) NULL,
	instructions_id varchar(255) NULL,
	play_mode varchar(50) NOT NULL,
	evaluation_type varchar(50) NOT NULL,
	duration_distribution varchar(50) DEFAULT 'ASSESSMENT'::character varying NULL,
	can_switch_section bool NOT NULL,
	assessment_visibility varchar(50) NOT NULL,
	registration_close_date timestamp NULL,
	registration_open_date timestamp NULL,
	expected_participants int4 NULL,
	cover_file_id int4 NULL,
	bound_start_time timestamp NULL,
	bound_end_time timestamp NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	duration int4 NULL,
	status varchar(255) NULL,
	preview_time int4 NULL,
	submission_type varchar(255) NULL,
	can_request_reattempt bool NULL,
	can_request_time_increase bool NULL,
	omr_mode bool NULL,
	reattempt_count int4 DEFAULT 1 NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	assessment_type varchar(255) NULL,
	CONSTRAINT assessment_pkey PRIMARY KEY (id)
);


-- public.assessment_rich_text_data definition

-- Drop table

-- DROP TABLE public.assessment_rich_text_data;

CREATE TABLE public.assessment_rich_text_data (
	id varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT assessment_rich_text_data_pkey PRIMARY KEY (id)
);


-- public.assessment_user_access definition

-- Drop table

-- DROP TABLE public.assessment_user_access;

CREATE TABLE public.assessment_user_access (
	id serial4 NOT NULL,
	user_id varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	username varchar(255) NOT NULL,
	email varchar(255) NOT NULL,
	phone varchar(20) NULL,
	permissions _text NOT NULL,
	assessment_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT assessment_user_access_pkey PRIMARY KEY (id)
);


-- public.chapter definition

-- Drop table

-- DROP TABLE public.chapter;

CREATE TABLE public.chapter (
	chapter_id varchar NOT NULL,
	chapter_name varchar NOT NULL,
	chapter_order int4 NOT NULL,
	CONSTRAINT chapter_name_unique UNIQUE (chapter_name),
	CONSTRAINT chapter_pkey PRIMARY KEY (chapter_id)
);


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


-- public.entity_tags definition

-- Drop table

-- DROP TABLE public.entity_tags;

CREATE TABLE public.entity_tags (
	entity_id varchar(255) NOT NULL,
	entity_name varchar(255) NOT NULL,
	tag_id varchar(255) NOT NULL,
	tag_source varchar(255) NULL,
	CONSTRAINT entity_tags_pkey PRIMARY KEY (entity_name, entity_id, tag_id)
);


-- public.evaluation_logs definition

-- Drop table

-- DROP TABLE public.evaluation_logs;

CREATE TABLE public.evaluation_logs (
	id varchar(255) NOT NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	"type" varchar(255) NULL,
	learner_id varchar(255) NULL,
	data_json text NULL,
	author_id varchar(255) NULL,
	date_and_time timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT evaluation_logs_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger trigger_set_timestamps before
insert
    or
update
    on
    public.evaluation_logs for each row execute function set_timestamps();


-- public.levels definition

-- Drop table

-- DROP TABLE public.levels;

CREATE TABLE public.levels (
	level_id varchar(255) NOT NULL,
	level_name varchar(255) NOT NULL,
	CONSTRAINT levels_level_name_key UNIQUE (level_name),
	CONSTRAINT levels_pkey PRIMARY KEY (level_id)
);


-- public.presentation definition

-- Drop table

-- DROP TABLE public.presentation;

CREATE TABLE public.presentation (
	id varchar(255) DEFAULT nextval('presentation_id_seq'::regclass) NOT NULL,
	title varchar(255) NULL,
	description varchar(955) NULL,
	cover_file_id varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	institute_id varchar NULL,
	status varchar NULL,
	CONSTRAINT presentation_pkey PRIMARY KEY (id)
);


-- public.presentation_slide definition

-- Drop table

-- DROP TABLE public.presentation_slide;

CREATE TABLE public.presentation_slide (
	id varchar(255) DEFAULT nextval('presentation_slide_id_seq'::regclass) NOT NULL,
	title text NULL,
	presentation_id varchar(255) NULL,
	source_id varchar(255) NULL,
	"source" varchar(255) NULL,
	interaction_status varchar(255) NULL,
	slide_order int4 NULL,
	"content" text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	default_time int4 NULL,
	status varchar(255) NULL,
	CONSTRAINT presentation_slide_pkey PRIMARY KEY (id)
);


-- public.question definition

-- Drop table

-- DROP TABLE public.question;

CREATE TABLE public.question (
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
	options_json text NULL,
	status varchar(255) NULL,
	difficulty varchar(255) NULL,
	problem_type varchar(255) NULL,
	CONSTRAINT question_pkey PRIMARY KEY (id)
);


-- public.question_paper definition

-- Drop table

-- DROP TABLE public.question_paper;

CREATE TABLE public.question_paper (
	id varchar(255) NOT NULL,
	title varchar(255) NOT NULL,
	description_id varchar(255) NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	created_by_user_id varchar(255) NOT NULL,
	"access" varchar(10) DEFAULT 'PRIVATE'::character varying NULL,
	subject_id varchar(255) NULL,
	chapter_ids text NULL,
	difficulty varchar(255) NULL,
	CONSTRAINT question_paper_pkey PRIMARY KEY (id)
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
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT scheduler_activity_log_pkey PRIMARY KEY (id)
);


-- public.streams definition

-- Drop table

-- DROP TABLE public.streams;

CREATE TABLE public.streams (
	stream_id varchar(255) NOT NULL,
	stream_name varchar(255) NOT NULL,
	CONSTRAINT streams_pkey PRIMARY KEY (stream_id),
	CONSTRAINT streams_stream_name_key UNIQUE (stream_name)
);


-- public.subjects definition

-- Drop table

-- DROP TABLE public.subjects;

CREATE TABLE public.subjects (
	subject_id varchar(255) NOT NULL,
	subject_name varchar(255) NOT NULL,
	CONSTRAINT subjects_pkey PRIMARY KEY (subject_id),
	CONSTRAINT subjects_subject_name_key UNIQUE (subject_name)
);


-- public.tags definition

-- Drop table

-- DROP TABLE public.tags;

CREATE TABLE public.tags (
	tag_id varchar(255) NOT NULL,
	tag_name text NOT NULL,
	CONSTRAINT tags_pkey PRIMARY KEY (tag_id),
	CONSTRAINT tags_tag_name_key UNIQUE (tag_name)
);


-- public.topic definition

-- Drop table

-- DROP TABLE public.topic;

CREATE TABLE public.topic (
	topic_id varchar NOT NULL,
	topic_name varchar NOT NULL,
	topic_order int4 NOT NULL,
	CONSTRAINT topic_name_unique UNIQUE (topic_name),
	CONSTRAINT topic_pkey PRIMARY KEY (topic_id)
);


-- public.assessment_batch_registration definition

-- Drop table

-- DROP TABLE public.assessment_batch_registration;

CREATE TABLE public.assessment_batch_registration (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NOT NULL,
	batch_id varchar(255) NOT NULL,
	institute_id varchar(255) NOT NULL,
	registration_time timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT assessment_batch_registration_pkey PRIMARY KEY (id),
	CONSTRAINT assessment_batch_registration_unique UNIQUE (assessment_id, batch_id, institute_id),
	CONSTRAINT assessment_batch_registration_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id)
);


-- public.assessment_custom_fields definition

-- Drop table

-- DROP TABLE public.assessment_custom_fields;

CREATE TABLE public.assessment_custom_fields (
	id varchar(255) NOT NULL,
	field_name varchar(255) NOT NULL,
	field_key varchar(255) NOT NULL,
	assessment_id varchar(255) NULL,
	is_mandatory bool NOT NULL,
	field_type varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	comma_separated_options text NULL,
	status varchar(255) NULL,
	field_order int4 DEFAULT 0 NULL,
	CONSTRAINT assessment_custom_fields_pkey PRIMARY KEY (id),
	CONSTRAINT assessment_custom_fields_unique UNIQUE (field_key, assessment_id),
	CONSTRAINT assessment_custom_fields_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id)
);


-- public.assessment_institute_mapping definition

-- Drop table

-- DROP TABLE public.assessment_institute_mapping;

CREATE TABLE public.assessment_institute_mapping (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NOT NULL,
	institute_id varchar(255) NOT NULL,
	comma_separated_creation_roles text NULL,
	comma_separated_submission_view_roles text NULL,
	comma_separated_evaluation_roles text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	subject_id varchar(255) NULL,
	assessment_url varchar(524) NULL,
	comma_separated_creation_user_ids text NULL,
	comma_separated_live_roles text NULL,
	comma_separated_submission_view_user_ids text NULL,
	comma_separated_evaluation_user_ids text NULL,
	comma_separated_live_user_ids text NULL,
	evaluation_setting text NULL,
	CONSTRAINT assessment_institute_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT assessment_institute_mapping_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id)
);


-- public.assessment_notification_metadata definition

-- Drop table

-- DROP TABLE public.assessment_notification_metadata;

CREATE TABLE public.assessment_notification_metadata (
	id varchar(36) NOT NULL,
	assessment_id varchar(36) NULL,
	participant_when_assessment_created bool NOT NULL,
	participant_show_leaderboard bool NOT NULL,
	participant_before_assessment_goes_live int4 NOT NULL,
	participant_when_assessment_live bool NOT NULL,
	parent_when_assessment_created bool NOT NULL,
	parent_show_leaderboard bool NOT NULL,
	parent_before_assessment_goes_live int4 NOT NULL,
	parent_when_assessment_live bool NOT NULL,
	when_student_appears bool NULL,
	when_student_finishes_test bool NULL,
	participant_when_assessment_report_generated bool NOT NULL,
	parent_when_assessment_report_generated bool NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT assessment_notification_metadata_pkey PRIMARY KEY (id),
	CONSTRAINT assessment_notification_metadata_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id)
);


-- public.assessment_set_mapping definition

-- Drop table

-- DROP TABLE public.assessment_set_mapping;

CREATE TABLE public.assessment_set_mapping (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NULL,
	set_name varchar(255) NULL,
	status varchar(255) NULL,
	"json" text NULL,
	created_at timestamptz NULL,
	updated_at timestamptz NULL,
	CONSTRAINT assessment_set_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessment(id) ON DELETE CASCADE
);


-- public.assessment_user_registration definition

-- Drop table

-- DROP TABLE public.assessment_user_registration;

CREATE TABLE public.assessment_user_registration (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	registration_time timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	status varchar(255) NOT NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	"source" varchar(255) NULL,
	source_id varchar(255) NULL,
	username varchar(255) NULL,
	user_email varchar NULL,
	phone_number varchar(255) NULL,
	institute_id varchar(255) NULL,
	participant_name varchar(255) NULL,
	face_file_id varchar(255) NULL,
	reattempt_count int4 NULL,
	CONSTRAINT assessment_registration_pkey PRIMARY KEY (id),
	CONSTRAINT assessment_user_registration_unique UNIQUE (assessment_id, user_id),
	CONSTRAINT assessment_registration_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id)
);


-- public.chapter_topic_mapping definition

-- Drop table

-- DROP TABLE public.chapter_topic_mapping;

CREATE TABLE public.chapter_topic_mapping (
	chapter_id varchar NOT NULL,
	topic_id varchar NOT NULL,
	CONSTRAINT chapter_topic_mapping_pkey PRIMARY KEY (chapter_id, topic_id),
	CONSTRAINT chapter_topic_mapping_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapter(chapter_id),
	CONSTRAINT chapter_topic_mapping_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topic(topic_id)
);


-- public.institute_question_paper definition

-- Drop table

-- DROP TABLE public.institute_question_paper;

CREATE TABLE public.institute_question_paper (
	id varchar(255) NOT NULL,
	question_paper_id varchar(255) NULL,
	institute_id varchar(255) NOT NULL,
	status varchar(50) NOT NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	level_id varchar(255) NULL,
	subject_id varchar(255) NULL,
	CONSTRAINT institute_question_paper_pkey PRIMARY KEY (id),
	CONSTRAINT institute_question_paper_question_paper_id_fkey FOREIGN KEY (question_paper_id) REFERENCES public.question_paper(id) ON DELETE CASCADE
);


-- public.level_stream_mapping definition

-- Drop table

-- DROP TABLE public.level_stream_mapping;

CREATE TABLE public.level_stream_mapping (
	level_id varchar(255) NOT NULL,
	stream_id varchar(255) NOT NULL,
	CONSTRAINT level_stream_mapping_pkey PRIMARY KEY (level_id, stream_id),
	CONSTRAINT level_stream_mapping_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(level_id),
	CONSTRAINT level_stream_mapping_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(stream_id)
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
	CONSTRAINT option_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE
);


-- public.question_institute_mapping definition

-- Drop table

-- DROP TABLE public.question_institute_mapping;

CREATE TABLE public.question_institute_mapping (
	id varchar(255) NOT NULL,
	question_id varchar(255) NOT NULL,
	institute_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT question_institute_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE
);


-- public.question_question_paper_mapping definition

-- Drop table

-- DROP TABLE public.question_question_paper_mapping;

CREATE TABLE public.question_question_paper_mapping (
	id varchar(255) NOT NULL,
	question_id varchar(255) NOT NULL,
	question_paper_id varchar(255) NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	question_order int4 NULL,
	CONSTRAINT question_question_paper_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE,
	CONSTRAINT fk_question_paper FOREIGN KEY (question_paper_id) REFERENCES public.question_paper(id) ON DELETE CASCADE
);


-- public."section" definition

-- Drop table

-- DROP TABLE public."section";

CREATE TABLE public."section" (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	description_id text NULL,
	section_type varchar(50) NULL,
	marks_per_question float4 NULL,
	total_marks float4 NULL,
	section_order int4 NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	cut_off_marks float4 NULL,
	question_random_type varchar NULL,
	status varchar(255) NULL,
	problem_random_type varchar(255) NULL,
	duration int4 NULL,
	CONSTRAINT section_pkey PRIMARY KEY (id),
	CONSTRAINT section_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id)
);


-- public.stream_subject_mapping definition

-- Drop table

-- DROP TABLE public.stream_subject_mapping;

CREATE TABLE public.stream_subject_mapping (
	stream_id varchar(255) NOT NULL,
	subject_id varchar(255) NOT NULL,
	CONSTRAINT stream_subject_mapping_pkey PRIMARY KEY (stream_id, subject_id),
	CONSTRAINT stream_subject_mapping_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(stream_id),
	CONSTRAINT stream_subject_mapping_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id)
);


-- public.student_attempt definition

-- Drop table

-- DROP TABLE public.student_attempt;

CREATE TABLE public.student_attempt (
	id varchar(255) NOT NULL,
	registration_id varchar(255) NOT NULL,
	attempt_number int4 NOT NULL,
	start_time timestamptz NOT NULL,
	submit_time timestamptz NULL,
	max_time int4 NOT NULL,
	status varchar(50) NOT NULL,
	attempt_data text NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	preview_start_time timestamptz NOT NULL,
	submit_data text NULL,
	server_last_sync timestamptz NULL,
	client_last_sync timestamptz NULL,
	duration_distribution_json text NULL,
	total_marks float8 DEFAULT 0 NULL,
	total_time_in_seconds int4 NULL,
	result_marks float8 DEFAULT 0 NULL,
	result_status varchar(255) NULL,
	report_release_status varchar(255) NULL,
	report_last_release_date timestamptz NULL,
	set_id varchar(255) NULL,
	comma_separated_evaluator_user_ids text NULL,
	evaluated_file_id varchar(255) NULL,
	CONSTRAINT student_attempt_pkey PRIMARY KEY (id),
	CONSTRAINT fk_set_id FOREIGN KEY (set_id) REFERENCES public.assessment_set_mapping(id) ON DELETE CASCADE,
	CONSTRAINT student_attempt_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.assessment_user_registration(id)
);


-- public.sub_question definition

-- Drop table

-- DROP TABLE public.sub_question;

CREATE TABLE public.sub_question (
	id varchar(255) NOT NULL,
	question_id varchar(255) NOT NULL,
	text_id varchar(255) NOT NULL,
	media_id varchar(255) NULL,
	created_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_on timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	explanation_text_id varchar(255) NULL,
	CONSTRAINT sub_question_pkey PRIMARY KEY (id),
	CONSTRAINT sub_question_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE
);


-- public.subject_chapter_mapping definition

-- Drop table

-- DROP TABLE public.subject_chapter_mapping;

CREATE TABLE public.subject_chapter_mapping (
	subject_id varchar NOT NULL,
	chapter_id varchar NOT NULL,
	stream_id varchar NULL,
	CONSTRAINT subject_chapter_mapping_pkey PRIMARY KEY (subject_id, chapter_id),
	CONSTRAINT subject_chapter_mapping_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapter(chapter_id),
	CONSTRAINT subject_chapter_mapping_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id)
);


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


-- public.assessment_announcement definition

-- Drop table

-- DROP TABLE public.assessment_announcement;

CREATE TABLE public.assessment_announcement (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NULL,
	rich_text_id varchar(255) NULL,
	attempt_id varchar(255) NULL,
	sent_time timestamp NULL,
	created_at timestamp NULL,
	updated_at timestamp NULL,
	institute_id varchar(255) NULL,
	"type" varchar(255) NULL,
	CONSTRAINT assessment_announcement_pkey PRIMARY KEY (id),
	CONSTRAINT fk_announcement_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessment(id) ON DELETE CASCADE,
	CONSTRAINT fk_announcement_attempt FOREIGN KEY (attempt_id) REFERENCES public.student_attempt(id) ON DELETE SET NULL,
	CONSTRAINT fk_announcement_rich_text FOREIGN KEY (rich_text_id) REFERENCES public.assessment_rich_text_data(id) ON DELETE SET NULL
);


-- public.assessment_registration_custom_field_response_data definition

-- Drop table

-- DROP TABLE public.assessment_registration_custom_field_response_data;

CREATE TABLE public.assessment_registration_custom_field_response_data (
	id varchar(255) NOT NULL,
	custom_field_id varchar(255) NULL,
	assessment_registration_id varchar(255) NULL,
	answer text NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"order" int4 DEFAULT 0 NULL,
	CONSTRAINT assessment_registration_custom_field_response_data_pkey PRIMARY KEY (id),
	CONSTRAINT assessment_registration_custom__assessment_registration_id_fkey FOREIGN KEY (assessment_registration_id) REFERENCES public.assessment_user_registration(id) ON DELETE CASCADE,
	CONSTRAINT assessment_registration_custom_field_respo_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.assessment_custom_fields(id) ON DELETE CASCADE
);


-- public.question_assessment_section_mapping definition

-- Drop table

-- DROP TABLE public.question_assessment_section_mapping;

CREATE TABLE public.question_assessment_section_mapping (
	id varchar(255) NOT NULL,
	question_id varchar(255) NOT NULL,
	section_id varchar(255) NOT NULL,
	question_order int4 NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	marking_json text NULL,
	question_duration_in_min int4 NULL,
	status varchar(255) NULL,
	CONSTRAINT question_assessment_section_mapping_pkey PRIMARY KEY (id),
	CONSTRAINT question_assessment_section_mapping_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question(id),
	CONSTRAINT question_assessment_section_mapping_section_id_fkey FOREIGN KEY (section_id) REFERENCES public."section"(id)
);


-- public.question_wise_marks definition

-- Drop table

-- DROP TABLE public.question_wise_marks;

CREATE TABLE public.question_wise_marks (
	id varchar(255) NOT NULL,
	assessment_id varchar(255) NOT NULL,
	attempt_id varchar(255) NOT NULL,
	question_id varchar(255) NOT NULL,
	marks float8 NULL,
	status varchar(255) NULL,
	time_taken_in_seconds int4 NULL,
	created_at timestamp DEFAULT now() NULL,
	updated_at timestamp DEFAULT now() NULL,
	response_json text NULL,
	section_id varchar(255) NULL,
	CONSTRAINT question_wise_marks_pkey PRIMARY KEY (id),
	CONSTRAINT fk_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessment(id),
	CONSTRAINT fk_attempt FOREIGN KEY (attempt_id) REFERENCES public.student_attempt(id),
	CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES public.question(id),
	CONSTRAINT fk_question_wise_marks_section FOREIGN KEY (section_id) REFERENCES public."section"(id) ON DELETE CASCADE
);