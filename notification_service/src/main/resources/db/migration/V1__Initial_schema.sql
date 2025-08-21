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


-- public.email_otp definition

-- Drop table

-- DROP TABLE public.email_otp;

CREATE TABLE public.email_otp (
	id varchar(255) NOT NULL,
	email varchar(255) NULL,
	otp varchar(50) NULL,
	service varchar(100) NULL,
	is_verified varchar(10) DEFAULT 'false'::character varying NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT email_otp_pk PRIMARY KEY (id)
);


-- public.fcm_tokens definition

-- Drop table

-- DROP TABLE public.fcm_tokens;

CREATE TABLE public.fcm_tokens (
	id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	"token" text NOT NULL,
	platform varchar(50) NULL,
	device_id varchar(255) NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	institute_id varchar(255) NULL,
	CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id),
	CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);
CREATE INDEX idx_device_id ON public.fcm_tokens USING btree (device_id);
CREATE INDEX idx_is_active ON public.fcm_tokens USING btree (is_active);
CREATE INDEX idx_user_id ON public.fcm_tokens USING btree (user_id);


-- public.institute_announcement_settings definition

-- Drop table

-- DROP TABLE public.institute_announcement_settings;

CREATE TABLE public.institute_announcement_settings (
	id varchar(255) NOT NULL,
	institute_id varchar(255) NOT NULL,
	settings json NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT institute_announcement_settings_institute_id_key UNIQUE (institute_id),
	CONSTRAINT institute_announcement_settings_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_institute_announcement_settings_institute_id ON public.institute_announcement_settings USING btree (institute_id);


-- public.notification_log definition

-- Drop table

-- DROP TABLE public.notification_log;

CREATE TABLE public.notification_log (
	id varchar(255) NOT NULL,
	notification_type varchar(50) NULL,
	channel_id varchar(255) NULL,
	body text NULL,
	"source" varchar(100) NULL,
	source_id varchar(255) NULL,
	user_id varchar(255) NULL,
	notification_date timestamp(6) NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT notification_log_pk PRIMARY KEY (id)
);


-- public.rich_text_data definition

-- Drop table

-- DROP TABLE public.rich_text_data;

CREATE TABLE public.rich_text_data (
	id varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
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


-- public.announcements definition

-- Drop table

-- DROP TABLE public.announcements;

CREATE TABLE public.announcements (
	id varchar(255) NOT NULL,
	title varchar(500) NOT NULL,
	rich_text_id varchar(255) NOT NULL,
	institute_id varchar(255) NOT NULL,
	created_by varchar(255) NOT NULL,
	created_by_name varchar(255) NULL,
	created_by_role varchar(100) NULL,
	status varchar(50) DEFAULT 'ACTIVE'::character varying NULL,
	timezone varchar(100) DEFAULT 'UTC'::character varying NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcements_pkey PRIMARY KEY (id),
	CONSTRAINT announcements_rich_text_id_fkey FOREIGN KEY (rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at);
CREATE INDEX idx_announcements_created_by ON public.announcements USING btree (created_by);
CREATE INDEX idx_announcements_institute_id ON public.announcements USING btree (institute_id);
CREATE INDEX idx_announcements_institute_status ON public.announcements USING btree (institute_id, status);
CREATE INDEX idx_announcements_status ON public.announcements USING btree (status);


-- public.message_replies definition

-- Drop table

-- DROP TABLE public.message_replies;

CREATE TABLE public.message_replies (
	id varchar(255) NOT NULL,
	parent_message_id varchar(255) NULL,
	announcement_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	user_name varchar(255) NULL,
	user_role varchar(100) NULL,
	rich_text_id varchar(255) NOT NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT message_replies_pkey PRIMARY KEY (id),
	CONSTRAINT message_replies_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE,
	CONSTRAINT message_replies_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.message_replies(id) ON DELETE CASCADE,
	CONSTRAINT message_replies_rich_text_id_fkey FOREIGN KEY (rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE CASCADE
);
CREATE INDEX idx_message_replies_announcement_id ON public.message_replies USING btree (announcement_id);
CREATE INDEX idx_message_replies_created_at ON public.message_replies USING btree (created_at);
CREATE INDEX idx_message_replies_parent_message_id ON public.message_replies USING btree (parent_message_id);
CREATE INDEX idx_message_replies_user_id ON public.message_replies USING btree (user_id);


-- public.recipient_messages definition

-- Drop table

-- DROP TABLE public.recipient_messages;

CREATE TABLE public.recipient_messages (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	user_name varchar(255) NULL,
	mode_type varchar(50) NOT NULL,
	medium_type varchar(50) NULL,
	status varchar(50) DEFAULT 'PENDING'::character varying NULL,
	error_message text NULL,
	sent_at timestamp NULL,
	delivered_at timestamp NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT recipient_messages_pkey PRIMARY KEY (id),
	CONSTRAINT recipient_messages_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_recipient_messages_announcement_id ON public.recipient_messages USING btree (announcement_id);
CREATE INDEX idx_recipient_messages_mode_type ON public.recipient_messages USING btree (mode_type);
CREATE INDEX idx_recipient_messages_status ON public.recipient_messages USING btree (status);
CREATE INDEX idx_recipient_messages_user_id ON public.recipient_messages USING btree (user_id);


-- public.scheduled_messages definition

-- Drop table

-- DROP TABLE public.scheduled_messages;

CREATE TABLE public.scheduled_messages (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	schedule_type varchar(50) NOT NULL,
	cron_expression varchar(255) NULL,
	timezone varchar(100) DEFAULT 'UTC'::character varying NULL,
	start_date timestamp NULL,
	end_date timestamp NULL,
	next_run_time timestamp NULL,
	last_run_time timestamp NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id),
	CONSTRAINT scheduled_messages_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_scheduled_messages_announcement_id ON public.scheduled_messages USING btree (announcement_id);
CREATE INDEX idx_scheduled_messages_is_active ON public.scheduled_messages USING btree (is_active);
CREATE INDEX idx_scheduled_messages_next_run_time ON public.scheduled_messages USING btree (next_run_time);


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


-- public.announcement_community definition

-- Drop table

-- DROP TABLE public.announcement_community;

CREATE TABLE public.announcement_community (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	community_type varchar(50) DEFAULT 'GENERAL'::character varying NULL,
	is_pinned bool DEFAULT false NULL,
	pin_duration_hours int4 NULL,
	allow_reactions bool DEFAULT true NULL,
	allow_comments bool DEFAULT true NULL,
	allow_sharing bool DEFAULT true NULL,
	is_anonymous_allowed bool DEFAULT false NULL,
	moderation_required bool DEFAULT false NULL,
	tags text NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_community_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_community_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_community_announcement_id ON public.announcement_community USING btree (announcement_id);
CREATE INDEX idx_announcement_community_community_type ON public.announcement_community USING btree (community_type);
CREATE INDEX idx_announcement_community_is_active ON public.announcement_community USING btree (is_active);
CREATE INDEX idx_announcement_community_is_pinned ON public.announcement_community USING btree (is_pinned);


-- public.announcement_dashboard_pins definition

-- Drop table

-- DROP TABLE public.announcement_dashboard_pins;

CREATE TABLE public.announcement_dashboard_pins (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	pin_duration_hours int4 DEFAULT 24 NULL,
	priority int4 DEFAULT 1 NULL,
	"position" varchar(50) DEFAULT 'top'::character varying NULL,
	background_color varchar(20) NULL,
	is_dismissible bool DEFAULT true NULL,
	pin_start_time timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	pin_end_time timestamp NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_dashboard_pins_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_dashboard_pins_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_dashboard_pins_announcement_id ON public.announcement_dashboard_pins USING btree (announcement_id);
CREATE INDEX idx_announcement_dashboard_pins_is_active ON public.announcement_dashboard_pins USING btree (is_active);
CREATE INDEX idx_announcement_dashboard_pins_pin_end_time ON public.announcement_dashboard_pins USING btree (pin_end_time);
CREATE INDEX idx_announcement_dashboard_pins_priority ON public.announcement_dashboard_pins USING btree (priority);


-- public.announcement_dms definition

-- Drop table

-- DROP TABLE public.announcement_dms;

CREATE TABLE public.announcement_dms (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	is_reply_allowed bool DEFAULT true NULL,
	is_forwarding_allowed bool DEFAULT false NULL,
	message_priority varchar(20) DEFAULT 'NORMAL'::character varying NULL,
	delivery_confirmation_required bool DEFAULT false NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_dms_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_dms_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_dms_announcement_id ON public.announcement_dms USING btree (announcement_id);
CREATE INDEX idx_announcement_dms_is_active ON public.announcement_dms USING btree (is_active);
CREATE INDEX idx_announcement_dms_message_priority ON public.announcement_dms USING btree (message_priority);


-- public.announcement_mediums definition

-- Drop table

-- DROP TABLE public.announcement_mediums;

CREATE TABLE public.announcement_mediums (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	medium_type varchar(50) NOT NULL,
	medium_config json NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_mediums_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_mediums_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_mediums_announcement_id ON public.announcement_mediums USING btree (announcement_id);
CREATE INDEX idx_announcement_mediums_type ON public.announcement_mediums USING btree (medium_type);


-- public.announcement_recipients definition

-- Drop table

-- DROP TABLE public.announcement_recipients;

CREATE TABLE public.announcement_recipients (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	recipient_type varchar(50) NOT NULL,
	recipient_id varchar(255) NOT NULL,
	recipient_name varchar(255) NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	is_active bool DEFAULT true NULL,
	CONSTRAINT announcement_recipients_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_recipients_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_recipients_announcement_id ON public.announcement_recipients USING btree (announcement_id);
CREATE INDEX idx_announcement_recipients_is_active ON public.announcement_recipients USING btree (is_active);
CREATE INDEX idx_announcement_recipients_type_id ON public.announcement_recipients USING btree (recipient_type, recipient_id);


-- public.announcement_resources definition

-- Drop table

-- DROP TABLE public.announcement_resources;

CREATE TABLE public.announcement_resources (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	folder_name varchar(255) NOT NULL,
	category varchar(100) NULL,
	subcategory varchar(100) NULL,
	resource_type varchar(50) DEFAULT 'ANNOUNCEMENT'::character varying NULL,
	access_level varchar(50) DEFAULT 'ALL'::character varying NULL,
	is_downloadable bool DEFAULT false NULL,
	sort_order int4 DEFAULT 0 NULL,
	is_featured bool DEFAULT false NULL,
	expires_at timestamp NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_resources_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_resources_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_resources_access_level ON public.announcement_resources USING btree (access_level);
CREATE INDEX idx_announcement_resources_announcement_id ON public.announcement_resources USING btree (announcement_id);
CREATE INDEX idx_announcement_resources_category ON public.announcement_resources USING btree (category);
CREATE INDEX idx_announcement_resources_expires_at ON public.announcement_resources USING btree (expires_at);
CREATE INDEX idx_announcement_resources_folder_name ON public.announcement_resources USING btree (folder_name);
CREATE INDEX idx_announcement_resources_is_active ON public.announcement_resources USING btree (is_active);
CREATE INDEX idx_announcement_resources_is_featured ON public.announcement_resources USING btree (is_featured);
CREATE INDEX idx_announcement_resources_sort_order ON public.announcement_resources USING btree (sort_order);
CREATE INDEX idx_announcement_resources_subcategory ON public.announcement_resources USING btree (subcategory);


-- public.announcement_streams definition

-- Drop table

-- DROP TABLE public.announcement_streams;

CREATE TABLE public.announcement_streams (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	package_session_id varchar(255) NULL,
	stream_type varchar(50) DEFAULT 'GENERAL'::character varying NULL,
	is_pinned_in_stream bool DEFAULT false NULL,
	pin_duration_hours int4 NULL,
	allow_reactions bool DEFAULT true NULL,
	allow_comments bool DEFAULT true NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_streams_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_streams_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_streams_announcement_id ON public.announcement_streams USING btree (announcement_id);
CREATE INDEX idx_announcement_streams_is_active ON public.announcement_streams USING btree (is_active);
CREATE INDEX idx_announcement_streams_is_pinned ON public.announcement_streams USING btree (is_pinned_in_stream);
CREATE INDEX idx_announcement_streams_package_session_id ON public.announcement_streams USING btree (package_session_id);
CREATE INDEX idx_announcement_streams_stream_type ON public.announcement_streams USING btree (stream_type);


-- public.announcement_system_alerts definition

-- Drop table

-- DROP TABLE public.announcement_system_alerts;

CREATE TABLE public.announcement_system_alerts (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	priority int4 DEFAULT 1 NULL,
	is_dismissible bool DEFAULT true NULL,
	auto_dismiss_after_hours int4 NULL,
	show_badge bool DEFAULT true NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_system_alerts_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_system_alerts_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_system_alerts_announcement_id ON public.announcement_system_alerts USING btree (announcement_id);
CREATE INDEX idx_announcement_system_alerts_is_active ON public.announcement_system_alerts USING btree (is_active);
CREATE INDEX idx_announcement_system_alerts_priority ON public.announcement_system_alerts USING btree (priority);


-- public.announcement_tasks definition

-- Drop table

-- DROP TABLE public.announcement_tasks;

CREATE TABLE public.announcement_tasks (
	id varchar(255) NOT NULL,
	announcement_id varchar(255) NOT NULL,
	slide_ids json NOT NULL,
	go_live_datetime timestamp NOT NULL,
	deadline_datetime timestamp NOT NULL,
	status varchar(20) DEFAULT 'DRAFT'::character varying NULL,
	task_title varchar(255) NULL,
	task_description varchar(1000) NULL,
	estimated_duration_minutes int4 NULL,
	max_attempts int4 NULL,
	is_mandatory bool DEFAULT true NULL,
	auto_status_update bool DEFAULT true NULL,
	reminder_before_minutes int4 NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT announcement_tasks_pkey PRIMARY KEY (id),
	CONSTRAINT announcement_tasks_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE
);
CREATE INDEX idx_announcement_tasks_announcement_id ON public.announcement_tasks USING btree (announcement_id);
CREATE INDEX idx_announcement_tasks_deadline ON public.announcement_tasks USING btree (deadline_datetime, status, is_active);
CREATE INDEX idx_announcement_tasks_go_live ON public.announcement_tasks USING btree (go_live_datetime, status, is_active);
CREATE INDEX idx_announcement_tasks_is_active ON public.announcement_tasks USING btree (is_active);
CREATE INDEX idx_announcement_tasks_reminder ON public.announcement_tasks USING btree (reminder_before_minutes, deadline_datetime, status, is_active);
CREATE INDEX idx_announcement_tasks_status ON public.announcement_tasks USING btree (status);


-- public.message_interactions definition

-- Drop table

-- DROP TABLE public.message_interactions;

CREATE TABLE public.message_interactions (
	id varchar(255) NOT NULL,
	recipient_message_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	interaction_type varchar(50) NOT NULL,
	interaction_time timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	additional_data json NULL,
	CONSTRAINT message_interactions_pkey PRIMARY KEY (id),
	CONSTRAINT message_interactions_recipient_message_id_fkey FOREIGN KEY (recipient_message_id) REFERENCES public.recipient_messages(id) ON DELETE CASCADE
);
CREATE INDEX idx_message_interactions_recipient_message_id ON public.message_interactions USING btree (recipient_message_id);
CREATE INDEX idx_message_interactions_type ON public.message_interactions USING btree (interaction_type);
CREATE INDEX idx_message_interactions_user_id ON public.message_interactions USING btree (user_id);