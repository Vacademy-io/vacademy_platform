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
-- Name: set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := now();
        NEW.updated_at := now();
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.updated_at := now();
    END IF;
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
-- Name: backend_base_url; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backend_base_url (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(255) NOT NULL,
    base_url character varying(500) NOT NULL,
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
-- Name: evaluation_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_user (
    id character varying(255),
    source_id character varying(255),
    source_type character varying(255),
    response_json text,
    user_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: file_conversion_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_conversion_status (
    id character varying(255) NOT NULL,
    file_id character varying(255),
    status character varying(255),
    vendor_file_id character varying(255),
    html_text text,
    file_type character varying(255),
    vendor character varying(255),
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: file_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_metadata (
    id character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size bigint,
    key character varying(255) NOT NULL,
    source character varying(255) NOT NULL,
    source_id character varying(255) NOT NULL,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    width double precision,
    height double precision
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
-- Name: short_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.short_links (
    id character varying(255) NOT NULL,
    short_name character varying(255) NOT NULL,
    destination_url text NOT NULL,
    status character varying(50) NOT NULL,
    source character varying(255),
    source_id character varying(255),
    last_queried_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
-- Name: task_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_status (
    id character varying(255) NOT NULL,
    type character varying(255),
    status character varying(255),
    institute_id character varying(255),
    result_json text,
    input_id character varying(255),
    input_type character varying(255),
    task_name character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_id character varying(255),
    dynamic_values_map text,
    status_message text
);


--
-- Name: user_to_file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_to_file (
    id character varying(255) NOT NULL,
    file_id character varying(255) NOT NULL,
    folder_icon character varying(255),
    folder_name character varying(255),
    user_id character varying(255) NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_id character varying(255),
    status character varying(255),
    source_type character varying(255)
);


--
-- Name: backend_base_url backend_base_url_institute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backend_base_url
    ADD CONSTRAINT backend_base_url_institute_id_key UNIQUE (institute_id);


--
-- Name: backend_base_url backend_base_url_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backend_base_url
    ADD CONSTRAINT backend_base_url_pkey PRIMARY KEY (id);


--
-- Name: client_secret_key client_secret_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_secret_key
    ADD CONSTRAINT client_secret_key_pkey PRIMARY KEY (client_name);


--
-- Name: file_conversion_status file_conversion_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_conversion_status
    ADD CONSTRAINT file_conversion_status_pkey PRIMARY KEY (id);


--
-- Name: file_metadata file_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_metadata
    ADD CONSTRAINT file_metadata_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: scheduler_activity_log scheduler_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_activity_log
    ADD CONSTRAINT scheduler_activity_log_pkey PRIMARY KEY (id);


--
-- Name: short_links short_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_pkey PRIMARY KEY (id);


--
-- Name: short_links short_links_short_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_short_name_key UNIQUE (short_name);


--
-- Name: task_execution_audit task_execution_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT task_execution_audit_pkey PRIMARY KEY (id);


--
-- Name: task_status task_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_status
    ADD CONSTRAINT task_status_pkey PRIMARY KEY (id);


--
-- Name: user_to_file user_to_file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_to_file
    ADD CONSTRAINT user_to_file_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_short_links_destination_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_short_links_destination_url ON public.short_links USING btree (destination_url);


--
-- Name: idx_short_links_short_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_short_links_short_name ON public.short_links USING btree (short_name);


--
-- Name: task_status set_task_status_timestamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_task_status_timestamps BEFORE INSERT ON public.task_status FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();


--
-- Name: file_metadata update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.file_metadata FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: user_to_file update_user_to_file_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_to_file_updated_on BEFORE UPDATE ON public.user_to_file FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: user_to_file fk_file_id_user_to_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_to_file
    ADD CONSTRAINT fk_file_id_user_to_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id);


--
-- Name: user_to_file fk_folder_icon_user_to_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_to_file
    ADD CONSTRAINT fk_folder_icon_user_to_file FOREIGN KEY (folder_icon) REFERENCES public.file_metadata(id);


--
-- Name: task_execution_audit fk_task_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT fk_task_id FOREIGN KEY (task_id) REFERENCES public.scheduler_activity_log(id);


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
1	1	<< Flyway Baseline >>	BASELINE	<< Flyway Baseline >>	\N	postgres	2025-08-21 05:55:12.829313	0	t
2	2	url shortener schema	SQL	V2__url_shortener_schema.sql	88180857	akmadmin	2026-02-12 15:28:55.019855	304	t
3	3	institute short link domains	SQL	V3__institute_short_link_domains.sql	-1123470766	akmadmin	2026-03-10 14:33:25.590314	209	t
\.


--
-- PostgreSQL database dump complete
--


