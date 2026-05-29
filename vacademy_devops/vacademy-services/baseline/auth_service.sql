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


--
-- Name: user_gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_gender AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER'
);


--
-- Name: trim_and_lowercase_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_and_lowercase_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    column_name TEXT;
BEGIN
    -- Get the column name from the trigger argument
    IF TG_NARGS > 0 THEN
        column_name := TG_ARGV[0];
        
        -- Dynamically trim and lowercase the specified column
        EXECUTE format('
            SELECT $1.%I := LOWER(TRIM($1.%I))',
            column_name, column_name
        ) USING NEW;
    END IF;
    
    RETURN NEW;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_on_user_task(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_on_user_task() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: client_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_credentials (
    id character varying(255) NOT NULL,
    client_name character varying(255),
    token character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
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
-- Name: daily_user_activity_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_user_activity_summary (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    institute_id uuid NOT NULL,
    activity_date date NOT NULL,
    total_sessions integer DEFAULT 0,
    total_activity_time_minutes bigint DEFAULT 0,
    total_api_calls integer DEFAULT 0,
    unique_services_used integer DEFAULT 0,
    first_activity_time timestamp without time zone,
    last_activity_time timestamp without time zone,
    services_used character varying(1000),
    device_types_used character varying(500),
    peak_activity_hour integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE daily_user_activity_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.daily_user_activity_summary IS 'Daily aggregated user activity statistics for efficient reporting';


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
-- Name: institute_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_settings (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    user_identifier character varying(20) DEFAULT 'EMAIL'::character varying,
    settings_json text DEFAULT '{}'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: oauth2_vendor_to_user_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth2_vendor_to_user_detail (
    id character varying NOT NULL,
    email_id character varying(255),
    provider_id character varying(100),
    subject character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id character varying(255) NOT NULL,
    permission_name character varying(255) NOT NULL,
    tag character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: refresh_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_token (
    id character varying(255) NOT NULL,
    expiry_date timestamp(6) with time zone,
    token character varying(255),
    user_id character varying(255),
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    client_name character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permission (
    role_id character varying(255),
    permission_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id character varying(255) NOT NULL,
    role_name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    institute_id character varying(255) DEFAULT NULL::character varying
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
-- Name: user_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_log (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    institute_id character varying(36),
    service_name character varying(100),
    endpoint character varying(500),
    action_type character varying(50),
    session_id character varying(255),
    ip_address character varying(45),
    user_agent character varying(500),
    device_type character varying(50),
    response_status integer,
    response_time_ms bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE user_activity_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_activity_log IS 'Detailed log of all user activities across services';


--
-- Name: user_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permission (
    user_id character varying(255),
    permission_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    institute_id character varying(255),
    id character varying(255) NOT NULL
);


--
-- Name: user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role (
    user_id character varying(255),
    role_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    institute_id character varying(255),
    id character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'ACTIVE'::character varying,
    source_type character varying(255),
    source_id character varying(255)
);


--
-- Name: user_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_session (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    institute_id character varying(36),
    session_token character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent character varying(500),
    device_type character varying(50),
    device_id character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    login_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_activity_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    logout_time timestamp without time zone,
    session_duration_minutes bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE user_session; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_session IS 'Active user sessions and session history';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255),
    address_line character varying(255),
    city character varying(255),
    pin_code character varying(10),
    mobile_number character varying(25),
    date_of_birth date,
    gender character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_root_user boolean DEFAULT false,
    profile_pic_file_id character varying(255),
    last_token_update_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_parent boolean DEFAULT false,
    linked_parent_id character varying(255)
);


--
-- Name: COLUMN users.is_parent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.is_parent IS 'Indicates if this user is a parent/guardian';


--
-- Name: COLUMN users.linked_parent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.linked_parent_id IS 'Reference to parent user ID for child users';


--
-- Name: vimotion_invite_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vimotion_invite_code (
    id character varying(64) NOT NULL,
    code character varying(32) NOT NULL,
    kind character varying(16) NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    locked_email character varying(255),
    locked_phone_number character varying(32),
    waitlist_id character varying(64),
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp without time zone,
    note text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: vimotion_invite_redemption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vimotion_invite_redemption (
    id character varying(64) NOT NULL,
    invite_code_id character varying(64) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(32) NOT NULL,
    user_id character varying(255),
    institute_id character varying(255),
    redeemed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: vimotion_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vimotion_waitlist (
    id character varying(64) NOT NULL,
    full_name character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    referrer_id character varying(64),
    referral_code character varying(16) NOT NULL,
    referral_count integer DEFAULT 0 NOT NULL,
    "position" integer NOT NULL,
    source character varying(64),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: vimotion_waitlist_position_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vimotion_waitlist_position_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: client_credentials client_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_credentials
    ADD CONSTRAINT client_credentials_pkey PRIMARY KEY (id);


--
-- Name: client_secret_key client_secret_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_secret_key
    ADD CONSTRAINT client_secret_key_pkey PRIMARY KEY (client_name);


--
-- Name: daily_user_activity_summary daily_user_activity_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_user_activity_summary
    ADD CONSTRAINT daily_user_activity_summary_pkey PRIMARY KEY (id);


--
-- Name: daily_user_activity_summary daily_user_activity_summary_user_id_institute_id_activity_d_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_user_activity_summary
    ADD CONSTRAINT daily_user_activity_summary_user_id_institute_id_activity_d_key UNIQUE (user_id, institute_id, activity_date);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: institute_settings institute_settings_institute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_settings
    ADD CONSTRAINT institute_settings_institute_id_key UNIQUE (institute_id);


--
-- Name: institute_settings institute_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_settings
    ADD CONSTRAINT institute_settings_pkey PRIMARY KEY (id);


--
-- Name: oauth2_vendor_to_user_detail oauth2_vendor_to_user_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth2_vendor_to_user_detail
    ADD CONSTRAINT oauth2_vendor_to_user_detail_pkey PRIMARY KEY (id);


--
-- Name: permissions pk_permissions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT pk_permissions PRIMARY KEY (id);


--
-- Name: roles pk_roles; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT pk_roles PRIMARY KEY (id);


--
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- Name: refresh_token refresh_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT refresh_token_pkey PRIMARY KEY (id);


--
-- Name: scheduler_activity_log scheduler_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_activity_log
    ADD CONSTRAINT scheduler_activity_log_pkey PRIMARY KEY (id);


--
-- Name: task_execution_audit task_execution_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT task_execution_audit_pkey PRIMARY KEY (id);


--
-- Name: refresh_token uk_f95ixxe7pa48ryn1awmh2evt7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT uk_f95ixxe7pa48ryn1awmh2evt7 UNIQUE (user_id);


--
-- Name: permissions uk_permissions_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT uk_permissions_name UNIQUE (permission_name);


--
-- Name: roles uk_roles_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT uk_roles_name UNIQUE (role_name);


--
-- Name: users uk_users_username; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk_users_username UNIQUE (username);


--
-- Name: user_activity_log user_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_log
    ADD CONSTRAINT user_activity_log_pkey PRIMARY KEY (id);


--
-- Name: user_permission user_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission
    ADD CONSTRAINT user_permission_pkey PRIMARY KEY (id);


--
-- Name: user_role user_role_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_pk PRIMARY KEY (id);


--
-- Name: user_session user_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session
    ADD CONSTRAINT user_session_pkey PRIMARY KEY (id);


--
-- Name: vimotion_invite_code vimotion_invite_code_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_invite_code
    ADD CONSTRAINT vimotion_invite_code_code_key UNIQUE (code);


--
-- Name: vimotion_invite_code vimotion_invite_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_invite_code
    ADD CONSTRAINT vimotion_invite_code_pkey PRIMARY KEY (id);


--
-- Name: vimotion_invite_redemption vimotion_invite_redemption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_invite_redemption
    ADD CONSTRAINT vimotion_invite_redemption_pkey PRIMARY KEY (id);


--
-- Name: vimotion_waitlist vimotion_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_waitlist
    ADD CONSTRAINT vimotion_waitlist_pkey PRIMARY KEY (id);


--
-- Name: vimotion_waitlist vimotion_waitlist_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_waitlist
    ADD CONSTRAINT vimotion_waitlist_referral_code_key UNIQUE (referral_code);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_activity_log_analytics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_analytics ON public.user_activity_log USING btree (institute_id, created_at, user_id);


--
-- Name: idx_client_credentials_client_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_credentials_client_name ON public.client_credentials USING btree (client_name);


--
-- Name: idx_client_credentials_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_credentials_created_at ON public.client_credentials USING btree (created_at DESC);


--
-- Name: idx_client_credentials_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_credentials_token ON public.client_credentials USING btree (token);


--
-- Name: idx_complete_role_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_complete_role_resolution ON public.user_role USING btree (user_id, institute_id, role_id, status, created_at) WHERE ((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('PENDING'::character varying)::text]));


--
-- Name: idx_daily_activity_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_activity_institute_date ON public.daily_user_activity_summary USING btree (institute_id, activity_date);


--
-- Name: idx_daily_activity_user_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_activity_user_institute_date ON public.daily_user_activity_summary USING btree (user_id, institute_id, activity_date);


--
-- Name: idx_daily_summary_activity_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_summary_activity_date ON public.daily_user_activity_summary USING btree (activity_date);


--
-- Name: idx_daily_summary_analytics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_summary_analytics ON public.daily_user_activity_summary USING btree (institute_id, activity_date, total_sessions);


--
-- Name: idx_daily_summary_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_summary_institute_date ON public.daily_user_activity_summary USING btree (institute_id, activity_date);


--
-- Name: idx_daily_summary_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_summary_institute_id ON public.daily_user_activity_summary USING btree (institute_id);


--
-- Name: idx_daily_summary_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_summary_user_id ON public.daily_user_activity_summary USING btree (user_id);


--
-- Name: idx_failed_login_tracking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_failed_login_tracking ON public.user_activity_log USING btree (user_id, created_at, response_status) WHERE (response_status >= 400);


--
-- Name: idx_ip_activity_tracking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ip_activity_tracking ON public.user_activity_log USING btree (ip_address, created_at) WHERE (ip_address IS NOT NULL);


--
-- Name: idx_oauth2_vendor_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth2_vendor_provider_id ON public.oauth2_vendor_to_user_detail USING btree (provider_id);


--
-- Name: idx_oauth2_vendor_provider_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth2_vendor_provider_subject ON public.oauth2_vendor_to_user_detail USING btree (provider_id, subject);


--
-- Name: idx_permission_resolution_user_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_resolution_user_institute ON public.user_permission USING btree (user_id, institute_id, permission_id);


--
-- Name: idx_permissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_created_at ON public.permissions USING btree (created_at DESC);


--
-- Name: idx_permissions_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_name ON public.permissions USING btree (permission_name);


--
-- Name: idx_permissions_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_tag ON public.permissions USING btree (tag) WHERE (tag IS NOT NULL);


--
-- Name: idx_rbac_complete_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_complete_lookup ON public.user_role USING btree (user_id, role_id, institute_id, status) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_realtime_session_mgmt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_realtime_session_mgmt ON public.user_session USING btree (user_id, is_active, session_token, last_activity_time) WHERE (is_active = true);


--
-- Name: idx_refresh_token_client_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_token_client_name ON public.refresh_token USING btree (client_name) WHERE (client_name IS NOT NULL);


--
-- Name: idx_refresh_token_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_token_expiry ON public.refresh_token USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);


--
-- Name: idx_refresh_token_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_token_token ON public.refresh_token USING btree (token);


--
-- Name: idx_refresh_token_user_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_token_user_client ON public.refresh_token USING btree (user_id, client_name);


--
-- Name: idx_refresh_token_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_token_user_id ON public.refresh_token USING btree (user_id);


--
-- Name: idx_role_permission_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permission_composite ON public.role_permission USING btree (role_id, permission_id);


--
-- Name: idx_role_permission_permission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permission_permission_id ON public.role_permission USING btree (permission_id);


--
-- Name: idx_role_permission_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permission_role_id ON public.role_permission USING btree (role_id);


--
-- Name: idx_roles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_created_at ON public.roles USING btree (created_at DESC);


--
-- Name: idx_roles_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_institute_id ON public.roles USING btree (institute_id);


--
-- Name: idx_roles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_name ON public.roles USING btree (role_name);


--
-- Name: idx_session_analytics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_analytics ON public.user_session USING btree (institute_id, is_active, last_activity_time);


--
-- Name: idx_session_duration_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_duration_analysis ON public.user_session USING btree (user_id, session_duration_minutes, login_time) WHERE (session_duration_minutes IS NOT NULL);


--
-- Name: idx_session_validation_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_validation_lookup ON public.user_session USING btree (session_token, is_active, last_activity_time) WHERE (is_active = true);


--
-- Name: idx_ultra_fast_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ultra_fast_auth ON public.users USING btree (username, email, password_hash, is_root_user);


--
-- Name: idx_user_activity_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_created_at ON public.user_activity_log USING btree (created_at);


--
-- Name: idx_user_activity_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_institute_id ON public.user_activity_log USING btree (institute_id);


--
-- Name: idx_user_activity_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_created_at ON public.user_activity_log USING btree (created_at DESC);


--
-- Name: idx_user_activity_log_device_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_device_type ON public.user_activity_log USING btree (device_type) WHERE (device_type IS NOT NULL);


--
-- Name: idx_user_activity_log_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_institute_date ON public.user_activity_log USING btree (institute_id, created_at DESC) WHERE (institute_id IS NOT NULL);


--
-- Name: idx_user_activity_log_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_institute_id ON public.user_activity_log USING btree (institute_id) WHERE (institute_id IS NOT NULL);


--
-- Name: idx_user_activity_log_performance_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_performance_analysis ON public.user_activity_log USING btree (service_name, institute_id, response_time_ms, created_at) WHERE ((response_time_ms IS NOT NULL) AND (institute_id IS NOT NULL));


--
-- Name: idx_user_activity_log_response_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_response_status ON public.user_activity_log USING btree (response_status) WHERE (response_status IS NOT NULL);


--
-- Name: idx_user_activity_log_response_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_response_time ON public.user_activity_log USING btree (response_time_ms) WHERE (response_time_ms IS NOT NULL);


--
-- Name: idx_user_activity_log_service_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_service_institute_date ON public.user_activity_log USING btree (service_name, institute_id, created_at DESC) WHERE (service_name IS NOT NULL);


--
-- Name: idx_user_activity_log_service_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_service_name ON public.user_activity_log USING btree (service_name) WHERE (service_name IS NOT NULL);


--
-- Name: idx_user_activity_log_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_session_id ON public.user_activity_log USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_user_activity_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_user_id ON public.user_activity_log USING btree (user_id);


--
-- Name: idx_user_activity_log_user_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_user_institute_date ON public.user_activity_log USING btree (user_id, institute_id, created_at DESC);


--
-- Name: idx_user_activity_log_user_service_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_log_user_service_date ON public.user_activity_log USING btree (user_id, service_name, created_at DESC) WHERE (service_name IS NOT NULL);


--
-- Name: idx_user_activity_service_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_service_name ON public.user_activity_log USING btree (service_name);


--
-- Name: idx_user_activity_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_session_id ON public.user_activity_log USING btree (session_id);


--
-- Name: idx_user_activity_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_user_id ON public.user_activity_log USING btree (user_id);


--
-- Name: idx_user_activity_user_institute_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activity_user_institute_date ON public.user_activity_log USING btree (user_id, institute_id, created_at);


--
-- Name: idx_user_permission_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_created_at ON public.user_permission USING btree (created_at DESC);


--
-- Name: idx_user_permission_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_institute_id ON public.user_permission USING btree (institute_id) WHERE (institute_id IS NOT NULL);


--
-- Name: idx_user_permission_permission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_permission_id ON public.user_permission USING btree (permission_id);


--
-- Name: idx_user_permission_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_user_id ON public.user_permission USING btree (user_id);


--
-- Name: idx_user_permission_user_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_user_institute ON public.user_permission USING btree (user_id, institute_id);


--
-- Name: idx_user_role_composite_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_composite_lookup ON public.user_role USING btree (user_id, role_id, institute_id);


--
-- Name: idx_user_role_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_created_at ON public.user_role USING btree (created_at DESC);


--
-- Name: idx_user_role_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_institute_id ON public.user_role USING btree (institute_id) WHERE (institute_id IS NOT NULL);


--
-- Name: idx_user_role_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_role_id ON public.user_role USING btree (role_id);


--
-- Name: idx_user_role_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_source_id ON public.user_role USING btree (source_id);


--
-- Name: idx_user_role_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_source_type ON public.user_role USING btree (source_type);


--
-- Name: idx_user_role_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_status ON public.user_role USING btree (status);


--
-- Name: idx_user_role_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_user_id ON public.user_role USING btree (user_id);


--
-- Name: idx_user_role_user_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_user_institute ON public.user_role USING btree (user_id, institute_id, status);


--
-- Name: idx_user_role_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_user_status ON public.user_role USING btree (user_id, status);


--
-- Name: idx_user_session_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_active ON public.user_session USING btree (is_active);


--
-- Name: idx_user_session_active_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_active_token ON public.user_session USING btree (session_token, is_active) WHERE (is_active = true);


--
-- Name: idx_user_session_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_device_id ON public.user_session USING btree (device_id) WHERE (device_id IS NOT NULL);


--
-- Name: idx_user_session_device_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_device_type ON public.user_session USING btree (device_type) WHERE (device_type IS NOT NULL);


--
-- Name: idx_user_session_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_institute_id ON public.user_session USING btree (institute_id);


--
-- Name: idx_user_session_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_is_active ON public.user_session USING btree (is_active);


--
-- Name: idx_user_session_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_last_activity ON public.user_session USING btree (last_activity_time);


--
-- Name: idx_user_session_login_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_login_time ON public.user_session USING btree (login_time);


--
-- Name: idx_user_session_logout_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_logout_time ON public.user_session USING btree (logout_time) WHERE (logout_time IS NOT NULL);


--
-- Name: idx_user_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_token ON public.user_session USING btree (session_token);


--
-- Name: idx_user_session_user_active_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_user_active_login ON public.user_session USING btree (user_id, institute_id, is_active, login_time DESC);


--
-- Name: idx_user_session_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_user_id ON public.user_session USING btree (user_id);


--
-- Name: idx_user_session_user_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_user_institute ON public.user_session USING btree (user_id, institute_id);


--
-- Name: idx_users_auth_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_lookup ON public.users USING btree (username, email, is_root_user) WHERE (is_root_user = true);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_created_at ON public.users USING btree (email, created_at DESC);


--
-- Name: idx_users_full_name_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_full_name_gin ON public.users USING gin (to_tsvector('english'::regconfig, (full_name)::text)) WHERE (full_name IS NOT NULL);


--
-- Name: idx_users_is_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_parent ON public.users USING btree (is_parent) WHERE (is_parent = true);


--
-- Name: idx_users_is_root_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_root_user ON public.users USING btree (is_root_user) WHERE (is_root_user = true);


--
-- Name: idx_users_last_token_update; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_token_update ON public.users USING btree (last_token_update_time) WHERE (last_token_update_time IS NOT NULL);


--
-- Name: idx_users_linked_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_linked_parent_id ON public.users USING btree (linked_parent_id) WHERE (linked_parent_id IS NOT NULL);


--
-- Name: idx_users_mobile_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_mobile_number ON public.users USING btree (mobile_number) WHERE (mobile_number IS NOT NULL);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_vimotion_invite_code_locked_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vimotion_invite_code_locked_email ON public.vimotion_invite_code USING btree (lower((locked_email)::text)) WHERE ((kind)::text = 'locked'::text);


--
-- Name: idx_vimotion_invite_code_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vimotion_invite_code_status ON public.vimotion_invite_code USING btree (status);


--
-- Name: idx_vimotion_invite_redemption_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vimotion_invite_redemption_code ON public.vimotion_invite_redemption USING btree (invite_code_id);


--
-- Name: idx_vimotion_waitlist_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vimotion_waitlist_referral_code ON public.vimotion_waitlist USING btree (referral_code);


--
-- Name: idx_vimotion_waitlist_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vimotion_waitlist_status ON public.vimotion_waitlist USING btree (status);


--
-- Name: uq_vimotion_waitlist_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_vimotion_waitlist_email_lower ON public.vimotion_waitlist USING btree (lower((email)::text));


--
-- Name: user_session update_user_session_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_session_updated_at BEFORE UPDATE ON public.user_session FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: client_secret_key update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.client_secret_key FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: permissions update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: role_permission update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.role_permission FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: roles update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: user_permission update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.user_permission FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: user_role update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.user_role FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: users update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: role_permission fk_permission_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT fk_permission_id FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: user_permission fk_permission_id_user_permission; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission
    ADD CONSTRAINT fk_permission_id_user_permission FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permission fk_role_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT fk_role_id FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_role fk_role_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT fk_role_id FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: task_execution_audit fk_task_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT fk_task_id FOREIGN KEY (task_id) REFERENCES public.scheduler_activity_log(id);


--
-- Name: user_role fk_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permission fk_user_id_user_permission; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission
    ADD CONSTRAINT fk_user_id_user_permission FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users fk_users_linked_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_linked_parent FOREIGN KEY (linked_parent_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vimotion_invite_code fk_vimotion_invite_waitlist; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_invite_code
    ADD CONSTRAINT fk_vimotion_invite_waitlist FOREIGN KEY (waitlist_id) REFERENCES public.vimotion_waitlist(id);


--
-- Name: refresh_token fkjtx87i0jvq2svedphegvdwcuy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT fkjtx87i0jvq2svedphegvdwcuy FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vimotion_invite_redemption vimotion_invite_redemption_invite_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_invite_redemption
    ADD CONSTRAINT vimotion_invite_redemption_invite_code_id_fkey FOREIGN KEY (invite_code_id) REFERENCES public.vimotion_invite_code(id);


--
-- Name: vimotion_waitlist vimotion_waitlist_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vimotion_waitlist
    ADD CONSTRAINT vimotion_waitlist_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.vimotion_waitlist(id);


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
1	1	<< Flyway Baseline >>	BASELINE	<< Flyway Baseline >>	\N	postgres	2025-08-21 05:52:23.550658	0	t
2	2	add created updated columns oauth	SQL	V2__add_created_updated_columns_oauth.sql	-1387236954	postgres	2025-09-24 09:54:37.371433	117	t
3	3	add last login time col	SQL	V3__add_last_login_time_col.sql	-937972433	postgres	2025-10-29 06:32:47.848615	105	t
4	4	alter users set last login to default	SQL	V4__alter_users_set_last_login_to_default.sql	-1826818619	postgres	2025-10-30 14:30:10.961219	141	t
5	5	Add parent child fields to users	SQL	V5__Add_parent_child_fields_to_users.sql	-758590722	postgres	2026-01-16 17:28:37.083839	324	t
6	6	Add source columns to user role	SQL	V6__Add_source_columns_to_user_role.sql	-867150250	akmadmin	2026-02-11 14:43:10.367064	463	t
7	7	add institute id column roles	SQL	V7__add_institute_id_column_roles.sql	-1382612435	akmadmin	2026-02-12 18:49:57.177794	56	t
8	8	add institute settings	SQL	V8__add_institute_settings.sql	-566859489	akmadmin	2026-02-26 05:11:45.115618	89	t
9	9	Create super admin user	SQL	V9__Create_super_admin_user.sql	-943385982	akmadmin	2026-03-11 17:12:34.091079	82	t
10	10	Create vimotion invite codes	SQL	V10__Create_vimotion_invite_codes.sql	-288746495	akmadmin	2026-05-23 07:17:50.6857	104	t
11	11	Create vimotion waitlist	SQL	V11__Create_vimotion_waitlist.sql	468074376	akmadmin	2026-05-23 10:35:55.387771	90	t
\.


--
-- PostgreSQL database dump complete
--


