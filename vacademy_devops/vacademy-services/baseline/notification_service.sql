--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcement_community; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_community (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    community_type character varying(50) DEFAULT 'GENERAL'::character varying,
    is_pinned boolean DEFAULT false,
    pin_duration_hours integer,
    allow_reactions boolean DEFAULT true,
    allow_comments boolean DEFAULT true,
    allow_sharing boolean DEFAULT true,
    is_anonymous_allowed boolean DEFAULT false,
    moderation_required boolean DEFAULT false,
    tags text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_dashboard_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_dashboard_pins (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    pin_duration_hours integer DEFAULT 24,
    priority integer DEFAULT 1,
    "position" character varying(50) DEFAULT 'top'::character varying,
    background_color character varying(20),
    is_dismissible boolean DEFAULT true,
    pin_start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pin_end_time timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_dms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_dms (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    is_reply_allowed boolean DEFAULT true,
    is_forwarding_allowed boolean DEFAULT false,
    message_priority character varying(20) DEFAULT 'NORMAL'::character varying,
    delivery_confirmation_required boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_mediums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_mediums (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    medium_type character varying(50) NOT NULL,
    medium_config json,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_recipients (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    recipient_type character varying(50) NOT NULL,
    recipient_id character varying(255) NOT NULL,
    recipient_name character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);


--
-- Name: announcement_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_resources (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    folder_name character varying(255) NOT NULL,
    category character varying(100),
    subcategory character varying(100),
    resource_type character varying(50) DEFAULT 'ANNOUNCEMENT'::character varying,
    access_level character varying(50) DEFAULT 'ALL'::character varying,
    is_downloadable boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    is_featured boolean DEFAULT false,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    entity character varying(255),
    entitiy_id character varying(255)
);


--
-- Name: announcement_streams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_streams (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    package_session_id character varying(255),
    stream_type character varying(50) DEFAULT 'GENERAL'::character varying,
    is_pinned_in_stream boolean DEFAULT false,
    pin_duration_hours integer,
    allow_reactions boolean DEFAULT true,
    allow_comments boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_system_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_system_alerts (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    priority integer DEFAULT 1,
    is_dismissible boolean DEFAULT true,
    auto_dismiss_after_hours integer,
    show_badge boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcement_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_tasks (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    slide_ids json NOT NULL,
    go_live_datetime timestamp without time zone NOT NULL,
    deadline_datetime timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    task_title character varying(255),
    task_description character varying(1000),
    estimated_duration_minutes integer,
    max_attempts integer,
    is_mandatory boolean DEFAULT true,
    auto_status_update boolean DEFAULT true,
    reminder_before_minutes integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id character varying(255) NOT NULL,
    title character varying(500) NOT NULL,
    rich_text_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    created_by character varying(255) NOT NULL,
    created_by_name character varying(255),
    created_by_role character varying(100),
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    entity character varying(255),
    entity_id character varying(255)
);


--
-- Name: bounced_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bounced_emails (
    id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    bounce_type character varying(50) NOT NULL,
    bounce_sub_type character varying(100),
    bounce_reason text,
    ses_message_id character varying(255),
    original_notification_log_id character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE bounced_emails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bounced_emails IS 'Stores email addresses that have bounced. These emails are blocked from receiving future emails.';


--
-- Name: COLUMN bounced_emails.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bounced_emails.email IS 'The email address that bounced (normalized to lowercase)';


--
-- Name: COLUMN bounced_emails.bounce_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bounced_emails.bounce_type IS 'SES bounce type: Permanent, Transient, Undetermined';


--
-- Name: COLUMN bounced_emails.bounce_sub_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bounced_emails.bounce_sub_type IS 'SES bounce sub-type: General, NoEmail, Suppressed, OnAccountSuppressionList, MailboxFull, etc.';


--
-- Name: COLUMN bounced_emails.bounce_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bounced_emails.bounce_reason IS 'Diagnostic information from the bounce event';


--
-- Name: COLUMN bounced_emails.ses_message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bounced_emails.ses_message_id IS 'The SES message ID of the email that bounced';


--
-- Name: COLUMN bounced_emails.original_notification_log_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bounced_emails.original_notification_log_id IS 'Reference to the original notification_log entry';


--
-- Name: COLUMN bounced_emails.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bounced_emails.is_active IS 'Whether this bounce block is active. Set to false to unblock an email.';


--
-- Name: channel_flow_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_flow_config (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    channel_type character varying(255) NOT NULL,
    current_template_name text NOT NULL,
    response_template_config text NOT NULL,
    variable_config text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fixed_variables_config text,
    action_template_config text
);


--
-- Name: COLUMN channel_flow_config.fixed_variables_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channel_flow_config.fixed_variables_config IS 'JSON storing fixed/static variables for templates. Example: {"template_name": {"var1": "value1", "var2": "value2"}}';


--
-- Name: COLUMN channel_flow_config.action_template_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.channel_flow_config.action_template_config IS 'JSON config for workflow/verification actions. Processed BEFORE response_template_config.';


--
-- Name: channel_to_institute_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_to_institute_mapping (
    channel_id character varying(50) NOT NULL,
    channel_type character varying(50),
    display_channel_number character varying(30),
    institute_id character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chatbot_delay_task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_delay_task (
    id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    flow_id character varying(255) NOT NULL,
    next_node_id character varying(255) NOT NULL,
    fire_at timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    retry_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chatbot_flow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_flow (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    channel_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    trigger_config text,
    settings text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chatbot_flow_edge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_flow_edge (
    id character varying(255) NOT NULL,
    flow_id character varying(255) NOT NULL,
    source_node_id character varying(255) NOT NULL,
    target_node_id character varying(255) NOT NULL,
    condition_label character varying(255),
    condition_config text,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chatbot_flow_node; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_flow_node (
    id character varying(255) NOT NULL,
    flow_id character varying(255) NOT NULL,
    node_type character varying(50) NOT NULL,
    name character varying(255),
    config text,
    position_x double precision DEFAULT 0,
    position_y double precision DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chatbot_flow_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_flow_session (
    id character varying(255) NOT NULL,
    flow_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    user_phone character varying(50) NOT NULL,
    user_id character varying(255),
    current_node_id character varying(255),
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    context text,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    channel_type character varying(50),
    business_channel_id character varying(100)
);


--
-- Name: client_secret_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_secret_key (
    client_name character varying(255) NOT NULL,
    secret_key character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: email_address_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_address_mapping (
    id character varying(255) NOT NULL,
    email_address character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    email_type character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: email_otp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_otp (
    id character varying(255) NOT NULL,
    email character varying(255),
    otp character varying(50),
    service character varying(100),
    is_verified character varying(10) DEFAULT 'false'::character varying,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    type character varying(20) DEFAULT 'EMAIL'::character varying NOT NULL,
    phone_number character varying(20)
);


--
-- Name: TABLE email_otp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_otp IS 'Stores OTP for both email and WhatsApp authentication';


--
-- Name: COLUMN email_otp.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_otp.type IS 'Type of OTP: EMAIL or WHATSAPP';


--
-- Name: COLUMN email_otp.phone_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_otp.phone_number IS 'Phone number for WhatsApp OTP (null for email OTP)';


--
-- Name: engagement_trigger_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engagement_trigger_config (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    channel_type character varying(50) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_identifier character varying(255),
    threshold_seconds integer NOT NULL,
    threshold_type character varying(50) DEFAULT 'CUMULATIVE'::character varying,
    template_name text NOT NULL,
    template_variables text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    previous_template_name text,
    require_previous_template boolean DEFAULT false
);


--
-- Name: external_communication_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_communication_logs (
    id character varying(255) NOT NULL,
    source character varying(100) NOT NULL,
    source_id character varying(255),
    payload_json text,
    response_json text,
    status character varying(20) NOT NULL,
    error_message text,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fcm_tokens (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    token text NOT NULL,
    platform character varying(50),
    device_id character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    institute_id character varying(255)
);


--
-- Name: flyway_schema_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


--
-- Name: institute_announcement_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_announcement_settings (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    settings json NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: message_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_interactions (
    id character varying(255) NOT NULL,
    recipient_message_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    interaction_type character varying(50) NOT NULL,
    interaction_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    additional_data json
);


--
-- Name: message_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_replies (
    id character varying(255) NOT NULL,
    parent_message_id character varying(255),
    announcement_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    user_name character varying(255),
    user_role character varying(100),
    rich_text_id character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notification_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_log (
    id character varying(255) NOT NULL,
    notification_type character varying(50),
    channel_id character varying(255),
    body text,
    source character varying(100),
    source_id character varying(255),
    user_id character varying(255),
    notification_date timestamp(6) without time zone,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    sender_business_channel_id character varying(50),
    message_payload text,
    sender_name character varying(255),
    institute_id character varying(255)
);


--
-- Name: notification_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_template (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    meta_template_id character varying(255),
    name character varying(255) NOT NULL,
    language character varying(10) DEFAULT 'en'::character varying NOT NULL,
    category character varying(50),
    status character varying(30) DEFAULT 'DRAFT'::character varying,
    rejection_reason text,
    header_type character varying(20) DEFAULT 'NONE'::character varying,
    header_text text,
    header_sample_url text,
    body_text text,
    footer_text text,
    buttons_config text,
    body_sample_values text,
    header_sample_values text,
    created_via_vacademy boolean DEFAULT true,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    submitted_at timestamp without time zone,
    approved_at timestamp without time zone,
    body_variable_names text,
    channel_type character varying(20) DEFAULT 'WHATSAPP'::character varying,
    subject text,
    content text,
    content_type character varying(20),
    setting_json text,
    dynamic_parameters text,
    can_delete boolean DEFAULT true,
    template_category character varying(50)
);


--
-- Name: notification_template_day_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_template_day_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id uuid NOT NULL,
    sender_business_channel_id character varying(255) NOT NULL,
    day_number integer NOT NULL,
    day_label character varying(255) NOT NULL,
    template_identifier character varying(255) NOT NULL,
    sub_template_label character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    notification_type character varying(50) DEFAULT 'WHATSAPP_MESSAGE_OUTGOING'::character varying NOT NULL,
    channel_type character varying(50) DEFAULT 'WHATSAPP'::character varying NOT NULL
);


--
-- Name: TABLE notification_template_day_map; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_template_day_map IS 'Maps workflow day templates to notification_log for analytics tracking';


--
-- Name: COLUMN notification_template_day_map.template_identifier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_template_day_map.template_identifier IS 'Identifier to match in notification_log.body using LIKE pattern';


--
-- Name: COLUMN notification_template_day_map.sub_template_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_template_day_map.sub_template_label IS 'Label for sub-templates like Level 1, Level 2, Morning, Evening';


--
-- Name: COLUMN notification_template_day_map.notification_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_template_day_map.notification_type IS 'Type of notification: WHATSAPP_MESSAGE_OUTGOING, WHATSAPP_MESSAGE_INCOMING, EMAIL_OUTGOING, etc.';


--
-- Name: COLUMN notification_template_day_map.channel_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_template_day_map.channel_type IS 'Communication channel: WHATSAPP, EMAIL, SMS, PUSH_NOTIFICATION, etc.';


--
-- Name: recipient_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipient_messages (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    user_name character varying(255),
    mode_type character varying(50) NOT NULL,
    medium_type character varying(50),
    status character varying(50) DEFAULT 'PENDING'::character varying,
    error_message text,
    sent_at timestamp without time zone,
    delivered_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rich_text_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rich_text_data (
    id character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: scheduled_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_messages (
    id character varying(255) NOT NULL,
    announcement_id character varying(255) NOT NULL,
    schedule_type character varying(50) NOT NULL,
    cron_expression character varying(255),
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    next_run_time timestamp without time zone,
    last_run_time timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: scheduler_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduler_activity_log (
    id character varying(255) NOT NULL,
    task_name character varying(255),
    status character varying(255),
    execution_time timestamp with time zone,
    cron_profile_id character varying(255),
    cron_profile_type character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    update_at timestamp with time zone DEFAULT now()
);


--
-- Name: send_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.send_batch (
    id character varying(36) NOT NULL,
    institute_id character varying(255) NOT NULL,
    channel character varying(50) NOT NULL,
    template_name character varying(255),
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    status character varying(20) DEFAULT 'QUEUED'::character varying NOT NULL,
    request_payload text,
    results_payload text,
    error_message text,
    source character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


--
-- Name: task_execution_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_execution_audit (
    id character varying(255) NOT NULL,
    task_id character varying(255),
    status character varying(255),
    status_message text,
    source character varying(255),
    source_id character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_announcement_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_announcement_settings (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    channel character varying(50) NOT NULL,
    source_identifier character varying(255) DEFAULT 'DEFAULT'::character varying NOT NULL,
    is_unsubscribed boolean DEFAULT false NOT NULL,
    unsubscribed_at timestamp without time zone,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    institute_id character varying(255) NOT NULL
);


--
-- Name: announcement_community announcement_community_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_community
    ADD CONSTRAINT announcement_community_pkey PRIMARY KEY (id);


--
-- Name: announcement_dashboard_pins announcement_dashboard_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_dashboard_pins
    ADD CONSTRAINT announcement_dashboard_pins_pkey PRIMARY KEY (id);


--
-- Name: announcement_dms announcement_dms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_dms
    ADD CONSTRAINT announcement_dms_pkey PRIMARY KEY (id);


--
-- Name: announcement_mediums announcement_mediums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_mediums
    ADD CONSTRAINT announcement_mediums_pkey PRIMARY KEY (id);


--
-- Name: announcement_recipients announcement_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_recipients
    ADD CONSTRAINT announcement_recipients_pkey PRIMARY KEY (id);


--
-- Name: announcement_resources announcement_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_resources
    ADD CONSTRAINT announcement_resources_pkey PRIMARY KEY (id);


--
-- Name: announcement_streams announcement_streams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_streams
    ADD CONSTRAINT announcement_streams_pkey PRIMARY KEY (id);


--
-- Name: announcement_system_alerts announcement_system_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_system_alerts
    ADD CONSTRAINT announcement_system_alerts_pkey PRIMARY KEY (id);


--
-- Name: announcement_tasks announcement_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_tasks
    ADD CONSTRAINT announcement_tasks_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: bounced_emails bounced_emails_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bounced_emails
    ADD CONSTRAINT bounced_emails_email_unique UNIQUE (email);


--
-- Name: bounced_emails bounced_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bounced_emails
    ADD CONSTRAINT bounced_emails_pkey PRIMARY KEY (id);


--
-- Name: channel_flow_config channel_flow_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_flow_config
    ADD CONSTRAINT channel_flow_config_pkey PRIMARY KEY (id);


--
-- Name: channel_to_institute_mapping channel_to_institute_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_to_institute_mapping
    ADD CONSTRAINT channel_to_institute_mapping_pkey PRIMARY KEY (channel_id);


--
-- Name: chatbot_delay_task chatbot_delay_task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_delay_task
    ADD CONSTRAINT chatbot_delay_task_pkey PRIMARY KEY (id);


--
-- Name: chatbot_flow_edge chatbot_flow_edge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_edge
    ADD CONSTRAINT chatbot_flow_edge_pkey PRIMARY KEY (id);


--
-- Name: chatbot_flow_node chatbot_flow_node_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_node
    ADD CONSTRAINT chatbot_flow_node_pkey PRIMARY KEY (id);


--
-- Name: chatbot_flow chatbot_flow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow
    ADD CONSTRAINT chatbot_flow_pkey PRIMARY KEY (id);


--
-- Name: chatbot_flow_session chatbot_flow_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_session
    ADD CONSTRAINT chatbot_flow_session_pkey PRIMARY KEY (id);


--
-- Name: client_secret_key client_secret_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_secret_key
    ADD CONSTRAINT client_secret_key_pkey PRIMARY KEY (client_name);


--
-- Name: email_address_mapping email_address_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_address_mapping
    ADD CONSTRAINT email_address_mapping_pkey PRIMARY KEY (id);


--
-- Name: email_otp email_otp_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otp
    ADD CONSTRAINT email_otp_pk PRIMARY KEY (id);


--
-- Name: engagement_trigger_config engagement_trigger_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engagement_trigger_config
    ADD CONSTRAINT engagement_trigger_config_pkey PRIMARY KEY (id);


--
-- Name: external_communication_logs external_communication_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_communication_logs
    ADD CONSTRAINT external_communication_logs_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: institute_announcement_settings institute_announcement_settings_institute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_announcement_settings
    ADD CONSTRAINT institute_announcement_settings_institute_id_key UNIQUE (institute_id);


--
-- Name: institute_announcement_settings institute_announcement_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_announcement_settings
    ADD CONSTRAINT institute_announcement_settings_pkey PRIMARY KEY (id);


--
-- Name: message_interactions message_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_interactions
    ADD CONSTRAINT message_interactions_pkey PRIMARY KEY (id);


--
-- Name: message_replies message_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_replies
    ADD CONSTRAINT message_replies_pkey PRIMARY KEY (id);


--
-- Name: notification_log notification_log_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_pk PRIMARY KEY (id);


--
-- Name: notification_template_day_map notification_template_day_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_template_day_map
    ADD CONSTRAINT notification_template_day_map_pkey PRIMARY KEY (id);


--
-- Name: recipient_messages recipient_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipient_messages
    ADD CONSTRAINT recipient_messages_pkey PRIMARY KEY (id);


--
-- Name: rich_text_data rich_text_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rich_text_data
    ADD CONSTRAINT rich_text_data_pkey PRIMARY KEY (id);


--
-- Name: scheduled_messages scheduled_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id);


--
-- Name: scheduler_activity_log scheduler_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_activity_log
    ADD CONSTRAINT scheduler_activity_log_pkey PRIMARY KEY (id);


--
-- Name: send_batch send_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.send_batch
    ADD CONSTRAINT send_batch_pkey PRIMARY KEY (id);


--
-- Name: task_execution_audit task_execution_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT task_execution_audit_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens unique_user_device; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT unique_user_device UNIQUE (user_id, device_id);


--
-- Name: user_announcement_settings uq_user_announcement_settings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcement_settings
    ADD CONSTRAINT uq_user_announcement_settings UNIQUE (user_id, institute_id, channel, source_identifier);


--
-- Name: user_announcement_settings user_announcement_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcement_settings
    ADD CONSTRAINT user_announcement_settings_pkey PRIMARY KEY (id);


--
-- Name: notification_template whatsapp_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_template
    ADD CONSTRAINT whatsapp_template_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_announcement_community_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_community_announcement_id ON public.announcement_community USING btree (announcement_id);


--
-- Name: idx_announcement_community_community_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_community_community_type ON public.announcement_community USING btree (community_type);


--
-- Name: idx_announcement_community_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_community_is_active ON public.announcement_community USING btree (is_active);


--
-- Name: idx_announcement_community_is_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_community_is_pinned ON public.announcement_community USING btree (is_pinned);


--
-- Name: idx_announcement_dashboard_pins_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_dashboard_pins_announcement_id ON public.announcement_dashboard_pins USING btree (announcement_id);


--
-- Name: idx_announcement_dashboard_pins_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_dashboard_pins_is_active ON public.announcement_dashboard_pins USING btree (is_active);


--
-- Name: idx_announcement_dashboard_pins_pin_end_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_dashboard_pins_pin_end_time ON public.announcement_dashboard_pins USING btree (pin_end_time);


--
-- Name: idx_announcement_dashboard_pins_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_dashboard_pins_priority ON public.announcement_dashboard_pins USING btree (priority);


--
-- Name: idx_announcement_dms_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_dms_announcement_id ON public.announcement_dms USING btree (announcement_id);


--
-- Name: idx_announcement_dms_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_dms_is_active ON public.announcement_dms USING btree (is_active);


--
-- Name: idx_announcement_dms_message_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_dms_message_priority ON public.announcement_dms USING btree (message_priority);


--
-- Name: idx_announcement_mediums_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_mediums_announcement_id ON public.announcement_mediums USING btree (announcement_id);


--
-- Name: idx_announcement_mediums_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_mediums_type ON public.announcement_mediums USING btree (medium_type);


--
-- Name: idx_announcement_recipients_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_recipients_announcement_id ON public.announcement_recipients USING btree (announcement_id);


--
-- Name: idx_announcement_recipients_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_recipients_is_active ON public.announcement_recipients USING btree (is_active);


--
-- Name: idx_announcement_recipients_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_recipients_type_id ON public.announcement_recipients USING btree (recipient_type, recipient_id);


--
-- Name: idx_announcement_resources_access_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_access_level ON public.announcement_resources USING btree (access_level);


--
-- Name: idx_announcement_resources_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_announcement_id ON public.announcement_resources USING btree (announcement_id);


--
-- Name: idx_announcement_resources_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_category ON public.announcement_resources USING btree (category);


--
-- Name: idx_announcement_resources_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_expires_at ON public.announcement_resources USING btree (expires_at);


--
-- Name: idx_announcement_resources_folder_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_folder_name ON public.announcement_resources USING btree (folder_name);


--
-- Name: idx_announcement_resources_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_is_active ON public.announcement_resources USING btree (is_active);


--
-- Name: idx_announcement_resources_is_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_is_featured ON public.announcement_resources USING btree (is_featured);


--
-- Name: idx_announcement_resources_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_sort_order ON public.announcement_resources USING btree (sort_order);


--
-- Name: idx_announcement_resources_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_resources_subcategory ON public.announcement_resources USING btree (subcategory);


--
-- Name: idx_announcement_streams_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_streams_announcement_id ON public.announcement_streams USING btree (announcement_id);


--
-- Name: idx_announcement_streams_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_streams_is_active ON public.announcement_streams USING btree (is_active);


--
-- Name: idx_announcement_streams_is_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_streams_is_pinned ON public.announcement_streams USING btree (is_pinned_in_stream);


--
-- Name: idx_announcement_streams_package_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_streams_package_session_id ON public.announcement_streams USING btree (package_session_id);


--
-- Name: idx_announcement_streams_stream_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_streams_stream_type ON public.announcement_streams USING btree (stream_type);


--
-- Name: idx_announcement_system_alerts_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_system_alerts_announcement_id ON public.announcement_system_alerts USING btree (announcement_id);


--
-- Name: idx_announcement_system_alerts_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_system_alerts_is_active ON public.announcement_system_alerts USING btree (is_active);


--
-- Name: idx_announcement_system_alerts_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_system_alerts_priority ON public.announcement_system_alerts USING btree (priority);


--
-- Name: idx_announcement_tasks_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_tasks_announcement_id ON public.announcement_tasks USING btree (announcement_id);


--
-- Name: idx_announcement_tasks_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_tasks_deadline ON public.announcement_tasks USING btree (deadline_datetime, status, is_active);


--
-- Name: idx_announcement_tasks_go_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_tasks_go_live ON public.announcement_tasks USING btree (go_live_datetime, status, is_active);


--
-- Name: idx_announcement_tasks_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_tasks_is_active ON public.announcement_tasks USING btree (is_active);


--
-- Name: idx_announcement_tasks_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_tasks_reminder ON public.announcement_tasks USING btree (reminder_before_minutes, deadline_datetime, status, is_active);


--
-- Name: idx_announcement_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcement_tasks_status ON public.announcement_tasks USING btree (status);


--
-- Name: idx_announcements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at);


--
-- Name: idx_announcements_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_created_by ON public.announcements USING btree (created_by);


--
-- Name: idx_announcements_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_institute_id ON public.announcements USING btree (institute_id);


--
-- Name: idx_announcements_institute_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_institute_status ON public.announcements USING btree (institute_id, status);


--
-- Name: idx_announcements_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_status ON public.announcements USING btree (status);


--
-- Name: idx_bounced_emails_bounce_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bounced_emails_bounce_type ON public.bounced_emails USING btree (bounce_type);


--
-- Name: idx_bounced_emails_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bounced_emails_email ON public.bounced_emails USING btree (email);


--
-- Name: idx_bounced_emails_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bounced_emails_email_active ON public.bounced_emails USING btree (email, is_active);


--
-- Name: idx_bounced_emails_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bounced_emails_is_active ON public.bounced_emails USING btree (is_active);


--
-- Name: idx_chatbot_delay_task_fire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_delay_task_fire ON public.chatbot_delay_task USING btree (status, fire_at);


--
-- Name: idx_chatbot_flow_edge_flow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_edge_flow ON public.chatbot_flow_edge USING btree (flow_id);


--
-- Name: idx_chatbot_flow_edge_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_edge_source ON public.chatbot_flow_edge USING btree (source_node_id);


--
-- Name: idx_chatbot_flow_institute_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_institute_channel ON public.chatbot_flow USING btree (institute_id, channel_type, status);


--
-- Name: idx_chatbot_flow_institute_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_institute_status ON public.chatbot_flow USING btree (institute_id, status);


--
-- Name: idx_chatbot_flow_node_flow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_node_flow ON public.chatbot_flow_node USING btree (flow_id);


--
-- Name: idx_chatbot_flow_node_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_node_type ON public.chatbot_flow_node USING btree (flow_id, node_type);


--
-- Name: idx_chatbot_flow_session_flow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_session_flow ON public.chatbot_flow_session USING btree (flow_id, status);


--
-- Name: idx_chatbot_flow_session_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_flow_session_lookup ON public.chatbot_flow_session USING btree (institute_id, user_phone, status);


--
-- Name: idx_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_id ON public.fcm_tokens USING btree (device_id);


--
-- Name: idx_email_otp_phone_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_otp_phone_number ON public.email_otp USING btree (phone_number);


--
-- Name: idx_email_otp_phone_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_otp_phone_type ON public.email_otp USING btree (phone_number, type);


--
-- Name: idx_email_otp_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_otp_type ON public.email_otp USING btree (type);


--
-- Name: idx_engagement_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engagement_lookup ON public.engagement_trigger_config USING btree (institute_id, channel_type, source_type, source_identifier, is_active);


--
-- Name: idx_external_comm_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_comm_logs_created_at ON public.external_communication_logs USING btree (created_at);


--
-- Name: idx_external_comm_logs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_comm_logs_source ON public.external_communication_logs USING btree (source);


--
-- Name: idx_external_comm_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_comm_logs_status ON public.external_communication_logs USING btree (status);


--
-- Name: idx_flow_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flow_lookup ON public.channel_flow_config USING btree (institute_id, current_template_name, channel_type);


--
-- Name: idx_institute_announcement_settings_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_institute_announcement_settings_institute_id ON public.institute_announcement_settings USING btree (institute_id);


--
-- Name: idx_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_active ON public.fcm_tokens USING btree (is_active);


--
-- Name: idx_log_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_log_context ON public.notification_log USING btree (channel_id, sender_business_channel_id, notification_type);


--
-- Name: idx_message_interactions_recipient_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_interactions_recipient_message_id ON public.message_interactions USING btree (recipient_message_id);


--
-- Name: idx_message_interactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_interactions_type ON public.message_interactions USING btree (interaction_type);


--
-- Name: idx_message_interactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_interactions_user_id ON public.message_interactions USING btree (user_id);


--
-- Name: idx_message_replies_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_replies_announcement_id ON public.message_replies USING btree (announcement_id);


--
-- Name: idx_message_replies_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_replies_created_at ON public.message_replies USING btree (created_at);


--
-- Name: idx_message_replies_parent_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_replies_parent_message_id ON public.message_replies USING btree (parent_message_id);


--
-- Name: idx_message_replies_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_replies_user_id ON public.message_replies USING btree (user_id);


--
-- Name: idx_nl_channel_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nl_channel_date ON public.notification_log USING btree (channel_id, notification_date DESC);


--
-- Name: idx_nl_sender_channel_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nl_sender_channel_type_date ON public.notification_log USING btree (sender_business_channel_id, notification_type, notification_date DESC);


--
-- Name: idx_notification_day_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_day_lookup ON public.notification_template_day_map USING btree (day_number);


--
-- Name: idx_notification_log_institute_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_log_institute_channel ON public.notification_log USING btree (institute_id, channel_id, notification_type);


--
-- Name: idx_notification_log_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_log_institute_date ON public.notification_log USING btree (institute_id, notification_date DESC);


--
-- Name: idx_notification_template_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_template_channel ON public.notification_template USING btree (institute_id, channel_type);


--
-- Name: idx_notification_template_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_template_lookup ON public.notification_template_day_map USING btree (institute_id, sender_business_channel_id, is_active);


--
-- Name: idx_notification_template_name_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_template_name_channel ON public.notification_template USING btree (institute_id, name, channel_type);


--
-- Name: idx_recipient_messages_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipient_messages_announcement_id ON public.recipient_messages USING btree (announcement_id);


--
-- Name: idx_recipient_messages_mode_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipient_messages_mode_type ON public.recipient_messages USING btree (mode_type);


--
-- Name: idx_recipient_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipient_messages_status ON public.recipient_messages USING btree (status);


--
-- Name: idx_recipient_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipient_messages_user_id ON public.recipient_messages USING btree (user_id);


--
-- Name: idx_scheduled_messages_announcement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_messages_announcement_id ON public.scheduled_messages USING btree (announcement_id);


--
-- Name: idx_scheduled_messages_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_messages_is_active ON public.scheduled_messages USING btree (is_active);


--
-- Name: idx_scheduled_messages_next_run_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_messages_next_run_time ON public.scheduled_messages USING btree (next_run_time);


--
-- Name: idx_send_batch_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_batch_institute ON public.send_batch USING btree (institute_id);


--
-- Name: idx_send_batch_institute_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_batch_institute_created ON public.send_batch USING btree (institute_id, created_at DESC);


--
-- Name: idx_send_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_batch_status ON public.send_batch USING btree (status);


--
-- Name: idx_template_day_map_channel_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_day_map_channel_type ON public.notification_template_day_map USING btree (channel_type);


--
-- Name: idx_template_day_map_notification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_day_map_notification_type ON public.notification_template_day_map USING btree (notification_type);


--
-- Name: idx_user_announcement_settings_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_announcement_settings_channel ON public.user_announcement_settings USING btree (channel);


--
-- Name: idx_user_announcement_settings_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_announcement_settings_institute ON public.user_announcement_settings USING btree (institute_id);


--
-- Name: idx_user_announcement_settings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_announcement_settings_user ON public.user_announcement_settings USING btree (user_id);


--
-- Name: idx_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_id ON public.fcm_tokens USING btree (user_id);


--
-- Name: idx_wa_template_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_template_institute ON public.notification_template USING btree (institute_id, status);


--
-- Name: idx_wa_template_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_wa_template_name ON public.notification_template USING btree (institute_id, name, language);


--
-- Name: uq_email_address_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_email_address_mapping ON public.email_address_mapping USING btree (email_address, institute_id);


--
-- Name: announcement_community announcement_community_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_community
    ADD CONSTRAINT announcement_community_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_dashboard_pins announcement_dashboard_pins_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_dashboard_pins
    ADD CONSTRAINT announcement_dashboard_pins_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_dms announcement_dms_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_dms
    ADD CONSTRAINT announcement_dms_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_mediums announcement_mediums_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_mediums
    ADD CONSTRAINT announcement_mediums_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_recipients announcement_recipients_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_recipients
    ADD CONSTRAINT announcement_recipients_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_resources announcement_resources_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_resources
    ADD CONSTRAINT announcement_resources_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_streams announcement_streams_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_streams
    ADD CONSTRAINT announcement_streams_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_system_alerts announcement_system_alerts_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_system_alerts
    ADD CONSTRAINT announcement_system_alerts_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_tasks announcement_tasks_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_tasks
    ADD CONSTRAINT announcement_tasks_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_rich_text_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_rich_text_id_fkey FOREIGN KEY (rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE CASCADE;


--
-- Name: chatbot_delay_task fk_chatbot_delay_task_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_delay_task
    ADD CONSTRAINT fk_chatbot_delay_task_session FOREIGN KEY (session_id) REFERENCES public.chatbot_flow_session(id);


--
-- Name: chatbot_flow_edge fk_chatbot_flow_edge_flow; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_edge
    ADD CONSTRAINT fk_chatbot_flow_edge_flow FOREIGN KEY (flow_id) REFERENCES public.chatbot_flow(id) ON DELETE CASCADE;


--
-- Name: chatbot_flow_edge fk_chatbot_flow_edge_source; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_edge
    ADD CONSTRAINT fk_chatbot_flow_edge_source FOREIGN KEY (source_node_id) REFERENCES public.chatbot_flow_node(id) ON DELETE CASCADE;


--
-- Name: chatbot_flow_edge fk_chatbot_flow_edge_target; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_edge
    ADD CONSTRAINT fk_chatbot_flow_edge_target FOREIGN KEY (target_node_id) REFERENCES public.chatbot_flow_node(id) ON DELETE CASCADE;


--
-- Name: chatbot_flow_node fk_chatbot_flow_node_flow; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_node
    ADD CONSTRAINT fk_chatbot_flow_node_flow FOREIGN KEY (flow_id) REFERENCES public.chatbot_flow(id) ON DELETE CASCADE;


--
-- Name: chatbot_flow_session fk_chatbot_flow_session_flow; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_flow_session
    ADD CONSTRAINT fk_chatbot_flow_session_flow FOREIGN KEY (flow_id) REFERENCES public.chatbot_flow(id);


--
-- Name: task_execution_audit fk_task_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT fk_task_id FOREIGN KEY (task_id) REFERENCES public.scheduler_activity_log(id);


--
-- Name: message_interactions message_interactions_recipient_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_interactions
    ADD CONSTRAINT message_interactions_recipient_message_id_fkey FOREIGN KEY (recipient_message_id) REFERENCES public.recipient_messages(id) ON DELETE CASCADE;


--
-- Name: message_replies message_replies_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_replies
    ADD CONSTRAINT message_replies_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: message_replies message_replies_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_replies
    ADD CONSTRAINT message_replies_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.message_replies(id) ON DELETE CASCADE;


--
-- Name: message_replies message_replies_rich_text_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_replies
    ADD CONSTRAINT message_replies_rich_text_id_fkey FOREIGN KEY (rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE CASCADE;


--
-- Name: recipient_messages recipient_messages_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipient_messages
    ADD CONSTRAINT recipient_messages_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: scheduled_messages scheduled_messages_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: flyway_schema_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) FROM stdin;
1	1	<< Flyway Baseline >>	BASELINE	<< Flyway Baseline >>	\N	postgres	2025-08-21 10:29:32.382619	0	t
2	2	Email status	SQL	V2__Email_status.sql	2144889548	postgres	2025-09-23 17:28:12.557839	252	t
3	3	Drop email status	SQL	V3__Drop_email_status.sql	2085836084	postgres	2025-09-24 10:22:38.911759	152	t
4	4	external communication logs	SQL	V4__external_communication_logs.sql	-398155295	postgres	2025-11-10 11:51:47.574802	392	t
5	5	user announcement settings	SQL	V5__user_announcement_settings.sql	-618459519	postgres	2025-11-10 12:50:28.155699	256	t
6	6	update user announcement settings	SQL	V6__update_user_announcement_settings.sql	206199327	postgres	2025-11-10 18:14:36.538813	387	t
7	7	add channel setting in institute	SQL	V7__add_channel_setting_in_institute.sql	1223931647	postgres	2025-12-13 14:34:23.772302	776	t
8	8	add engagement trigger config	SQL	V8__add_engagement_trigger_config.sql	1237863894	postgres	2025-12-23 17:00:15.6996	540	t
9	9	add previous template message	SQL	V9__add_previous_template_message.sql	-1401724023	postgres	2025-12-23 17:45:08.830156	576	t
10	10	Create notification template day map	SQL	V10__Create_notification_template_day_map.sql	-1963907477	postgres	2026-01-06 16:38:17.105049	306	t
11	11	Add notification type and channel type to template day map	SQL	V11__Add_notification_type_and_channel_type_to_template_day_map.sql	266386288	postgres	2026-01-06 18:14:42.394233	395	t
13	13	remove constraints from map table	SQL	V13__remove_constraints_from_map_table.sql	-1369219062	postgres	2026-01-08 12:59:50.921247	148	t
14	14	Add fixed variables to channel flow config	SQL	V14__Add_fixed_variables_to_channel_flow_config.sql	-1542216233	postgres	2026-01-09 14:24:25.569136	289	t
15	12	add otp type and phone number	SQL	V12__add_otp_type_and_phone_number.sql	1705217973	postgres	2026-01-15 11:37:20.299199	160	t
16	15	add action template config	SQL	V15__add_action_template_config.sql	1143789097	postgres	2026-01-19 18:16:25.705311	171	t
17	16	Create bounced emails table	SQL	V16__Create_bounced_emails_table.sql	-690200743	postgres	2026-01-19 18:18:40.725968	523	t
18	17	Create chatbot flow tables	SQL	V17__Create_chatbot_flow_tables.sql	1639556288	akmadmin	2026-03-26 19:58:24.27436	303	t
19	18	Add inbox support	SQL	V18__Add_inbox_support.sql	1740978842	akmadmin	2026-03-27 13:11:02.077942	583	t
20	19	Create whatsapp template table	SQL	V19__Create_whatsapp_template_table.sql	-2021666963	akmadmin	2026-03-27 14:19:29.065848	100	t
21	20	Create send batch table	SQL	V20__Create_send_batch_table.sql	-859465309	akmadmin	2026-03-28 07:11:08.193123	190	t
22	21	Add body variable names to whatsapp template	SQL	V21__Add_body_variable_names_to_whatsapp_template.sql	976910635	akmadmin	2026-03-28 15:23:09.820887	90	t
23	22	Rename whatsapp template to notification template	SQL	V22__Rename_whatsapp_template_to_notification_template.sql	1304733213	akmadmin	2026-03-28 15:23:10.426917	111	t
24	23	Add channel fields to chatbot session	SQL	V23__Add_channel_fields_to_chatbot_session.sql	-707875715	akmadmin	2026-04-07 16:59:01.825832	92	t
25	24	Create email address mapping	SQL	V24__Create_email_address_mapping.sql	214592072	akmadmin	2026-04-27 06:45:37.519952	103	t
26	25	Add send batch institute created index	SQL	V25__Add_send_batch_institute_created_index.sql	1790941602	akmadmin	2026-05-08 20:26:05.476894	143	t
27	26	add institute id to notification log	SQL	V26__add_institute_id_to_notification_log.sql	1447571758	akmadmin	2026-05-22 18:40:24.572632	9103	t
\.


--
-- PostgreSQL database dump complete
--


