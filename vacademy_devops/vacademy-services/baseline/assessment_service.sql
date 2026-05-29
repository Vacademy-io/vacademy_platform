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
-- Name: set_timestamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := NOW();
        NEW.updated_at := NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_evaluation_process; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_evaluation_process (
    id character varying(36) NOT NULL,
    attempt_id character varying(36) NOT NULL,
    assessment_id character varying(36) NOT NULL,
    set_id character varying(36),
    status character varying(50) NOT NULL,
    current_section_id character varying(36),
    current_question_index integer DEFAULT 0,
    total_questions integer,
    evaluation_json text,
    error_message text,
    retry_count integer DEFAULT 0,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    current_step character varying(50),
    questions_completed integer DEFAULT 0,
    questions_total integer DEFAULT 0
);


--
-- Name: COLUMN ai_evaluation_process.current_step; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_evaluation_process.current_step IS 'Current detailed step: PROCESSING, EXTRACTION, CRITERIA_GENERATION, GRADING, STORING_RESULTS';


--
-- Name: COLUMN ai_evaluation_process.questions_completed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_evaluation_process.questions_completed IS 'Number of questions completed';


--
-- Name: COLUMN ai_evaluation_process.questions_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_evaluation_process.questions_total IS 'Total number of questions to evaluate';


--
-- Name: ai_question_evaluation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_question_evaluation (
    id character varying(36) NOT NULL,
    evaluation_process_id character varying(36) NOT NULL,
    question_id character varying(36) NOT NULL,
    question_wise_marks_id character varying(36),
    question_number integer,
    evaluation_result_json text,
    marks_awarded numeric(10,2),
    max_marks numeric(10,2),
    feedback text,
    extracted_answer text,
    status character varying(50) NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: assessment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    about_id character varying(255),
    instructions_id character varying(255),
    play_mode character varying(50) NOT NULL,
    evaluation_type character varying(50) NOT NULL,
    duration_distribution character varying(50) DEFAULT 'ASSESSMENT'::character varying,
    can_switch_section boolean NOT NULL,
    assessment_visibility character varying(50) NOT NULL,
    registration_close_date timestamp without time zone,
    registration_open_date timestamp without time zone,
    expected_participants integer,
    cover_file_id integer,
    bound_start_time timestamp without time zone,
    bound_end_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    duration integer,
    status character varying(255),
    preview_time integer,
    submission_type character varying(255),
    can_request_reattempt boolean,
    can_request_time_increase boolean,
    omr_mode boolean,
    reattempt_count integer DEFAULT 1,
    source character varying(255),
    source_id character varying(255),
    assessment_type character varying(255),
    result_type character varying(50) DEFAULT 'MANUAL'::character varying,
    registration_instructions_id character varying(255)
);


--
-- Name: assessment_announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_announcement (
    id character varying(255) NOT NULL,
    assessment_id character varying(255),
    rich_text_id character varying(255),
    attempt_id character varying(255),
    sent_time timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    institute_id character varying(255),
    type character varying(255)
);


--
-- Name: assessment_batch_registration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_batch_registration (
    id character varying(255) NOT NULL,
    assessment_id character varying(255) NOT NULL,
    batch_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    registration_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: assessment_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_custom_fields (
    id character varying(255) NOT NULL,
    field_name character varying(255) NOT NULL,
    field_key character varying(255) NOT NULL,
    assessment_id character varying(255),
    is_mandatory boolean NOT NULL,
    field_type character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    comma_separated_options text,
    status character varying(255),
    field_order integer DEFAULT 0
);


--
-- Name: assessment_institute_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_institute_mapping (
    id character varying(255) NOT NULL,
    assessment_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    comma_separated_creation_roles text,
    comma_separated_submission_view_roles text,
    comma_separated_evaluation_roles text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    subject_id character varying(255),
    assessment_url character varying(524),
    comma_separated_creation_user_ids text,
    comma_separated_live_roles text,
    comma_separated_submission_view_user_ids text,
    comma_separated_evaluation_user_ids text,
    comma_separated_live_user_ids text,
    evaluation_setting text
);


--
-- Name: assessment_institute_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessment_institute_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessment_institute_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessment_institute_mapping_id_seq OWNED BY public.assessment_institute_mapping.id;


--
-- Name: assessment_notification_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_notification_metadata (
    id character varying(36) NOT NULL,
    assessment_id character varying(36),
    participant_when_assessment_created boolean NOT NULL,
    participant_show_leaderboard boolean NOT NULL,
    participant_before_assessment_goes_live integer NOT NULL,
    participant_when_assessment_live boolean NOT NULL,
    parent_when_assessment_created boolean NOT NULL,
    parent_show_leaderboard boolean NOT NULL,
    parent_before_assessment_goes_live integer NOT NULL,
    parent_when_assessment_live boolean NOT NULL,
    when_student_appears boolean,
    when_student_finishes_test boolean,
    participant_when_assessment_report_generated boolean NOT NULL,
    parent_when_assessment_report_generated boolean NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: assessment_registration_custom_field_response_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_registration_custom_field_response_data (
    id character varying(255) NOT NULL,
    custom_field_id character varying(255),
    assessment_registration_id character varying(255),
    answer text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "order" integer DEFAULT 0
);


--
-- Name: assessment_rich_text_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_rich_text_data (
    id character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    content text NOT NULL
);


--
-- Name: assessment_set_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_set_mapping (
    id character varying(255) NOT NULL,
    assessment_id character varying(255),
    set_name character varying(255),
    status character varying(255),
    "json" text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: assessment_user_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_user_access (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    permissions text[] NOT NULL,
    assessment_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: assessment_user_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assessment_user_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessment_user_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assessment_user_access_id_seq OWNED BY public.assessment_user_access.id;


--
-- Name: assessment_user_registration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_user_registration (
    id character varying(255) NOT NULL,
    assessment_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    registration_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    source character varying(255),
    source_id character varying(255),
    username character varying(255),
    user_email character varying,
    phone_number character varying(255),
    institute_id character varying(255),
    participant_name character varying(255),
    face_file_id character varying(255),
    reattempt_count integer
);


--
-- Name: chapter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter (
    chapter_id character varying NOT NULL,
    chapter_name character varying NOT NULL,
    chapter_order integer NOT NULL
);


--
-- Name: chapter_topic_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_topic_mapping (
    chapter_id character varying NOT NULL,
    topic_id character varying NOT NULL
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
-- Name: entity_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_tags (
    entity_id character varying(255) NOT NULL,
    entity_name character varying(255) NOT NULL,
    tag_id character varying(255) NOT NULL,
    tag_source character varying(255)
);


--
-- Name: evaluation_criteria_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_criteria_template (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    subject character varying(100),
    question_type character varying(50),
    criteria_json text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_by character varying(36),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: evaluation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_logs (
    id character varying(255) NOT NULL,
    source character varying(255),
    source_id character varying(255),
    type character varying(255),
    learner_id character varying(255),
    data_json text,
    author_id character varying(255),
    date_and_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: file_conversion_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_conversion_status (
    id character varying(36) NOT NULL,
    file_id character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    vendor_file_id character varying(255),
    html_text text,
    file_type character varying(50),
    vendor character varying(50),
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
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
-- Name: institute_question_paper; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_question_paper (
    id character varying(255) NOT NULL,
    question_paper_id character varying(255),
    institute_id character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    level_id character varying(255),
    subject_id character varying(255)
);


--
-- Name: level_stream_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.level_stream_mapping (
    level_id character varying(255) NOT NULL,
    stream_id character varying(255) NOT NULL
);


--
-- Name: levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.levels (
    level_id character varying(255) NOT NULL,
    level_name character varying(255) NOT NULL
);


--
-- Name: live_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session (
    id character varying(255) NOT NULL,
    presentation_id character varying(255),
    presentation_title character varying(500),
    invite_code character varying(20),
    status character varying(20) DEFAULT 'INIT'::character varying NOT NULL,
    can_join_in_between boolean DEFAULT true,
    show_results_at_last_slide boolean DEFAULT true,
    default_seconds_for_question integer DEFAULT 60,
    student_attempts integer DEFAULT 1,
    points_per_correct_answer integer DEFAULT 10,
    negative_marking_enabled boolean DEFAULT false,
    negative_marks_per_wrong_answer numeric(10,2) DEFAULT 0.0,
    total_mcq_slides integer DEFAULT 0,
    created_at timestamp without time zone,
    started_at timestamp without time zone,
    ended_at timestamp without time zone
);


--
-- Name: live_session_participant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session_participant (
    id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    user_id character varying(255),
    name character varying(500),
    email character varying(500),
    joined_at timestamp without time zone
);


--
-- Name: live_session_response; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session_response (
    id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    slide_id character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    response_type character varying(50),
    selected_option_ids text,
    text_answer text,
    is_correct boolean,
    time_to_response_millis bigint,
    submitted_at timestamp without time zone
);


--
-- Name: option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.option (
    id character varying(255) NOT NULL,
    question_id character varying(255),
    text_id character varying(255) NOT NULL,
    media_id character varying(255),
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    explanation_text_id character varying(255),
    option_order integer
);


--
-- Name: presentation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presentation (
    id character varying(255) NOT NULL,
    title character varying(255),
    description text,
    cover_file_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    institute_id character varying,
    status character varying
);


--
-- Name: presentation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.presentation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: presentation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.presentation_id_seq OWNED BY public.presentation.id;


--
-- Name: presentation_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presentation_slide (
    id character varying(255) NOT NULL,
    title text,
    presentation_id character varying(255),
    source_id character varying(255),
    source character varying(255),
    interaction_status character varying(255),
    slide_order integer,
    content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    default_time integer,
    status character varying(255)
);


--
-- Name: presentation_slide_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.presentation_slide_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: presentation_slide_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.presentation_slide_id_seq OWNED BY public.presentation_slide.id;


--
-- Name: question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question (
    id character varying(255) NOT NULL,
    text_id character varying(50) NOT NULL,
    media_id character varying(999),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    question_response_type character varying(50) NOT NULL,
    question_type character varying(50) NOT NULL,
    access_level character varying(50) NOT NULL,
    auto_evaluation_json text,
    evaluation_type character varying(50),
    explanation_text_id character varying(50),
    default_question_time_mins integer,
    parent_rich_text_id character varying(255),
    options_json text,
    status character varying(255),
    difficulty character varying(255),
    problem_type character varying(255),
    evaluation_criteria_json text,
    criteria_template_id character varying(36)
);


--
-- Name: question_assessment_section_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_assessment_section_mapping (
    id character varying(255) NOT NULL,
    question_id character varying(255) NOT NULL,
    section_id character varying(255) NOT NULL,
    question_order integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    marking_json text,
    question_duration_in_min integer,
    status character varying(255)
);


--
-- Name: question_institute_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_institute_mapping (
    id character varying(255) NOT NULL,
    question_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: question_paper; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_paper (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description_id character varying(255),
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id character varying(255) NOT NULL,
    access character varying(10) DEFAULT 'PRIVATE'::character varying,
    subject_id character varying(255),
    chapter_ids text,
    difficulty character varying(255)
);


--
-- Name: question_question_paper_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_question_paper_mapping (
    id character varying(255) NOT NULL,
    question_id character varying(255) NOT NULL,
    question_paper_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    question_order integer
);


--
-- Name: question_wise_marks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_wise_marks (
    id character varying(255) NOT NULL,
    assessment_id character varying(255) NOT NULL,
    attempt_id character varying(255) NOT NULL,
    question_id character varying(255) NOT NULL,
    marks double precision,
    status character varying(255),
    time_taken_in_seconds integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    response_json text,
    section_id character varying(255),
    ai_evaluated_at timestamp without time zone,
    ai_evaluation_details_json text,
    evaluator_feedback text
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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section (
    id character varying(255) NOT NULL,
    assessment_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description_id text,
    section_type character varying(50),
    marks_per_question real,
    total_marks real,
    section_order integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cut_off_marks real,
    question_random_type character varying,
    status character varying(255),
    problem_random_type character varying(255),
    duration integer
);


--
-- Name: stream_subject_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_subject_mapping (
    stream_id character varying(255) NOT NULL,
    subject_id character varying(255) NOT NULL
);


--
-- Name: streams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streams (
    stream_id character varying(255) NOT NULL,
    stream_name character varying(255) NOT NULL
);


--
-- Name: student_attempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_attempt (
    id character varying(255) NOT NULL,
    registration_id character varying(255) NOT NULL,
    attempt_number integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    submit_time timestamp with time zone,
    max_time integer NOT NULL,
    status character varying(50) NOT NULL,
    attempt_data text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    preview_start_time timestamp with time zone NOT NULL,
    submit_data text,
    server_last_sync timestamp with time zone,
    client_last_sync timestamp with time zone,
    duration_distribution_json text,
    total_marks double precision DEFAULT 0,
    total_time_in_seconds integer,
    result_marks double precision DEFAULT 0,
    result_status character varying(255),
    report_release_status character varying(255),
    report_last_release_date timestamp with time zone,
    set_id character varying(255),
    comma_separated_evaluator_user_ids text,
    evaluated_file_id character varying(255),
    report_pdf_file_id character varying(255)
);


--
-- Name: sub_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_question (
    id character varying(255) NOT NULL,
    question_id character varying(255) NOT NULL,
    text_id character varying(255) NOT NULL,
    media_id character varying(255),
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    explanation_text_id character varying(255)
);


--
-- Name: subject_chapter_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_chapter_mapping (
    subject_id character varying NOT NULL,
    chapter_id character varying NOT NULL,
    stream_id character varying
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    subject_id character varying(255) NOT NULL,
    subject_name character varying(255) NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    tag_id character varying(255) NOT NULL,
    tag_name text NOT NULL
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
-- Name: topic; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic (
    topic_id character varying NOT NULL,
    topic_name character varying NOT NULL,
    topic_order integer NOT NULL
);


--
-- Name: assessment_user_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_user_access ALTER COLUMN id SET DEFAULT nextval('public.assessment_user_access_id_seq'::regclass);


--
-- Name: presentation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation ALTER COLUMN id SET DEFAULT nextval('public.presentation_id_seq'::regclass);


--
-- Name: presentation_slide id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_slide ALTER COLUMN id SET DEFAULT nextval('public.presentation_slide_id_seq'::regclass);


--
-- Name: ai_evaluation_process ai_evaluation_process_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_evaluation_process
    ADD CONSTRAINT ai_evaluation_process_pkey PRIMARY KEY (id);


--
-- Name: ai_question_evaluation ai_question_evaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_question_evaluation
    ADD CONSTRAINT ai_question_evaluation_pkey PRIMARY KEY (id);


--
-- Name: assessment_announcement assessment_announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_announcement
    ADD CONSTRAINT assessment_announcement_pkey PRIMARY KEY (id);


--
-- Name: assessment_batch_registration assessment_batch_registration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_batch_registration
    ADD CONSTRAINT assessment_batch_registration_pkey PRIMARY KEY (id);


--
-- Name: assessment_batch_registration assessment_batch_registration_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_batch_registration
    ADD CONSTRAINT assessment_batch_registration_unique UNIQUE (assessment_id, batch_id, institute_id);


--
-- Name: assessment_custom_fields assessment_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_custom_fields
    ADD CONSTRAINT assessment_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: assessment_custom_fields assessment_custom_fields_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_custom_fields
    ADD CONSTRAINT assessment_custom_fields_unique UNIQUE (field_key, assessment_id);


--
-- Name: assessment_institute_mapping assessment_institute_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_institute_mapping
    ADD CONSTRAINT assessment_institute_mapping_pkey PRIMARY KEY (id);


--
-- Name: assessment_notification_metadata assessment_notification_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_notification_metadata
    ADD CONSTRAINT assessment_notification_metadata_pkey PRIMARY KEY (id);


--
-- Name: assessment assessment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment
    ADD CONSTRAINT assessment_pkey PRIMARY KEY (id);


--
-- Name: assessment_registration_custom_field_response_data assessment_registration_custom_field_response_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_registration_custom_field_response_data
    ADD CONSTRAINT assessment_registration_custom_field_response_data_pkey PRIMARY KEY (id);


--
-- Name: assessment_user_registration assessment_registration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_user_registration
    ADD CONSTRAINT assessment_registration_pkey PRIMARY KEY (id);


--
-- Name: assessment_rich_text_data assessment_rich_text_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_rich_text_data
    ADD CONSTRAINT assessment_rich_text_data_pkey PRIMARY KEY (id);


--
-- Name: assessment_set_mapping assessment_set_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_set_mapping
    ADD CONSTRAINT assessment_set_mapping_pkey PRIMARY KEY (id);


--
-- Name: assessment_user_access assessment_user_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_user_access
    ADD CONSTRAINT assessment_user_access_pkey PRIMARY KEY (id);


--
-- Name: assessment_user_registration assessment_user_registration_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_user_registration
    ADD CONSTRAINT assessment_user_registration_unique UNIQUE (assessment_id, user_id);


--
-- Name: chapter chapter_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter
    ADD CONSTRAINT chapter_name_unique UNIQUE (chapter_name);


--
-- Name: chapter chapter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter
    ADD CONSTRAINT chapter_pkey PRIMARY KEY (chapter_id);


--
-- Name: chapter_topic_mapping chapter_topic_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_topic_mapping
    ADD CONSTRAINT chapter_topic_mapping_pkey PRIMARY KEY (chapter_id, topic_id);


--
-- Name: client_secret_key client_secret_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_secret_key
    ADD CONSTRAINT client_secret_key_pkey PRIMARY KEY (client_name);


--
-- Name: entity_tags entity_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_tags
    ADD CONSTRAINT entity_tags_pkey PRIMARY KEY (entity_name, entity_id, tag_id);


--
-- Name: evaluation_criteria_template evaluation_criteria_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_criteria_template
    ADD CONSTRAINT evaluation_criteria_template_pkey PRIMARY KEY (id);


--
-- Name: evaluation_logs evaluation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_logs
    ADD CONSTRAINT evaluation_logs_pkey PRIMARY KEY (id);


--
-- Name: file_conversion_status file_conversion_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_conversion_status
    ADD CONSTRAINT file_conversion_status_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: institute_question_paper institute_question_paper_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_question_paper
    ADD CONSTRAINT institute_question_paper_pkey PRIMARY KEY (id);


--
-- Name: level_stream_mapping level_stream_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_stream_mapping
    ADD CONSTRAINT level_stream_mapping_pkey PRIMARY KEY (level_id, stream_id);


--
-- Name: levels levels_level_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels
    ADD CONSTRAINT levels_level_name_key UNIQUE (level_name);


--
-- Name: levels levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels
    ADD CONSTRAINT levels_pkey PRIMARY KEY (level_id);


--
-- Name: live_session_participant live_session_participant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_participant
    ADD CONSTRAINT live_session_participant_pkey PRIMARY KEY (id);


--
-- Name: live_session_participant live_session_participant_session_id_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_participant
    ADD CONSTRAINT live_session_participant_session_id_username_key UNIQUE (session_id, username);


--
-- Name: live_session live_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session
    ADD CONSTRAINT live_session_pkey PRIMARY KEY (id);


--
-- Name: live_session_response live_session_response_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_response
    ADD CONSTRAINT live_session_response_pkey PRIMARY KEY (id);


--
-- Name: option option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option
    ADD CONSTRAINT option_pkey PRIMARY KEY (id);


--
-- Name: presentation presentation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation
    ADD CONSTRAINT presentation_pkey PRIMARY KEY (id);


--
-- Name: presentation_slide presentation_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_slide
    ADD CONSTRAINT presentation_slide_pkey PRIMARY KEY (id);


--
-- Name: question_assessment_section_mapping question_assessment_section_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_assessment_section_mapping
    ADD CONSTRAINT question_assessment_section_mapping_pkey PRIMARY KEY (id);


--
-- Name: question_institute_mapping question_institute_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_institute_mapping
    ADD CONSTRAINT question_institute_mapping_pkey PRIMARY KEY (id);


--
-- Name: question_paper question_paper_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_paper
    ADD CONSTRAINT question_paper_pkey PRIMARY KEY (id);


--
-- Name: question question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question
    ADD CONSTRAINT question_pkey PRIMARY KEY (id);


--
-- Name: question_question_paper_mapping question_question_paper_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_question_paper_mapping
    ADD CONSTRAINT question_question_paper_mapping_pkey PRIMARY KEY (id);


--
-- Name: question_wise_marks question_wise_marks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_wise_marks
    ADD CONSTRAINT question_wise_marks_pkey PRIMARY KEY (id);


--
-- Name: scheduler_activity_log scheduler_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_activity_log
    ADD CONSTRAINT scheduler_activity_log_pkey PRIMARY KEY (id);


--
-- Name: section section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section
    ADD CONSTRAINT section_pkey PRIMARY KEY (id);


--
-- Name: stream_subject_mapping stream_subject_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_subject_mapping
    ADD CONSTRAINT stream_subject_mapping_pkey PRIMARY KEY (stream_id, subject_id);


--
-- Name: streams streams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_pkey PRIMARY KEY (stream_id);


--
-- Name: streams streams_stream_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_stream_name_key UNIQUE (stream_name);


--
-- Name: student_attempt student_attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_attempt
    ADD CONSTRAINT student_attempt_pkey PRIMARY KEY (id);


--
-- Name: sub_question sub_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_question
    ADD CONSTRAINT sub_question_pkey PRIMARY KEY (id);


--
-- Name: subject_chapter_mapping subject_chapter_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_mapping
    ADD CONSTRAINT subject_chapter_mapping_pkey PRIMARY KEY (subject_id, chapter_id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (subject_id);


--
-- Name: subjects subjects_subject_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_subject_name_key UNIQUE (subject_name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (tag_id);


--
-- Name: tags tags_tag_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tag_name_key UNIQUE (tag_name);


--
-- Name: task_execution_audit task_execution_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT task_execution_audit_pkey PRIMARY KEY (id);


--
-- Name: topic topic_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic
    ADD CONSTRAINT topic_name_unique UNIQUE (topic_name);


--
-- Name: topic topic_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic
    ADD CONSTRAINT topic_pkey PRIMARY KEY (topic_id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_attempt_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempt_status ON public.ai_evaluation_process USING btree (attempt_id, status);


--
-- Name: idx_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_id ON public.file_conversion_status USING btree (file_id);


--
-- Name: idx_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_active ON public.evaluation_criteria_template USING btree (is_active);


--
-- Name: idx_live_session_participant_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_participant_session ON public.live_session_participant USING btree (session_id);


--
-- Name: idx_live_session_presentation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_presentation ON public.live_session USING btree (presentation_id);


--
-- Name: idx_live_session_response_session_slide; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_response_session_slide ON public.live_session_response USING btree (session_id, slide_id);


--
-- Name: idx_process_progress; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_progress ON public.ai_evaluation_process USING btree (status, questions_completed, questions_total);


--
-- Name: idx_question_eval_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_eval_completed ON public.ai_question_evaluation USING btree (evaluation_process_id, completed_at);


--
-- Name: idx_question_eval_process; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_eval_process ON public.ai_question_evaluation USING btree (evaluation_process_id);


--
-- Name: idx_question_eval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_eval_status ON public.ai_question_evaluation USING btree (evaluation_process_id, status);


--
-- Name: idx_status_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_retry ON public.ai_evaluation_process USING btree (status, retry_count);


--
-- Name: idx_subject_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subject_type ON public.evaluation_criteria_template USING btree (subject, question_type);


--
-- Name: idx_vendor_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_file_id ON public.file_conversion_status USING btree (vendor_file_id);


--
-- Name: evaluation_logs trigger_set_timestamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_timestamps BEFORE INSERT OR UPDATE ON public.evaluation_logs FOR EACH ROW EXECUTE FUNCTION public.set_timestamps();


--
-- Name: ai_evaluation_process ai_evaluation_process_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_evaluation_process
    ADD CONSTRAINT ai_evaluation_process_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: ai_evaluation_process ai_evaluation_process_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_evaluation_process
    ADD CONSTRAINT ai_evaluation_process_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.student_attempt(id);


--
-- Name: ai_evaluation_process ai_evaluation_process_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_evaluation_process
    ADD CONSTRAINT ai_evaluation_process_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.assessment_set_mapping(id);


--
-- Name: assessment_batch_registration assessment_batch_registration_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_batch_registration
    ADD CONSTRAINT assessment_batch_registration_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: assessment_custom_fields assessment_custom_fields_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_custom_fields
    ADD CONSTRAINT assessment_custom_fields_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: assessment_institute_mapping assessment_institute_mapping_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_institute_mapping
    ADD CONSTRAINT assessment_institute_mapping_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: assessment_notification_metadata assessment_notification_metadata_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_notification_metadata
    ADD CONSTRAINT assessment_notification_metadata_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: assessment_user_registration assessment_registration_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_user_registration
    ADD CONSTRAINT assessment_registration_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: assessment_registration_custom_field_response_data assessment_registration_custom__assessment_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_registration_custom_field_response_data
    ADD CONSTRAINT assessment_registration_custom__assessment_registration_id_fkey FOREIGN KEY (assessment_registration_id) REFERENCES public.assessment_user_registration(id) ON DELETE CASCADE;


--
-- Name: assessment_registration_custom_field_response_data assessment_registration_custom_field_respo_custom_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_registration_custom_field_response_data
    ADD CONSTRAINT assessment_registration_custom_field_respo_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.assessment_custom_fields(id) ON DELETE CASCADE;


--
-- Name: chapter_topic_mapping chapter_topic_mapping_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_topic_mapping
    ADD CONSTRAINT chapter_topic_mapping_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapter(chapter_id);


--
-- Name: chapter_topic_mapping chapter_topic_mapping_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_topic_mapping
    ADD CONSTRAINT chapter_topic_mapping_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topic(topic_id);


--
-- Name: assessment_announcement fk_announcement_assessment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_announcement
    ADD CONSTRAINT fk_announcement_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessment(id) ON DELETE CASCADE;


--
-- Name: assessment_announcement fk_announcement_attempt; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_announcement
    ADD CONSTRAINT fk_announcement_attempt FOREIGN KEY (attempt_id) REFERENCES public.student_attempt(id) ON DELETE SET NULL;


--
-- Name: assessment_announcement fk_announcement_rich_text; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_announcement
    ADD CONSTRAINT fk_announcement_rich_text FOREIGN KEY (rich_text_id) REFERENCES public.assessment_rich_text_data(id) ON DELETE SET NULL;


--
-- Name: assessment_set_mapping fk_assessment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_set_mapping
    ADD CONSTRAINT fk_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessment(id) ON DELETE CASCADE;


--
-- Name: question_wise_marks fk_assessment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_wise_marks
    ADD CONSTRAINT fk_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: question_wise_marks fk_attempt; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_wise_marks
    ADD CONSTRAINT fk_attempt FOREIGN KEY (attempt_id) REFERENCES public.student_attempt(id);


--
-- Name: question fk_criteria_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question
    ADD CONSTRAINT fk_criteria_template FOREIGN KEY (criteria_template_id) REFERENCES public.evaluation_criteria_template(id);


--
-- Name: question_institute_mapping fk_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_institute_mapping
    ADD CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE;


--
-- Name: question_question_paper_mapping fk_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_question_paper_mapping
    ADD CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE;


--
-- Name: question_wise_marks fk_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_wise_marks
    ADD CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES public.question(id);


--
-- Name: ai_question_evaluation fk_question_eval_marks; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_question_evaluation
    ADD CONSTRAINT fk_question_eval_marks FOREIGN KEY (question_wise_marks_id) REFERENCES public.question_wise_marks(id) ON DELETE SET NULL;


--
-- Name: ai_question_evaluation fk_question_eval_process; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_question_evaluation
    ADD CONSTRAINT fk_question_eval_process FOREIGN KEY (evaluation_process_id) REFERENCES public.ai_evaluation_process(id) ON DELETE CASCADE;


--
-- Name: ai_question_evaluation fk_question_eval_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_question_evaluation
    ADD CONSTRAINT fk_question_eval_question FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE;


--
-- Name: question_question_paper_mapping fk_question_paper; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_question_paper_mapping
    ADD CONSTRAINT fk_question_paper FOREIGN KEY (question_paper_id) REFERENCES public.question_paper(id) ON DELETE CASCADE;


--
-- Name: question_wise_marks fk_question_wise_marks_section; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_wise_marks
    ADD CONSTRAINT fk_question_wise_marks_section FOREIGN KEY (section_id) REFERENCES public.section(id) ON DELETE CASCADE;


--
-- Name: student_attempt fk_set_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_attempt
    ADD CONSTRAINT fk_set_id FOREIGN KEY (set_id) REFERENCES public.assessment_set_mapping(id) ON DELETE CASCADE;


--
-- Name: task_execution_audit fk_task_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT fk_task_id FOREIGN KEY (task_id) REFERENCES public.scheduler_activity_log(id);


--
-- Name: institute_question_paper institute_question_paper_question_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_question_paper
    ADD CONSTRAINT institute_question_paper_question_paper_id_fkey FOREIGN KEY (question_paper_id) REFERENCES public.question_paper(id) ON DELETE CASCADE;


--
-- Name: level_stream_mapping level_stream_mapping_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_stream_mapping
    ADD CONSTRAINT level_stream_mapping_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(level_id);


--
-- Name: level_stream_mapping level_stream_mapping_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_stream_mapping
    ADD CONSTRAINT level_stream_mapping_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(stream_id);


--
-- Name: live_session_participant live_session_participant_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_participant
    ADD CONSTRAINT live_session_participant_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE;


--
-- Name: live_session_response live_session_response_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_response
    ADD CONSTRAINT live_session_response_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE;


--
-- Name: option option_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option
    ADD CONSTRAINT option_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE;


--
-- Name: question_assessment_section_mapping question_assessment_section_mapping_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_assessment_section_mapping
    ADD CONSTRAINT question_assessment_section_mapping_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question(id);


--
-- Name: question_assessment_section_mapping question_assessment_section_mapping_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_assessment_section_mapping
    ADD CONSTRAINT question_assessment_section_mapping_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.section(id);


--
-- Name: section section_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section
    ADD CONSTRAINT section_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessment(id);


--
-- Name: stream_subject_mapping stream_subject_mapping_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_subject_mapping
    ADD CONSTRAINT stream_subject_mapping_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(stream_id);


--
-- Name: stream_subject_mapping stream_subject_mapping_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_subject_mapping
    ADD CONSTRAINT stream_subject_mapping_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id);


--
-- Name: student_attempt student_attempt_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_attempt
    ADD CONSTRAINT student_attempt_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.assessment_user_registration(id);


--
-- Name: sub_question sub_question_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_question
    ADD CONSTRAINT sub_question_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE;


--
-- Name: subject_chapter_mapping subject_chapter_mapping_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_mapping
    ADD CONSTRAINT subject_chapter_mapping_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapter(chapter_id);


--
-- Name: subject_chapter_mapping subject_chapter_mapping_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_mapping
    ADD CONSTRAINT subject_chapter_mapping_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id);


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
1	1	<< Flyway Baseline >>	BASELINE	<< Flyway Baseline >>	\N	postgres	2025-08-21 05:55:26.722793	0	t
2	2	ai evaluation schema	SQL	V2__ai_evaluation_schema.sql	-1345916828	postgres	2025-12-23 20:05:00.522197	523	t
3	3	file conversion status	SQL	V3__file_conversion_status.sql	-244191095	postgres	2025-12-26 11:54:37.904811	214	t
4	4	ai question evaluation	SQL	V4__ai_question_evaluation.sql	210764339	postgres	2026-01-02 12:24:07.038824	497	t
5	5	Add option order	SQL	V5__Add_option_order.sql	1611557777	akmadmin	2026-03-06 15:52:43.837148	101	t
6	6	Live session persistence	SQL	V6__Live_session_persistence.sql	218921979	akmadmin	2026-03-08 04:47:14.773895	351	t
7	7	add report pdf file id	SQL	V7__add_report_pdf_file_id.sql	1359907840	akmadmin	2026-03-27 05:43:18.274654	141	t
8	8	add result type	SQL	V8__add_result_type.sql	1838731142	akmadmin	2026-04-13 07:51:36.814837	23	t
9	9	add registration instructions	SQL	V9__add_registration_instructions.sql	553876071	akmadmin	2026-04-13 07:51:37.225499	7	t
\.


--
-- PostgreSQL database dump complete
--


