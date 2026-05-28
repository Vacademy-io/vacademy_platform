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

-- Extensions required by this schema (Aiven pre-installs these; added for portable restore)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
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
-- Name: diff_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.diff_type AS ENUM (
    'EASY',
    'MEDIUM',
    'HARD'
);


--
-- Name: held_by; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.held_by AS ENUM (
    'GOVERNMENT',
    'PRIVATE'
);


--
-- Name: institute_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.institute_type AS ENUM (
    'COLLEGE',
    'SCHOOL',
    'ONLINE COACHING',
    'OFFLINE COACHING'
);


--
-- Name: question_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.question_type AS ENUM (
    'CODING',
    'SINGLE CHOICE',
    'MULTIPLE CHOICE',
    'INTEGER',
    'SUBJECTIVE'
);


--
-- Name: enrich_audience_response_with_center_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enrich_audience_response_with_center_defaults() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_field_name         TEXT;
    v_audience_id        TEXT;
    v_default_json       JSONB;
    v_default_key        TEXT;
    v_default_value      TEXT;
    v_target_field_id    VARCHAR(36);
    v_existing_value     TEXT;
BEGIN
    -- Only process AUDIENCE_RESPONSE custom field values
    IF NEW.source_type IS DISTINCT FROM 'AUDIENCE_RESPONSE' THEN
        RETURN NULL;
    END IF;

    -- Look up the field name for the inserted custom_field_id
    SELECT cf.field_name INTO v_field_name
    FROM custom_fields cf
    WHERE cf.id = NEW.custom_field_id;

    -- Only act when the "center name" field is being inserted (case-insensitive)
    IF v_field_name IS NULL OR LOWER(TRIM(v_field_name)) <> 'center name' THEN
        RETURN NULL;
    END IF;

    -- Skip if the inserted value is empty
    IF NEW.value IS NULL OR TRIM(NEW.value) = '' THEN
        RETURN NULL;
    END IF;

    -- Find the audience_id for this response
    SELECT ar.audience_id INTO v_audience_id
    FROM audience_response ar
    WHERE ar.id = NEW.source_id;

    IF v_audience_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find matching connector whose default_values_json has the same center name
    -- (case-insensitive). No-op if no connector has default_values_json.
    SELECT fwc.default_values_json::jsonb INTO v_default_json
    FROM form_webhook_connector fwc
    WHERE fwc.audience_id = v_audience_id
      AND fwc.is_active = true
      AND fwc.default_values_json IS NOT NULL
      AND LOWER(TRIM(fwc.default_values_json::jsonb->>'center name')) = LOWER(TRIM(NEW.value))
    LIMIT 1;

    IF v_default_json IS NULL THEN
        RETURN NULL;
    END IF;

    -- Since this is a DEFERRED trigger, all user-provided inserts in the same
    -- transaction are visible here. We only insert defaults for fields with
    -- NO existing non-empty value.
    FOR v_default_key, v_default_value IN
        SELECT key, value FROM jsonb_each_text(v_default_json)
    LOOP
        -- Skip the center name itself (already inserted, this is our trigger row)
        IF LOWER(TRIM(v_default_key)) = 'center name' THEN
            CONTINUE;
        END IF;

        -- Skip empty default values
        IF v_default_value IS NULL OR TRIM(v_default_value) = '' THEN
            CONTINUE;
        END IF;

        -- Find the custom_field_id matching this field name for this audience
        SELECT cf.id INTO v_target_field_id
        FROM custom_fields cf
        JOIN institute_custom_fields icf ON icf.custom_field_id = cf.id
        WHERE LOWER(TRIM(cf.field_name)) = LOWER(TRIM(v_default_key))
          AND icf.type = 'AUDIENCE_FORM'
          AND icf.type_id = v_audience_id
          AND icf.status = 'ACTIVE'
        LIMIT 1;

        IF v_target_field_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Check for existing value for this field on this response
        SELECT cfv.value INTO v_existing_value
        FROM custom_field_values cfv
        WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
          AND cfv.source_id = NEW.source_id
          AND cfv.custom_field_id = v_target_field_id
        LIMIT 1;

        -- User-provided value takes precedence — only fill if missing or empty
        IF v_existing_value IS NOT NULL AND TRIM(v_existing_value) <> '' THEN
            CONTINUE;
        END IF;

        IF v_existing_value IS NULL THEN
            INSERT INTO custom_field_values (id, custom_field_id, source_type, source_id, value)
            VALUES (gen_random_uuid()::text, v_target_field_id, 'AUDIENCE_RESPONSE', NEW.source_id, v_default_value);
        ELSE
            -- Row exists but value is empty — update it
            UPDATE custom_field_values
            SET value = v_default_value
            WHERE source_type = 'AUDIENCE_RESPONSE'
              AND source_id = NEW.source_id
              AND custom_field_id = v_target_field_id;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$;


--
-- Name: normalize_tag_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_tag_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.tag_name = TRIM(NEW.tag_name);
    RETURN NEW;
END;
$$;


--
-- Name: trim_and_lowercase_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_and_lowercase_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    column_name TEXT;
    column_value TEXT;
BEGIN
    IF TG_NARGS > 0 THEN
        column_name := TG_ARGV[0];
        
        -- Get the column value using JSON extraction
        column_value := to_json(NEW)->>column_name;
        
        -- Trim and lowercase the value
        column_value := LOWER(TRIM(column_value));
        
        -- Update the column using JSON
        NEW := jsonb_populate_record(NEW, jsonb_build_object(column_name, column_value));
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: trim_and_titlecase_package_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_and_titlecase_package_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.package_name IS NOT NULL THEN
        NEW.package_name := initcap(trim(NEW.package_name));
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_ai_api_keys_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ai_api_keys_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_ai_gen_video_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ai_gen_video_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_ai_input_videos_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ai_input_videos_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_booking_types_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_booking_types_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_brand_kit_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_brand_kit_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_chat_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chat_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_entity_access_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_entity_access_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_sfcfm_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sfcfm_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_studio_avatar_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_studio_avatar_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_system_files_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_system_files_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_teacher_planning_logs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_teacher_planning_logs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


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
-- Name: update_updated_at_student_analysis_process(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_student_analysis_process() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_tags(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_tags() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_user_linked_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_user_linked_data() RETURNS trigger
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
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    provider character varying(50) NOT NULL,
    category character varying(30) DEFAULT 'general'::character varying NOT NULL,
    tier character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    max_tokens integer,
    context_window integer,
    supports_streaming boolean DEFAULT true,
    supports_images boolean DEFAULT false,
    supports_function_calling boolean DEFAULT false,
    supports_json_mode boolean DEFAULT false,
    input_price_per_1m numeric(10,6) DEFAULT 0,
    output_price_per_1m numeric(10,6) DEFAULT 0,
    credit_multiplier numeric(4,2) DEFAULT 1.0,
    is_free boolean DEFAULT false,
    free_until timestamp without time zone,
    recommended_for text[],
    not_recommended_for text[],
    quality_score integer DEFAULT 3,
    speed_score integer DEFAULT 3,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    is_default_free boolean DEFAULT false,
    display_order integer DEFAULT 100,
    description text,
    notes text,
    external_docs_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    image_price_per_unit numeric(10,6) DEFAULT NULL::numeric,
    video_price_per_second numeric(10,6)
);


--
-- Name: COLUMN ai_models.image_price_per_unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_models.image_price_per_unit IS 'Per-image USD cost for image-generation models. NULL for token-priced models.';


--
-- Name: COLUMN ai_models.video_price_per_second; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_models.video_price_per_second IS 'Per-second USD cost for video models (avatar synthesis, future video gen). NULL for non-video models.';


--
-- Name: active_free_models; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_free_models AS
 SELECT model_id,
    name,
    provider,
    category,
    description,
    quality_score,
    speed_score
   FROM public.ai_models
  WHERE ((is_free = true) AND (is_active = true))
  ORDER BY display_order;


--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id character varying(255) NOT NULL,
    source_id character varying(255),
    source_type character varying(255),
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    user_id character varying(255),
    slide_id character varying(255),
    percentage_watched numeric,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50),
    raw_json text,
    processed_json text
);


--
-- Name: ad_platform_page_subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_platform_page_subscription (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    vendor character varying(50) NOT NULL,
    platform_page_id character varying(255) NOT NULL,
    platform_page_name character varying(500),
    subscribed_at timestamp without time zone DEFAULT now() NOT NULL,
    subscription_status character varying(30) DEFAULT 'ACTIVE'::character varying
);


--
-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_log (
    id character varying(36) NOT NULL,
    institute_id character varying(255) NOT NULL,
    actor_id character varying(255),
    actor_name character varying(255),
    actor_email character varying(255),
    entity_type character varying(64) NOT NULL,
    entity_id character varying(255),
    action character varying(64) NOT NULL,
    http_method character varying(8),
    endpoint character varying(512),
    description text,
    request_payload jsonb,
    before_payload jsonb,
    ip_address character varying(64),
    user_agent character varying(512),
    response_status integer,
    response_time_ms bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admission_pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_pipeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(255) NOT NULL,
    package_session_id character varying(255) NOT NULL,
    parent_user_id character varying(255) NOT NULL,
    child_user_id character varying(255) NOT NULL,
    enquiry_id character varying(255),
    applicant_id character varying(255),
    lead_status character varying(50) NOT NULL,
    source_type character varying(100),
    enquiry_date timestamp without time zone,
    application_date timestamp without time zone,
    admission_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: aft_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aft_installments (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    assigned_fee_value_id character varying(255) NOT NULL,
    installment_number integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    start_date date,
    end_date date
);


--
-- Name: ai_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id uuid,
    user_id uuid,
    openai_key text,
    gemini_key text,
    default_model character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    CONSTRAINT chk_entity_type CHECK ((((institute_id IS NOT NULL) AND (user_id IS NULL)) OR ((institute_id IS NULL) AND (user_id IS NOT NULL))))
);


--
-- Name: TABLE ai_api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_api_keys IS 'Stores API keys for AI services at institute or user level';


--
-- Name: COLUMN ai_api_keys.institute_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_api_keys.institute_id IS 'Institute UUID (mutually exclusive with user_id)';


--
-- Name: COLUMN ai_api_keys.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_api_keys.user_id IS 'User UUID (mutually exclusive with institute_id)';


--
-- Name: COLUMN ai_api_keys.openai_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_api_keys.openai_key IS 'OpenAI/OpenRouter API key';


--
-- Name: COLUMN ai_api_keys.gemini_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_api_keys.gemini_key IS 'Google Gemini API key';


--
-- Name: COLUMN ai_api_keys.default_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_api_keys.default_model IS 'Default LLM model preference';


--
-- Name: COLUMN ai_api_keys.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_api_keys.is_active IS 'Whether the keys are active (soft delete flag)';


--
-- Name: ai_content_extraction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_content_extraction (
    id character varying(36) NOT NULL,
    source_id character varying(36) NOT NULL,
    extraction_type character varying(64) NOT NULL,
    status character varying(32) NOT NULL,
    job_id character varying(255),
    detected_language character varying(16),
    language_probability double precision,
    duration_seconds double precision,
    segment_count integer,
    word_count integer,
    source_text_url text,
    english_text_url text,
    format_urls_json text,
    metadata_json text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    english_text_content text
);


--
-- Name: ai_content_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_content_source (
    id character varying(36) NOT NULL,
    source_type character varying(64) NOT NULL,
    source_id character varying(255) NOT NULL,
    source_url text,
    institute_id character varying(255) NOT NULL,
    created_by character varying(255),
    metadata_json text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_credit_invoice_sequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_credit_invoice_sequence (
    yyyymm character(6) NOT NULL,
    last_no integer DEFAULT 0 NOT NULL
);


--
-- Name: ai_gen_video; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_gen_video (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id character varying(255) NOT NULL,
    current_stage character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    file_ids jsonb DEFAULT '{}'::jsonb,
    s3_urls jsonb DEFAULT '{}'::jsonb,
    prompt text,
    language character varying(50) DEFAULT 'English'::character varying,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    content_type character varying(50) DEFAULT 'VIDEO'::character varying NOT NULL,
    thumbnails jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE ai_gen_video; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_gen_video IS 'Tracks AI-generated video creation progress and associated files';


--
-- Name: COLUMN ai_gen_video.video_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.video_id IS 'Unique identifier for the generated video';


--
-- Name: COLUMN ai_gen_video.current_stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.current_stage IS 'Current stage of generation: PENDING, SCRIPT, TTS, WORDS, HTML, RENDER, COMPLETED, FAILED';


--
-- Name: COLUMN ai_gen_video.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.status IS 'Overall status: PENDING, IN_PROGRESS, COMPLETED, FAILED';


--
-- Name: COLUMN ai_gen_video.file_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.file_ids IS 'JSON mapping of stage names to file IDs stored in system';


--
-- Name: COLUMN ai_gen_video.s3_urls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.s3_urls IS 'JSON mapping of stage names to S3 public URLs';


--
-- Name: COLUMN ai_gen_video.prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.prompt IS 'Original text prompt used to generate the video';


--
-- Name: COLUMN ai_gen_video.language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.language IS 'Language for video narration and content';


--
-- Name: COLUMN ai_gen_video.error_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.error_message IS 'Error details if generation failed';


--
-- Name: COLUMN ai_gen_video.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.metadata IS 'Additional configuration and generation metadata';


--
-- Name: COLUMN ai_gen_video.content_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.content_type IS 'Content type for multi-format support: VIDEO, QUIZ, STORYBOOK, INTERACTIVE_GAME, PUZZLE_BOOK, SIMULATION, FLASHCARDS, MAP_EXPLORATION';


--
-- Name: COLUMN ai_gen_video.thumbnails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_gen_video.thumbnails IS 'Intent-aware thumbnail set: {selected_id, intent, orientation, generated_at, options:[{id, image_url, headline, layout, subject_focus, intent_style}]}. Empty {} until thumbnail stage runs.';


--
-- Name: ai_generated_artifact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_generated_artifact (
    id character varying(36) NOT NULL,
    source_id character varying(36) NOT NULL,
    extraction_id character varying(36),
    artifact_type character varying(64) NOT NULL,
    artifact_id character varying(255),
    artifact_url text,
    status character varying(32) NOT NULL,
    error_message text,
    generated_content_json text,
    generation_params_json text,
    model_used character varying(128),
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_input_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_input_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id text NOT NULL,
    name character varying(255) NOT NULL,
    mode character varying(20) NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    source_url text NOT NULL,
    duration_seconds real,
    resolution text,
    context_json_url text,
    spatial_db_url text,
    assets_urls jsonb DEFAULT '{}'::jsonb,
    render_job_id character varying(255),
    progress integer DEFAULT 0,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by_user_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    kind character varying(16) NOT NULL,
    width integer,
    height integer,
    image_metadata_url text,
    CONSTRAINT ai_input_assets_kind_check CHECK (((kind)::text = ANY ((ARRAY['video'::character varying, 'image'::character varying])::text[]))),
    CONSTRAINT ai_input_videos_mode_check CHECK (((mode)::text = ANY ((ARRAY['podcast'::character varying, 'demo'::character varying])::text[]))),
    CONSTRAINT ai_input_videos_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'QUEUED'::character varying, 'PROCESSING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: TABLE ai_input_assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_input_assets IS 'AI-indexed institute assets (videos and images). Each row tracks one upload through the indexing pipeline.';


--
-- Name: COLUMN ai_input_assets.mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_input_assets.mode IS 'Sub-mode within kind. Video: podcast | demo. Image: photo | screenshot | diagram.';


--
-- Name: COLUMN ai_input_assets.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_input_assets.kind IS 'Asset kind: video | image. Determines which extractor pipeline runs and which output URLs are populated.';


--
-- Name: COLUMN ai_input_assets.width; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_input_assets.width IS 'Pixel width. Populated for images; videos use resolution string.';


--
-- Name: COLUMN ai_input_assets.height; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_input_assets.height IS 'Pixel height. Populated for images; videos use resolution string.';


--
-- Name: COLUMN ai_input_assets.image_metadata_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_input_assets.image_metadata_url IS 'S3 URL to image_metadata.json (image kind only). Mirrors context_json_url for videos.';


--
-- Name: ai_model_defaults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_model_defaults (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    use_case character varying(50) NOT NULL,
    default_model_id character varying(100) NOT NULL,
    fallback_model_id character varying(100),
    free_tier_model_id character varying(100),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ai_model_stage_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_model_stage_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    use_case character varying(50) NOT NULL,
    quality_tier character varying(32) NOT NULL,
    stage_id character varying(64) NOT NULL,
    model_id character varying(100) NOT NULL,
    fallback_model_id character varying(100),
    user_overridable boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_reel_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_reel_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id text NOT NULL,
    input_asset_id uuid NOT NULL,
    config_hash character varying(64) NOT NULL,
    rank integer NOT NULL,
    source_t_start double precision NOT NULL,
    source_t_end double precision NOT NULL,
    source_duration_s double precision NOT NULL,
    predicted_output_duration_s double precision NOT NULL,
    score jsonb NOT NULL,
    breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    transcript_snippet text NOT NULL,
    thumbnail_strip_url text,
    enriched jsonb,
    ttl_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_reel_candidates_rank_pos CHECK ((rank >= 1)),
    CONSTRAINT ai_reel_candidates_window CHECK (((source_t_end > source_t_start) AND (source_t_start >= (0)::double precision)))
);


--
-- Name: TABLE ai_reel_candidates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_reel_candidates IS 'Gate-1 scan output for reels-from-video; 24h TTL. /preview enriches the row; /render consumes the enriched cut_plan.';


--
-- Name: COLUMN ai_reel_candidates.config_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reel_candidates.config_hash IS 'SHA-256 of (input_asset_id + scan request fields). Idempotency key for /scan cache.';


--
-- Name: COLUMN ai_reel_candidates.enriched; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reel_candidates.enriched IS 'Gate-2 LLM output: {title, rationale, word_importance, cut_plan}. NULL until /preview runs for this candidate.';


--
-- Name: ai_reels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reel_id character varying(255) NOT NULL,
    institute_id text NOT NULL,
    input_asset_id uuid NOT NULL,
    parent_candidate_id uuid,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    current_stage character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    error_message text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_window jsonb DEFAULT '{}'::jsonb NOT NULL,
    trim_map jsonb,
    stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    s3_urls jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT ai_reels_progress_range CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT ai_reels_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: TABLE ai_reels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_reels IS 'AI-generated short-form reels derived from indexed input videos.';


--
-- Name: COLUMN ai_reels.input_asset_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.input_asset_id IS 'FK to ai_input_assets.id (kind=video, status=COMPLETED at render time).';


--
-- Name: COLUMN ai_reels.parent_candidate_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.parent_candidate_id IS 'FK to ai_reel_candidates.id — which scan candidate produced this reel.';


--
-- Name: COLUMN ai_reels.current_stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.current_stage IS 'PENDING | AUDIO_EDIT | SOURCE_CLIP | STYLE_GUIDE | DIRECTOR | HTML | ASSEMBLE | RENDER | COMPLETED | FAILED';


--
-- Name: COLUMN ai_reels.config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.config IS 'Full RenderRequest body — audit trail + re-render input.';


--
-- Name: COLUMN ai_reels.source_window; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.source_window IS '{t_start, t_end, original_duration_s} in source video coords (pre-cut).';


--
-- Name: COLUMN ai_reels.trim_map; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.trim_map IS 'Spans kept after silence + word cuts: [{orig_t_start, orig_t_end, new_t_start, new_t_end}]. NULL until AUDIO_EDIT runs.';


--
-- Name: COLUMN ai_reels.stages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.stages IS 'Per-stage progress array: [{stage, progress}]. Powers stage-by-stage FE status UI (§13.11).';


--
-- Name: COLUMN ai_reels.s3_urls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_reels.s3_urls IS 'Output artifact URLs: speaker_clip, speaker_fg, time_based_frame, video, captions.';


--
-- Name: ai_token_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_token_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id uuid,
    user_id uuid,
    api_provider character varying(50) NOT NULL,
    model character varying(255),
    prompt_tokens integer DEFAULT 0 NOT NULL,
    completion_tokens integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    request_type character varying(50) NOT NULL,
    request_id character varying(255),
    metadata text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    input_token_price numeric(20,10),
    output_token_price numeric(20,10),
    total_price numeric(20,10),
    credits_used numeric(10,4),
    tts_provider character varying(50),
    character_count integer,
    CONSTRAINT ai_token_usage_api_provider_check CHECK (((api_provider)::text = ANY ((ARRAY['openai'::character varying, 'gemini'::character varying, 'google_tts'::character varying])::text[]))),
    CONSTRAINT ai_token_usage_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['outline'::character varying, 'image'::character varying, 'content'::character varying, 'video'::character varying, 'tts'::character varying, 'tts_premium'::character varying, 'embedding'::character varying, 'evaluation'::character varying, 'presentation'::character varying, 'conversation'::character varying, 'lecture'::character varying, 'course_content'::character varying, 'pdf_questions'::character varying, 'agent'::character varying, 'analytics'::character varying, 'copilot'::character varying, 'stock'::character varying, 'avatar_video'::character varying])::text[])))
);


--
-- Name: TABLE ai_token_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_token_usage IS 'Tracks token usage for AI API calls for billing and monitoring';


--
-- Name: COLUMN ai_token_usage.institute_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.institute_id IS 'Institute UUID (optional, for per-institute tracking)';


--
-- Name: COLUMN ai_token_usage.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.user_id IS 'User UUID (optional, for per-user tracking)';


--
-- Name: COLUMN ai_token_usage.api_provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.api_provider IS 'AI provider: openai (default LLM/image path), gemini (image gen + Google LLMs), google_tts (premium TTS — Sarvam AI for Indian langs, Google Cloud TTS for global)';


--
-- Name: COLUMN ai_token_usage.model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.model IS 'Model identifier used for the API call';


--
-- Name: COLUMN ai_token_usage.prompt_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.prompt_tokens IS 'Number of tokens in the prompt';


--
-- Name: COLUMN ai_token_usage.completion_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.completion_tokens IS 'Number of tokens in the completion';


--
-- Name: COLUMN ai_token_usage.total_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.total_tokens IS 'Total tokens used (prompt + completion)';


--
-- Name: COLUMN ai_token_usage.request_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.request_type IS 'Type of AI request: outline, image, content, video, tts, tts_premium, embedding, evaluation, presentation, conversation, lecture, course_content, pdf_questions, agent, analytics, copilot, stock, avatar_video';


--
-- Name: COLUMN ai_token_usage.request_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.request_id IS 'Optional request identifier for correlation';


--
-- Name: COLUMN ai_token_usage.input_token_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.input_token_price IS 'Price per input token (applies to prompt_tokens) for this model';


--
-- Name: COLUMN ai_token_usage.output_token_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.output_token_price IS 'Price per output token (applies to completion_tokens) for this model';


--
-- Name: COLUMN ai_token_usage.total_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.total_price IS 'Total price: (input_token_price * prompt_tokens) + (output_token_price * completion_tokens)';


--
-- Name: COLUMN ai_token_usage.tts_provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.tts_provider IS 'TTS provider used: google, edge, elevenlabs';


--
-- Name: COLUMN ai_token_usage.character_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_token_usage.character_count IS 'Character count for TTS requests (TTS is charged by character)';


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    config_key character varying(50) NOT NULL,
    config_value character varying(255) NOT NULL,
    description character varying(255),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: applicant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applicant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tracking_id character varying(255),
    application_stage_id character varying(255),
    application_stage_status character varying(255),
    overall_status character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    workflow_type character varying(50)
);


--
-- Name: applicant_stage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applicant_stage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id character varying(255),
    stage_status character varying(255),
    response_json text,
    applicant_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: application_stage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_stage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_name character varying(255),
    sequence character varying(255),
    source character varying(255),
    source_id character varying(255),
    institute_id character varying(255),
    config_json text,
    type character varying(255),
    workflow_type character varying(50),
    is_first boolean DEFAULT false,
    is_last boolean DEFAULT false
);


--
-- Name: applied_coupon_discount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applied_coupon_discount (
    id character varying(255) NOT NULL,
    name character varying(255),
    discount_type character varying(255),
    media_ids text,
    status character varying(255),
    validity_in_days integer,
    discount_source character varying(255),
    currency character varying(255),
    max_discount_point double precision,
    discount_point double precision,
    max_applicable_times integer,
    redeem_start_date date,
    redeem_end_date date,
    coupon_code_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: assessment_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_slide (
    id character varying(255) NOT NULL,
    assessment_id character varying(255) NOT NULL,
    allow_reattempt boolean DEFAULT true NOT NULL,
    show_result boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessments (
    id character varying(255) NOT NULL,
    title character varying(255),
    description character varying(255),
    rules_markdown text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: assigned_fee_value; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assigned_fee_value (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    fee_type_id character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    no_of_installments integer DEFAULT 1,
    has_installment boolean DEFAULT false,
    is_refundable boolean DEFAULT false,
    has_penalty boolean DEFAULT false,
    penalty_percentage numeric(5,2),
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    original_amount numeric(10,2),
    discount_type character varying(50),
    discount_value numeric(10,2)
);


--
-- Name: assignment_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_slide (
    id character varying(255) NOT NULL,
    parent_rich_text_id character varying(255),
    text_id character varying(255),
    live_date timestamp with time zone,
    end_date timestamp with time zone,
    re_attempt_count integer,
    comma_separated_media_ids character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_marks double precision,
    passing_marks double precision
);


--
-- Name: assignment_slide_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_slide_question (
    id character varying(255) NOT NULL,
    assignment_slide_id character varying(255),
    question_order integer,
    status character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    text_id character varying,
    question_type character varying(50)
);


--
-- Name: assignment_slide_question_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_slide_question_options (
    id character varying(255) NOT NULL,
    assignment_slide_question_id character varying(255) NOT NULL,
    text_id character varying(255),
    media_id character varying(255),
    created_on timestamp without time zone DEFAULT now(),
    updated_on timestamp without time zone DEFAULT now()
);


--
-- Name: assignment_slide_tracked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_slide_tracked (
    id character varying(255) NOT NULL,
    comma_separated_file_ids text,
    activity_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    marks double precision,
    feedback text,
    checked_file_id character varying(255),
    late_submission boolean DEFAULT false NOT NULL
);


--
-- Name: audience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audience (
    id character varying(50) NOT NULL,
    institute_id character varying(50) NOT NULL,
    campaign_name character varying(255) NOT NULL,
    campaign_type text,
    description text,
    campaign_objective character varying(50),
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    json_web_metadata text,
    created_by_user_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    to_notify text,
    send_respondent_email boolean DEFAULT false,
    session_id character varying(255),
    setting_json text,
    default_initial_score integer DEFAULT 0
);


--
-- Name: TABLE audience; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audience IS 'Stores campaign/form definitions for lead capture across multiple channels';


--
-- Name: COLUMN audience.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.id IS 'Unique identifier for the campaign';


--
-- Name: COLUMN audience.institute_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.institute_id IS 'Links to institutes table';


--
-- Name: COLUMN audience.campaign_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.campaign_name IS 'Human-readable name of the campaign';


--
-- Name: COLUMN audience.campaign_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.campaign_type IS 'Comma-separated list of channels: WEBSITE,GOOGLE_ADS,FACEBOOK_ADS';


--
-- Name: COLUMN audience.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.description IS 'Detailed description of the campaign';


--
-- Name: COLUMN audience.campaign_objective; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.campaign_objective IS 'Purpose: LEAD_GENERATION, EVENT_REGISTRATION, etc.';


--
-- Name: COLUMN audience.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.status IS 'Campaign status: ACTIVE, PAUSED, COMPLETED, ARCHIVED';


--
-- Name: COLUMN audience.json_web_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.json_web_metadata IS 'JSON field for webhook URLs, secrets, and other metadata';


--
-- Name: COLUMN audience.created_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.created_by_user_id IS 'User who created this campaign';


--
-- Name: COLUMN audience.to_notify; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.to_notify IS 'Comma-separated email addresses for additional notification recipients when form is submitted';


--
-- Name: COLUMN audience.send_respondent_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience.send_respondent_email IS 'Whether to send email notification to the respondent who submitted the form (default: true)';


--
-- Name: audience_communication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audience_communication (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(255) NOT NULL,
    audience_id character varying(255) NOT NULL,
    channel character varying(50) NOT NULL,
    template_name character varying(255),
    subject character varying(500),
    body text,
    variable_mapping text,
    filters text,
    recipient_count integer DEFAULT 0 NOT NULL,
    successful integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    skipped integer DEFAULT 0 NOT NULL,
    batch_id character varying(255),
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: audience_response; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audience_response (
    id character varying(50) NOT NULL,
    audience_id character varying(50),
    user_id character varying(50),
    source_type character varying(50) NOT NULL,
    source_id character varying(100),
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    workflow_activate_day_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    destination_package_session_id character varying(255),
    enquiry_id character varying(255),
    parent_name character varying(255),
    parent_email character varying(255),
    parent_mobile character varying(20),
    applicant_id character varying(255),
    student_user_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    conversion_status character varying(50) DEFAULT NULL::character varying,
    overall_status character varying(50) DEFAULT NULL::character varying,
    dedupe_key character varying(64),
    is_duplicate boolean DEFAULT false,
    primary_response_id text,
    tat_reminder_count integer DEFAULT 0 NOT NULL,
    tat_reminder_stage character varying(40),
    tat_reminder_dedup_key character varying(255),
    tat_reminder_assignee_id character varying(255),
    tat_due_at timestamp without time zone,
    lead_status_id text,
    initial_score integer
);


--
-- Name: TABLE audience_response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audience_response IS 'Stores lead submissions from all channels (website forms, ad platforms, etc.)';


--
-- Name: COLUMN audience_response.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience_response.id IS 'Unique identifier for the response';


--
-- Name: COLUMN audience_response.audience_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience_response.audience_id IS 'Links to audience (campaign) table';


--
-- Name: COLUMN audience_response.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience_response.user_id IS 'References users.id in auth_service after conversion to student (NULL before conversion, no FK constraint)';


--
-- Name: COLUMN audience_response.source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience_response.source_type IS 'Source of lead: WEBSITE, GOOGLE_ADS, FACEBOOK_ADS, LINKEDIN_ADS, etc.';


--
-- Name: COLUMN audience_response.source_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience_response.source_id IS 'Identifier of source (landing page ID, ad campaign ID, etc.)';


--
-- Name: COLUMN audience_response.submitted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audience_response.submitted_at IS 'When the lead submitted the form or webhook was received';


--
-- Name: audio_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_slide (
    id character varying(255) NOT NULL,
    title character varying(255),
    description text,
    audio_file_id character varying(255),
    thumbnail_file_id character varying(255),
    audio_length_in_millis bigint,
    published_audio_file_id character varying(255),
    published_audio_length_in_millis bigint,
    source_type character varying(50),
    external_url character varying(500),
    transcript text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE audio_slide; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audio_slide IS 'Stores audio slide metadata';


--
-- Name: COLUMN audio_slide.audio_file_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_slide.audio_file_id IS 'File ID of the audio stored in file service';


--
-- Name: COLUMN audio_slide.thumbnail_file_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_slide.thumbnail_file_id IS 'Optional cover image file ID';


--
-- Name: COLUMN audio_slide.audio_length_in_millis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_slide.audio_length_in_millis IS 'Duration of audio in milliseconds';


--
-- Name: COLUMN audio_slide.transcript; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_slide.transcript IS 'Text transcript of the audio content for accessibility';


--
-- Name: audio_tracked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_tracked (
    id character varying(255) NOT NULL,
    activity_id character varying(255),
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    playback_speed double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE audio_tracked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audio_tracked IS 'Tracks audio playback intervals for learner progress';


--
-- Name: COLUMN audio_tracked.start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_tracked.start_time IS 'Start time of audio segment listened (as timestamp from millis)';


--
-- Name: COLUMN audio_tracked.end_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_tracked.end_time IS 'End time of audio segment listened (as timestamp from millis)';


--
-- Name: COLUMN audio_tracked.playback_speed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_tracked.playback_speed IS 'Playback speed used during this segment (e.g., 1.0, 1.5)';


--
-- Name: bbb_server_pool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bbb_server_pool (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(30) NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    server_type character varying(20) NOT NULL,
    server_name character varying(50) NOT NULL,
    domain character varying(100) NOT NULL,
    api_url character varying(255),
    secret character varying(255),
    hetzner_server_id bigint,
    snapshot_desc character varying(100) NOT NULL,
    location character varying(10) DEFAULT 'sin'::character varying,
    max_meetings integer DEFAULT 5 NOT NULL,
    active_meetings integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'STOPPED'::character varying NOT NULL,
    health_status character varying(20) DEFAULT 'UNKNOWN'::character varying,
    last_health_check timestamp without time zone,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: booking_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_types (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    type character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    description text,
    institute_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: brand_kit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_kit (
    id character varying(64) NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(120) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    background_type character varying(16) DEFAULT 'white'::character varying NOT NULL,
    palette_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    heading_font character varying(64),
    body_font character varying(64),
    layout_theme character varying(64),
    logo_file_id character varying(255),
    intro_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    outro_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    watermark_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE brand_kit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.brand_kit IS 'Vimotion brand kits — swappable bundles of palette/fonts/layout/intro/outro/watermark per institute.';


--
-- Name: COLUMN brand_kit.background_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_kit.background_type IS 'Storage value (''white'' | ''black''); UI labels these as Light/Dark.';


--
-- Name: COLUMN brand_kit.layout_theme; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_kit.layout_theme IS 'Layout theme id matching ai_service VIDEO_TEMPLATES catalog (Whiteboard, Cerulean, Glamour, etc.).';


--
-- Name: catalogue_institute_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogue_institute_mapping (
    id character varying(255) NOT NULL,
    course_catalogue character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    source character varying(255),
    source_id character varying(255),
    status character varying(255),
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: chapter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter (
    id character varying(255) NOT NULL,
    chapter_name character varying(255),
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(255),
    file_id character varying(255),
    description text,
    parent_id character varying(255),
    created_by_user_id character varying(255),
    drip_condition_json text
);


--
-- Name: chapter_package_session_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_package_session_mapping (
    id character varying NOT NULL,
    chapter_id character varying NOT NULL,
    package_session_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50),
    chapter_order integer
);


--
-- Name: chapter_to_slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_to_slides (
    id character varying(255) NOT NULL,
    chapter_id character varying(255),
    slide_id character varying(255),
    slide_order integer,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(255)
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id bigint NOT NULL,
    session_id character varying(255) NOT NULL,
    message_type character varying(20) NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    context_type character varying(50) NOT NULL,
    context_meta jsonb NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    last_active timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    session_mode character varying(30) DEFAULT 'text'::character varying NOT NULL
);


--
-- Name: checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255),
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
-- Name: coding_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coding_submissions (
    id character varying(255) NOT NULL,
    slide_id character varying(255) NOT NULL,
    learner_id character varying(255) NOT NULL,
    package_session_id character varying(255),
    language character varying(50) NOT NULL,
    source_code text NOT NULL,
    verdict character varying(32) NOT NULL,
    passed_count integer DEFAULT 0 NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    score double precision DEFAULT 0 NOT NULL,
    max_points double precision DEFAULT 0 NOT NULL,
    testcase_results_json text,
    total_time_ms integer DEFAULT 0 NOT NULL,
    peak_memory_kb integer DEFAULT 0 NOT NULL,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    session_started_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: complex_payment_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complex_payment_option (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    default_payment_option_id character varying(255),
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metadata_json text,
    created_by character varying(255),
    approved_by character varying(255)
);


--
-- Name: concentration_score; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concentration_score (
    id character varying(255) NOT NULL,
    concentration_score double precision NOT NULL,
    tab_switch_count integer NOT NULL,
    pause_count integer NOT NULL,
    answer_times_in_sec integer[],
    activity_id character varying(255) NOT NULL
);


--
-- Name: content_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_embeddings (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_id character varying(255) NOT NULL,
    content_text text NOT NULL,
    chunk_index integer DEFAULT 0 NOT NULL,
    embedding public.vector(768) NOT NULL,
    meta_data jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: counselor_pool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counselor_pool (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id text NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    assignment_mode character varying(50) NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    schedule_pattern character varying(50)
);


--
-- Name: counselor_pool_audience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counselor_pool_audience (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    pool_id text NOT NULL,
    audience_id text NOT NULL,
    last_assigned_counselor_id text,
    last_assigned_at timestamp without time zone,
    added_at timestamp without time zone DEFAULT now()
);


--
-- Name: counselor_pool_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counselor_pool_member (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    pool_id text NOT NULL,
    audience_id text NOT NULL,
    counselor_user_id text NOT NULL,
    display_order integer NOT NULL,
    monthly_target integer,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    backup_counselor_user_id text,
    added_by text,
    added_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: counselor_pool_shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counselor_pool_shift (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    pool_id text NOT NULL,
    day_of_week character varying(10) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    label character varying(255),
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: counselor_pool_shift_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counselor_pool_shift_member (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    shift_id text NOT NULL,
    counselor_user_id text NOT NULL,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    added_at timestamp without time zone DEFAULT now()
);


--
-- Name: coupon_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_code (
    id character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    status character varying(255),
    source_type character varying(255),
    source_id character varying(255),
    is_email_restricted boolean DEFAULT false,
    allowed_email_ids text,
    tag character varying(255),
    generation_date date,
    redeem_start_date date,
    redeem_end_date date,
    usage_limit bigint,
    can_be_added boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    short_url character varying(512)
);


--
-- Name: COLUMN coupon_code.short_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupon_code.short_url IS 'Generated short URL for the referral/coupon code';


--
-- Name: course_catalogue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_catalogue (
    id character varying(255) NOT NULL,
    catalogue_json text,
    status character varying(255),
    tag_name character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: course_structure_changes_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_structure_changes_log (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    source_id character varying(255),
    source_type character varying(100),
    parent_id character varying(255),
    json_data text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50)
);


--
-- Name: credit_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(255) NOT NULL,
    alert_type character varying(50) NOT NULL,
    threshold_value numeric(12,2),
    current_balance numeric(12,2),
    acknowledged boolean DEFAULT false,
    acknowledged_by character varying(255),
    acknowledged_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: credit_pack; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_pack (
    id character varying(255) NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    credits numeric(12,2) NOT NULL,
    hsn_sac_code character varying(8) DEFAULT '998313'::character varying NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    badge character varying(32),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: credit_pack_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_pack_price (
    id character varying(255) NOT NULL,
    pack_id character varying(255) NOT NULL,
    currency character varying(3) NOT NULL,
    amount_minor bigint NOT NULL,
    is_tax_inclusive boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: credit_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type character varying(50) NOT NULL,
    base_cost numeric(8,4) DEFAULT 0.5 NOT NULL,
    token_rate numeric(10,8) DEFAULT 0.0001 NOT NULL,
    minimum_charge numeric(8,4) DEFAULT 0.5 NOT NULL,
    unit_type character varying(20) DEFAULT 'tokens'::character varying,
    description character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: credit_rate_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_rate_config (
    id bigint NOT NULL,
    usd_to_credits numeric(10,4) NOT NULL,
    margin_pct numeric(5,2) NOT NULL,
    currency_code character varying(8) DEFAULT 'USD'::character varying NOT NULL,
    effective_from timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT credit_rate_config_margin_nonneg CHECK ((margin_pct >= (0)::numeric)),
    CONSTRAINT credit_rate_config_usd_to_credits_positive CHECK ((usd_to_credits > (0)::numeric))
);


--
-- Name: credit_rate_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_rate_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_rate_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_rate_config_id_seq OWNED BY public.credit_rate_config.id;


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(255) NOT NULL,
    transaction_type character varying(50) NOT NULL,
    amount numeric(12,4) NOT NULL,
    balance_after numeric(12,2) NOT NULL,
    description text,
    reference_id uuid,
    request_type character varying(50),
    model_name character varying(100),
    granted_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    batch_id character varying(255),
    external_reference_id character varying(255)
);


--
-- Name: custom_field_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_field_values (
    id character varying(255) NOT NULL,
    custom_field_id character varying(255) NOT NULL,
    source_type character varying(255) NOT NULL,
    source_id character varying(255) NOT NULL,
    type character varying(255),
    type_id character varying(255),
    value text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_fields (
    id character varying(36) NOT NULL,
    field_key character varying(1024) NOT NULL,
    field_name character varying(255) NOT NULL,
    field_type character varying(50) NOT NULL,
    default_value text,
    config text,
    form_order integer DEFAULT 0,
    is_mandatory boolean DEFAULT false,
    is_filter boolean DEFAULT false,
    is_sortable boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT now(),
    is_hidden boolean DEFAULT false,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT custom_fields_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('INACTIVE'::character varying)::text])))
);


--
-- Name: discount_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_option (
    id character varying(255) NOT NULL,
    package_session_learner_invitation_to_payment_option_id character varying(255),
    payment_plan_id character varying(255),
    discount_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: document_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_slide (
    id character varying(255) NOT NULL,
    type character varying(255),
    data text,
    title character varying(255),
    cover_file_id character varying(255),
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    total_pages integer,
    published_data text,
    published_document_total_pages integer
);


--
-- Name: document_tracked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tracked (
    id character varying(255) NOT NULL,
    activity_id character varying(255),
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    page_number integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id character varying(255) NOT NULL,
    file_id character varying(255) NOT NULL,
    folder_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    access_type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: doubt_assignee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doubt_assignee (
    id character varying(255) NOT NULL,
    doubt_id character varying(255),
    source_id character varying(255),
    source character varying(255),
    status character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: doubts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doubts (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    source character varying(255),
    source_id character varying(255),
    raised_time timestamp with time zone,
    resolved_time timestamp with time zone,
    content_position character varying(255),
    content_type character varying(255),
    html_text text,
    status character varying(255),
    parent_id character varying(255),
    parent_level integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    package_session_id character varying(255)
);


--
-- Name: embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embeddings (
    id character varying(255) NOT NULL,
    source character varying(255),
    source_id character varying(255),
    embedding public.vector(768),
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: enquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enquiry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checklist text,
    enquiry_status character varying(50),
    convertion_status character varying(255),
    reference_source character varying(255),
    assigned_user_id boolean DEFAULT false,
    assigned_visit_session_id boolean DEFAULT false,
    fee_range_expectation character varying(255),
    transport_requirement character varying(255),
    mode character varying(50),
    enquiry_tracking_id character varying(255),
    interest_score integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_relation_with_child character varying(100)
);


--
-- Name: enroll_invite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enroll_invite (
    id character varying(255) NOT NULL,
    name character varying(255),
    end_date date,
    start_date date,
    invite_code character varying(255),
    status character varying(255),
    institute_id character varying(255),
    vendor character varying(255),
    vendor_id character varying(255),
    currency character varying(255),
    tag character varying(255),
    web_page_meta_data_json text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    learner_access_days integer,
    is_bundled boolean DEFAULT false,
    setting_json text,
    short_url character varying(255),
    sub_org_id character varying(255)
);


--
-- Name: entity_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_access (
    id character varying(255) NOT NULL,
    access_type character varying(50) NOT NULL,
    level character varying(50) NOT NULL,
    level_id character varying(255) NOT NULL,
    entity character varying(100) NOT NULL,
    entity_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_entity_access_level CHECK (((level)::text = ANY (ARRAY[('user'::character varying)::text, ('batch'::character varying)::text, ('institute'::character varying)::text, ('role'::character varying)::text]))),
    CONSTRAINT chk_entity_access_type CHECK (((access_type)::text = ANY (ARRAY[('view'::character varying)::text, ('edit'::character varying)::text])))
);


--
-- Name: TABLE entity_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.entity_access IS 'Manages access permissions for various entities with support for user, batch, institute, and role-based access';


--
-- Name: COLUMN entity_access.access_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entity_access.access_type IS 'Access type: view (read access) or edit (write access)';


--
-- Name: COLUMN entity_access.level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entity_access.level IS 'Access level: user, batch, institute, or role';


--
-- Name: COLUMN entity_access.level_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entity_access.level_id IS 'ID corresponding to the access level (userId, batchId, instituteId, or role name)';


--
-- Name: COLUMN entity_access.entity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entity_access.entity IS 'Entity type this access applies to (system_file, assessment, video, etc.)';


--
-- Name: COLUMN entity_access.entity_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entity_access.entity_id IS 'Specific entity instance ID';


--
-- Name: faculty_session_institute_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculty_session_institute_group (
    user_id character varying(255),
    session_id character varying(255),
    institute_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: faculty_subject_package_session_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculty_subject_package_session_mapping (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    package_session_id character varying(255),
    subject_id character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    name character varying(255),
    status character varying(255),
    user_type character varying(255) DEFAULT NULL::character varying,
    type_id character varying(255) DEFAULT NULL::character varying,
    access_type character varying(255) DEFAULT NULL::character varying,
    access_id character varying(255) DEFAULT NULL::character varying,
    access_permission character varying(255) DEFAULT NULL::character varying,
    linkage_type character varying(255) DEFAULT NULL::character varying,
    suborg_id character varying(255) DEFAULT NULL::character varying
);


--
-- Name: fee_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_type (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    cpo_id character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_skippable boolean DEFAULT false
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
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50),
    user_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: form_webhook_connector; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_webhook_connector (
    id character varying(255) NOT NULL,
    vendor character varying(50) NOT NULL,
    vendor_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    audience_id character varying(255) NOT NULL,
    type character varying(50),
    sample_map_json text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    oauth_access_token_enc text,
    oauth_token_expires_at timestamp without time zone,
    platform_page_id character varying(255),
    platform_form_id character varying(255),
    routing_rules_json text,
    field_mapping_json text,
    connection_status character varying(30) DEFAULT 'ACTIVE'::character varying,
    produces_source_type character varying(50),
    webhook_verify_token character varying(255),
    default_values_json text
);


--
-- Name: TABLE form_webhook_connector; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_webhook_connector IS 'Stores configuration for form webhook integrations from providers like Zoho Forms, Google Forms, etc.';


--
-- Name: COLUMN form_webhook_connector.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.id IS 'Primary key';


--
-- Name: COLUMN form_webhook_connector.vendor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.vendor IS 'Form provider type (ZOHO_FORMS, GOOGLE_FORMS, MICROSOFT_FORMS)';


--
-- Name: COLUMN form_webhook_connector.vendor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.vendor_id IS 'Unique identifier from form provider (e.g., Zoho form ID)';


--
-- Name: COLUMN form_webhook_connector.institute_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.institute_id IS 'Institute ID that owns this connector';


--
-- Name: COLUMN form_webhook_connector.audience_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.audience_id IS 'Audience/Campaign ID to link submissions to';


--
-- Name: COLUMN form_webhook_connector.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.type IS 'Optional type/category for the connector (e.g., LEAD_GENERATION, CONTACT_FORM)';


--
-- Name: COLUMN form_webhook_connector.sample_map_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.sample_map_json IS 'JSON mapping configuration for field names. Maps form field names to standardized fields';


--
-- Name: COLUMN form_webhook_connector.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.is_active IS 'Whether this connector is active and should process webhooks';


--
-- Name: COLUMN form_webhook_connector.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.created_at IS 'Timestamp when the record was created';


--
-- Name: COLUMN form_webhook_connector.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_webhook_connector.updated_at IS 'Timestamp when the record was last updated';


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id character varying(255) NOT NULL,
    group_name character varying(255),
    parent_group_id character varying(255),
    is_root boolean,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    group_value character varying
);


--
-- Name: hr_approval_action; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_approval_action (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    request_id character varying(255) NOT NULL,
    level integer NOT NULL,
    action character varying(20) NOT NULL,
    actor_id character varying(255) NOT NULL,
    comments text,
    acted_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_approval_chain; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_approval_chain (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    entity_type character varying(50) NOT NULL,
    approval_levels integer DEFAULT 1,
    level_config jsonb DEFAULT '[]'::jsonb,
    auto_approve_after_days integer,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_approval_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_approval_request (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(255) NOT NULL,
    requester_id character varying(255) NOT NULL,
    current_level integer DEFAULT 1,
    total_levels integer DEFAULT 1,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_attendance_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_attendance_config (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    mode character varying(20) DEFAULT 'DAY_LEVEL'::character varying NOT NULL,
    auto_checkout_enabled boolean DEFAULT false,
    auto_checkout_time time without time zone,
    geo_fence_enabled boolean DEFAULT false,
    geo_fence_lat double precision,
    geo_fence_lng double precision,
    geo_fence_radius_m integer,
    ip_restriction_enabled boolean DEFAULT false,
    allowed_ips jsonb DEFAULT '[]'::jsonb,
    overtime_enabled boolean DEFAULT false,
    overtime_threshold_min integer DEFAULT 480,
    half_day_threshold_min integer DEFAULT 240,
    weekend_days jsonb DEFAULT '["SATURDAY", "SUNDAY"]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_attendance_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_attendance_record (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    attendance_date date NOT NULL,
    shift_id character varying(255),
    check_in_time timestamp without time zone,
    check_out_time timestamp without time zone,
    total_hours numeric(5,2),
    overtime_hours numeric(5,2) DEFAULT 0,
    break_duration_min integer,
    status character varying(20) DEFAULT 'PRESENT'::character varying NOT NULL,
    check_in_lat double precision,
    check_in_lng double precision,
    check_out_lat double precision,
    check_out_lng double precision,
    check_in_ip character varying(45),
    check_out_ip character varying(45),
    source character varying(20) DEFAULT 'MANUAL'::character varying,
    remarks text,
    is_regularized boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_attendance_regularization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_attendance_regularization (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    attendance_id character varying(255) NOT NULL,
    employee_id character varying(255) NOT NULL,
    original_status character varying(20),
    requested_status character varying(20),
    original_check_in timestamp without time zone,
    original_check_out timestamp without time zone,
    requested_check_in timestamp without time zone,
    requested_check_out timestamp without time zone,
    reason text NOT NULL,
    approval_status character varying(20) DEFAULT 'PENDING'::character varying,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    remarks text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_bank_export_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_bank_export_log (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    payroll_run_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    file_id character varying(255),
    file_name character varying(255),
    format character varying(20),
    total_records integer,
    total_amount numeric(18,2),
    generated_by character varying(255),
    generated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_comp_off; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_comp_off (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    worked_on_date date NOT NULL,
    earned_days numeric(3,1) DEFAULT 1.0,
    expiry_date date,
    used boolean DEFAULT false,
    used_leave_application_id character varying(255),
    approved_by character varying(255),
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_department (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50),
    parent_id character varying(255),
    head_user_id character varying(255),
    description text,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_designation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_designation (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50),
    level integer,
    grade character varying(50),
    description text,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_bank_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_bank_detail (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    account_holder_name character varying(255),
    account_number character varying(50) NOT NULL,
    bank_name character varying(255),
    branch_name character varying(255),
    ifsc_code character varying(20),
    swift_code character varying(20),
    routing_number character varying(20),
    iban character varying(50),
    is_primary boolean DEFAULT true,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_document (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    document_type character varying(50),
    document_name character varying(255),
    file_id character varying(255),
    file_url text,
    expiry_date date,
    verified boolean DEFAULT false,
    verified_by character varying(255),
    verified_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_loan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_loan (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    loan_type character varying(30),
    principal_amount numeric(15,2) NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0,
    tenure_months integer NOT NULL,
    emi_amount numeric(15,2) NOT NULL,
    disbursed_amount numeric(15,2),
    balance_amount numeric(15,2),
    start_month integer,
    start_year integer,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_profile (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    employee_code character varying(50),
    department_id character varying(255),
    designation_id character varying(255),
    reporting_manager_id character varying(255),
    employment_type character varying(20),
    employment_status character varying(20) DEFAULT 'ACTIVE'::character varying,
    join_date date NOT NULL,
    probation_end_date date,
    confirmation_date date,
    notice_period_days integer DEFAULT 30,
    resignation_date date,
    last_working_date date,
    exit_reason text,
    emergency_contact_name character varying(255),
    emergency_contact_phone character varying(25),
    emergency_contact_relation character varying(50),
    nationality character varying(100),
    blood_group character varying(5),
    marital_status character varying(20),
    pan_number character varying(20),
    tax_id_number character varying(50),
    uan_number character varying(20),
    statutory_info jsonb DEFAULT '{}'::jsonb,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_salary_component; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_salary_component (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    salary_structure_id character varying(255) NOT NULL,
    component_id character varying(255) NOT NULL,
    monthly_amount numeric(15,2) NOT NULL,
    annual_amount numeric(15,2) NOT NULL,
    calculation_type character varying(30),
    percentage_value numeric(8,4),
    is_overridden boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_salary_structure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_salary_structure (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    template_id character varying(255),
    effective_from date NOT NULL,
    effective_to date,
    ctc_annual numeric(15,2) NOT NULL,
    ctc_monthly numeric(15,2),
    gross_monthly numeric(15,2),
    net_monthly numeric(15,2),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    revision_reason text,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_employee_shift_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_shift_mapping (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    shift_id character varying(255) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_holiday; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_holiday (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    date date NOT NULL,
    type character varying(20) DEFAULT 'NATIONAL'::character varying,
    is_optional boolean DEFAULT false,
    max_optional_allowed integer,
    year integer NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_leave_application; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave_application (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    leave_type_id character varying(255) NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    total_days numeric(5,1) NOT NULL,
    is_half_day boolean DEFAULT false,
    half_day_type character varying(10),
    reason text,
    document_file_id character varying(255),
    status character varying(20) DEFAULT 'PENDING'::character varying,
    applied_to character varying(255),
    approved_by character varying(255),
    approved_at timestamp without time zone,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_leave_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave_balance (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    leave_type_id character varying(255) NOT NULL,
    year integer NOT NULL,
    opening_balance numeric(5,1) DEFAULT 0,
    accrued numeric(5,1) DEFAULT 0,
    used numeric(5,1) DEFAULT 0,
    adjustment numeric(5,1) DEFAULT 0,
    carried_forward numeric(5,1) DEFAULT 0,
    encashed numeric(5,1) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_leave_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave_policy (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    leave_type_id character varying(255) NOT NULL,
    annual_quota numeric(5,1) NOT NULL,
    accrual_type character varying(20) DEFAULT 'YEARLY'::character varying,
    accrual_amount numeric(5,2),
    pro_rata_enabled boolean DEFAULT true,
    applicable_after_days integer DEFAULT 0,
    applicable_employment_types jsonb DEFAULT '["FULL_TIME"]'::jsonb,
    effective_from date NOT NULL,
    effective_to date,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_leave_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave_type (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    is_paid boolean DEFAULT true,
    is_carry_forward boolean DEFAULT false,
    max_carry_forward integer DEFAULT 0,
    is_encashable boolean DEFAULT false,
    requires_document boolean DEFAULT false,
    min_days numeric(3,1) DEFAULT 0.5,
    max_consecutive_days integer,
    applicable_gender character varying(10) DEFAULT 'ALL'::character varying,
    description text,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_loan_repayment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_loan_repayment (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    loan_id character varying(255) NOT NULL,
    payroll_entry_id character varying(255),
    amount numeric(15,2) NOT NULL,
    repayment_date date,
    month integer,
    year integer,
    balance_after numeric(15,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_payroll_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_payroll_entry (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    payroll_run_id character varying(255) NOT NULL,
    employee_id character varying(255) NOT NULL,
    salary_structure_id character varying(255),
    gross_salary numeric(15,2) NOT NULL,
    total_earnings numeric(15,2),
    total_deductions numeric(15,2),
    total_employer_contributions numeric(15,2),
    net_pay numeric(15,2) NOT NULL,
    total_working_days integer,
    days_present numeric(5,1),
    days_absent numeric(5,1),
    days_on_leave numeric(5,1),
    days_holiday integer,
    overtime_hours numeric(5,2) DEFAULT 0,
    arrears numeric(15,2) DEFAULT 0,
    reimbursements numeric(15,2) DEFAULT 0,
    loan_deduction numeric(15,2) DEFAULT 0,
    other_earnings numeric(15,2) DEFAULT 0,
    other_deductions numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'CALCULATED'::character varying,
    hold_reason text,
    bank_account_id character varying(255),
    payment_ref character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_payroll_entry_component; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_payroll_entry_component (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    payroll_entry_id character varying(255) NOT NULL,
    component_id character varying(255) NOT NULL,
    component_type character varying(30),
    amount numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_payroll_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_payroll_run (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    run_date date,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    total_employees integer,
    total_gross numeric(18,2),
    total_deductions numeric(18,2),
    total_net_pay numeric(18,2),
    total_employer_cost numeric(18,2),
    processed_by character varying(255),
    processed_at timestamp without time zone,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    paid_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_payslip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_payslip (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    payroll_entry_id character varying(255) NOT NULL,
    employee_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    file_id character varying(255),
    file_url text,
    generated_at timestamp without time zone,
    emailed_at timestamp without time zone,
    email_status character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_reimbursement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_reimbursement (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    type character varying(50),
    amount numeric(15,2) NOT NULL,
    description text,
    receipt_file_id character varying(255),
    expense_date date,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    payroll_entry_id character varying(255),
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_salary_component; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_salary_component (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(30) NOT NULL,
    type character varying(30) NOT NULL,
    category character varying(30),
    is_taxable boolean DEFAULT true,
    is_statutory boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_salary_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_salary_revision (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    old_structure_id character varying(255),
    new_structure_id character varying(255) NOT NULL,
    old_ctc numeric(15,2),
    new_ctc numeric(15,2),
    increment_pct numeric(5,2),
    reason text,
    effective_date date NOT NULL,
    approved_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_salary_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_salary_template (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_salary_template_component; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_salary_template_component (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    template_id character varying(255) NOT NULL,
    component_id character varying(255) NOT NULL,
    calculation_type character varying(30) NOT NULL,
    percentage_value numeric(8,4),
    fixed_value numeric(15,2),
    formula text,
    min_value numeric(15,2),
    max_value numeric(15,2),
    display_order integer DEFAULT 0,
    is_mandatory boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_shift (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_duration_min integer DEFAULT 60,
    is_night_shift boolean DEFAULT false,
    grace_period_min integer DEFAULT 15,
    min_hours_full_day numeric(4,2) DEFAULT 8.0,
    min_hours_half_day numeric(4,2) DEFAULT 4.0,
    is_default boolean DEFAULT false,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_tax_computation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tax_computation (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    financial_year character varying(10) NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    projected_annual_income numeric(15,2),
    projected_annual_tax numeric(15,2),
    projected_monthly_tax numeric(15,2),
    actual_income_till_date numeric(15,2),
    actual_tax_deducted numeric(15,2),
    total_exemptions numeric(15,2),
    total_deductions_80c numeric(15,2),
    computation_details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_tax_configuration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tax_configuration (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    country_code character varying(3) NOT NULL,
    state_code character varying(10),
    financial_year_start_month integer DEFAULT 4,
    tax_rules jsonb DEFAULT '{}'::jsonb,
    employer_contributions jsonb DEFAULT '{}'::jsonb,
    statutory_settings jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hr_tax_declaration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tax_declaration (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    employee_id character varying(255) NOT NULL,
    financial_year character varying(10) NOT NULL,
    regime character varying(20),
    declarations jsonb DEFAULT '{}'::jsonb NOT NULL,
    proof_submitted boolean DEFAULT false,
    proof_verified boolean DEFAULT false,
    verified_by character varying(255),
    verified_at timestamp without time zone,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: html_video_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.html_video_slide (
    id character varying(255) NOT NULL,
    ai_gen_video_id character varying(255),
    url character varying(255),
    video_length bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    code_editor_config json
);


--
-- Name: institute_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(255) NOT NULL,
    total_credits numeric(12,2) DEFAULT 0,
    used_credits numeric(12,2) DEFAULT 0,
    current_balance numeric(12,2) DEFAULT 0,
    low_balance_threshold numeric(12,2) DEFAULT 50,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: institute_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_custom_fields (
    id character varying(255) NOT NULL,
    institute_id character varying(36) NOT NULL,
    custom_field_id character varying(36) NOT NULL,
    type character varying(50) NOT NULL,
    type_id character varying(36),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    group_name character varying(255),
    individual_order integer,
    group_internal_order integer,
    is_mandatory boolean DEFAULT false
);


--
-- Name: institute_domain_routing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_domain_routing (
    id character varying(255) NOT NULL,
    domain character varying(255) NOT NULL,
    subdomain character varying(255) NOT NULL,
    role character varying(100) NOT NULL,
    institute_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    redirect character varying(255) DEFAULT '/login'::character varying,
    privacy_policy_url character varying(500),
    terms_and_condition_url character varying(500),
    theme character varying(255),
    tab_text character varying(255),
    allow_signup boolean,
    tab_icon_file_id character varying(255),
    font_family character varying(255),
    after_login_route character varying(255),
    allow_google_auth boolean,
    allow_github_auth boolean,
    allow_email_otp_auth boolean,
    allow_username_password_auth boolean,
    admin_portal_after_logout_route character varying(255),
    home_icon_click_route character varying(255),
    play_store_app_link character varying(500),
    app_store_app_link character varying(500),
    windows_app_link character varying(500),
    mac_app_link character varying(500),
    convert_username_password_to_lowercase boolean DEFAULT false NOT NULL,
    allow_phone_auth boolean,
    sub_org_id character varying(255),
    comma_separated_preferred_country character varying(500),
    hide_institute_name boolean,
    logo_width_px integer,
    logo_height_px integer,
    apply_naming_setting boolean DEFAULT false NOT NULL
);


--
-- Name: institute_fee_type_priority; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_fee_type_priority (
    id character varying(255) DEFAULT (gen_random_uuid())::character varying NOT NULL,
    institute_id character varying(255) NOT NULL,
    scope character varying(50) NOT NULL,
    fee_type_id character varying(255) NOT NULL,
    priority_order integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: institute_live_session_provider_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_live_session_provider_mapping (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(36),
    provider character varying(50) NOT NULL,
    config_json text NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    vendor_user_id character varying(100)
);


--
-- Name: institute_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_metadata (
    id character varying(255) NOT NULL,
    institute_id character varying(255),
    source_key character varying(255),
    source_key_string character varying(255),
    source_value character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: institute_payment_gateway_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_payment_gateway_mapping (
    id character varying(36) NOT NULL,
    vendor character varying(100) NOT NULL,
    institute_id character varying(36) NOT NULL,
    payment_gateway_specific_data text,
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: institute_submodule_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_submodule_mapping (
    institute_id character varying(255),
    submodule_id character varying(255),
    id character varying(255) NOT NULL
);


--
-- Name: institute_suborg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_suborg (
    id character varying(255) NOT NULL,
    institute_id character varying(255) DEFAULT NULL::character varying,
    suborg_id character varying(255) DEFAULT NULL::character varying,
    name character varying(255) DEFAULT NULL::character varying,
    description character varying(255) DEFAULT NULL::character varying,
    status character varying(255) DEFAULT NULL::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: institute_youtube_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institute_youtube_credentials (
    institute_id character varying(255) NOT NULL,
    refresh_token_encrypted text NOT NULL,
    channel_id character varying(255),
    channel_title character varying(512),
    channel_thumbnail_url text,
    scopes text,
    connected_by_user_id character varying(255),
    status character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    last_validated_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: institutes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institutes (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    address_line character varying(255),
    pin_code character varying(255),
    mobile_number character varying(255),
    logo_file_id character varying(255),
    language character varying(255),
    institute_theme_code character varying(255),
    website_url character varying(255),
    description text,
    founded_date date,
    type character varying(255),
    held character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    country character varying(255),
    state character varying(255),
    city character varying(255),
    email character varying(255),
    letterhead_file_id character varying(255),
    cover_media_id character varying(511),
    subdomain text,
    cover_image_file_id character varying(255),
    cover_text_json text,
    setting_json text,
    learner_portal_base_url character varying(255) DEFAULT 'learner.vacademy.io'::character varying,
    teacher_portal_base_url character varying(255) DEFAULT 'teacher.vacademy.io'::character varying,
    admin_portal_base_url character varying(255) DEFAULT 'dash.vacademy.io'::character varying,
    board character varying(255),
    gst_details text,
    affiliation_number character varying(255),
    staff_strength integer,
    school_strength integer,
    lead_tag character varying(50) DEFAULT 'PROD'::character varying,
    account_type character varying(32),
    product character varying(32) DEFAULT 'vacademy'::character varying NOT NULL,
    company_size character varying(32),
    currency character varying(3),
    gstin character varying(15),
    state_code character varying(2)
);


--
-- Name: COLUMN institutes.board; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.board IS 'Education board (e.g., CBSE, ICSE, State Board)';


--
-- Name: COLUMN institutes.gst_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.gst_details IS 'GST registration number and details';


--
-- Name: COLUMN institutes.affiliation_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.affiliation_number IS 'Official affiliation number from the board';


--
-- Name: COLUMN institutes.staff_strength; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.staff_strength IS 'Total number of staff members';


--
-- Name: COLUMN institutes.school_strength; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.school_strength IS 'Total number of students enrolled';


--
-- Name: COLUMN institutes.account_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.account_type IS 'Vimotion account type: individual | studio | agency. NULL for legacy Vacademy institutes.';


--
-- Name: COLUMN institutes.product; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.product IS 'Source product that owns this institute row: vacademy | vimotion. Defaults to vacademy.';


--
-- Name: COLUMN institutes.company_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.institutes.company_size IS 'Vimotion company-size bucket (e.g. 1-10, 11-50, 51-200, 201+). NULL for individuals/legacy.';


--
-- Name: instructor_copilot_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instructor_copilot_logs (
    id character varying(255) NOT NULL,
    created_by_user_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    title character varying(255),
    thumbnail_file_id character varying(255),
    transcript_json text,
    flashnotes_json text,
    summary text,
    question_json text,
    flashcard_json text,
    slides_json text,
    video_json text,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    package_session_id character varying(255),
    subject_id character varying(255)
);


--
-- Name: invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice (
    id character varying(255) NOT NULL,
    invoice_number character varying(100) NOT NULL,
    user_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    invoice_date timestamp without time zone NOT NULL,
    due_date timestamp without time zone NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount_amount numeric(10,2),
    tax_amount numeric(10,2),
    total_amount numeric(10,2) NOT NULL,
    currency character varying(10) NOT NULL,
    status character varying(50) NOT NULL,
    pdf_file_id character varying(255),
    invoice_data_json text,
    tax_included boolean,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: invoice_line_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line_item (
    id character varying(255) NOT NULL,
    invoice_id character varying(255) NOT NULL,
    item_type character varying(50) NOT NULL,
    description text,
    quantity integer,
    unit_price numeric(10,2),
    amount numeric(10,2) NOT NULL,
    source_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: invoice_payment_log_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_payment_log_mapping (
    id character varying(255) NOT NULL,
    invoice_id character varying(255) NOT NULL,
    payment_log_id character varying(255) NOT NULL
);


--
-- Name: issued_certificate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issued_certificate (
    id character varying(36) NOT NULL,
    institute_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    package_session_id character varying(255) NOT NULL,
    course_name character varying(500),
    completion_percentage integer,
    issued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    file_id character varying(255),
    template_html_snapshot text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    certificate_id character varying(36) NOT NULL
);


--
-- Name: knowledge_base_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_items (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    title character varying(500) NOT NULL,
    content text NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_assignment_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_assignment_counter (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    scope_type character varying(50) NOT NULL,
    scope_id text NOT NULL,
    last_index integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: lead_followup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_followup (
    id character varying(255) NOT NULL,
    audience_response_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    created_by character varying(255),
    schedule_time timestamp without time zone,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    content text,
    closer_reason text,
    closed_by character varying(255),
    closed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: lead_score; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_score (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    audience_response_id text NOT NULL,
    audience_id text NOT NULL,
    institute_id text NOT NULL,
    raw_score integer DEFAULT 0 NOT NULL,
    percentile_rank numeric(5,2) DEFAULT 50.0,
    scoring_factors_json text,
    last_calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_manual_override boolean DEFAULT false
);


--
-- Name: lead_sla_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_sla_config (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    tat_enabled boolean DEFAULT false NOT NULL,
    tat_hours integer DEFAULT 24 NOT NULL,
    followup_enabled boolean DEFAULT false NOT NULL,
    followup_sla_hours integer DEFAULT 24 NOT NULL,
    followup_remind_before_minutes integer DEFAULT 30 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_sla_notify_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_sla_notify_role (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    sla_type character varying(20) NOT NULL,
    role_name character varying(255) NOT NULL
);


--
-- Name: lead_sla_reminder_window; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_sla_reminder_window (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    sla_type character varying(20) DEFAULT 'TAT'::character varying NOT NULL,
    before_minutes integer NOT NULL,
    display_order integer DEFAULT 0 NOT NULL
);


--
-- Name: lead_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_status (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(255) NOT NULL,
    status_key character varying(100) NOT NULL,
    label character varying(255) NOT NULL,
    color character varying(20),
    display_order integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_system boolean DEFAULT false NOT NULL
);


--
-- Name: lead_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_status_history (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    audience_response_id text NOT NULL,
    institute_id character varying(255) NOT NULL,
    from_status_id text,
    to_status_id text,
    changed_by_user_id character varying(255),
    source character varying(30) DEFAULT 'MANUAL'::character varying NOT NULL,
    changed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: learner_invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_invitation (
    id character varying(255) NOT NULL,
    name character varying(255),
    status character varying(255),
    date_generated date,
    expiry_date date,
    institute_id character varying(255),
    invite_code character varying(255),
    batch_options_json text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source character varying(255),
    source_id character varying(255)
);


--
-- Name: learner_invitation_custom_field; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_invitation_custom_field (
    id character varying(255) NOT NULL,
    field_name character varying(255),
    field_type character varying(100),
    comma_separated_options text,
    is_mandatory boolean,
    description text,
    default_value character varying(255),
    learner_invitation_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    field_order integer
);


--
-- Name: learner_invitation_custom_field_response; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_invitation_custom_field_response (
    id character varying(255) NOT NULL,
    custom_field_id character varying(255) NOT NULL,
    learner_invitation_response_id character varying(255) NOT NULL,
    value text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: learner_invitation_response; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_invitation_response (
    id character varying(255) NOT NULL,
    learner_invitation_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    status character varying(255) NOT NULL,
    full_name character varying(255),
    email character varying(255),
    contact_number character varying(20),
    batch_options_json text,
    message_by_institute text,
    batch_selection_json text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    recorded_on date DEFAULT CURRENT_DATE
);


--
-- Name: learner_operation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_operation (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    source character varying(255),
    source_id character varying(255),
    operation character varying(255),
    value character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: learning_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_analytics (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    session_id character varying(255),
    event_type character varying(50) NOT NULL,
    topic character varying(500),
    score double precision,
    total integer,
    meta_data jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: level; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.level (
    id character varying(255) NOT NULL,
    level_name character varying(255),
    duration_in_days integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    status character varying(255),
    thumbnail_file_id character varying(255),
    created_by_user_id character varying(255),
    updated_by_user_id character varying(255)
);


--
-- Name: linked_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linked_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source character varying(255),
    source_id character varying(255),
    linked_session_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: linked_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linked_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source character varying(255),
    source_id character varying(255),
    user_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: live_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    start_time timestamp without time zone,
    last_entry_time timestamp without time zone,
    access_level character varying(20) DEFAULT 'private'::character varying,
    meeting_type character varying(20),
    default_meet_link text,
    waiting_room_link text,
    registration_form_link_for_public_sessions text,
    created_by_user_id character varying(255) NOT NULL,
    title character varying(255),
    description_html text,
    notification_email_message text,
    attendance_email_message text,
    cover_file_id text,
    subject character varying(255),
    status character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT now(),
    link_type character varying(255),
    institute_id character varying(255),
    waiting_room_time integer,
    thumbnail_file_id character varying(255),
    background_score_file_id character varying(255),
    allow_rewind boolean,
    session_streaming_service_type character varying(255),
    allow_play_pause boolean,
    timezone character varying(100),
    booking_type_id character varying(255),
    source character varying(255),
    source_id character varying(255),
    learner_button_config text,
    bbb_config_json text,
    feedback_config_json text
);


--
-- Name: live_session_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session_logs (
    id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    schedule_id character varying(255) NOT NULL,
    user_source_type character varying(30) NOT NULL,
    user_source_id character varying(255) NOT NULL,
    log_type character varying(30) NOT NULL,
    status character varying(20),
    details text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT now(),
    provider_join_time character varying(50),
    provider_total_duration_minutes integer,
    status_type character varying(10) DEFAULT 'ONLINE'::character varying,
    engagement_data text,
    provider_meeting_id character varying(255)
);


--
-- Name: live_session_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_session_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_session_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_session_logs_id_seq OWNED BY public.live_session_logs.id;


--
-- Name: live_session_notification_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session_notification_config (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    session_id character varying(255) NOT NULL,
    notification_type character varying(30) NOT NULL,
    channels character varying(100) NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: live_session_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session_participants (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    session_id character varying(255) NOT NULL,
    source_type character varying(20) NOT NULL,
    source_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: migration_staging_keap_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_staging_keap_payments (
    id character varying(255) NOT NULL,
    keap_contact_id character varying(255),
    email character varying(255),
    amount double precision,
    transaction_date timestamp without time zone,
    transaction_id character varying(255),
    status character varying(255),
    raw_data text,
    migration_status character varying(255),
    error_message text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: migration_staging_keap_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_staging_keap_users (
    id character varying(255) NOT NULL,
    keap_contact_id character varying(255),
    email character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    phone character varying(255),
    address character varying(255),
    city character varying(255),
    state character varying(255),
    zip_code character varying(255),
    country character varying(255),
    product_id character varying(255),
    start_date timestamp without time zone,
    next_bill_date timestamp without time zone,
    eway_token character varying(255),
    record_type character varying(255),
    raw_data text,
    migration_status character varying(255),
    error_message text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    job_type character varying(255),
    practice_role character varying(50),
    practice_name character varying(255),
    root_admin_id character varying(255),
    user_plan_status character varying(255)
);


--
-- Name: model_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_pattern character varying(100) NOT NULL,
    tier character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    multiplier numeric(4,2) DEFAULT 1.0 NOT NULL,
    description character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: model_recommendations; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.model_recommendations AS
 SELECT model_id,
    name,
    provider,
    tier,
    is_free,
    quality_score,
    speed_score,
    input_price_per_1m,
    output_price_per_1m,
    credit_multiplier,
    unnest(recommended_for) AS use_case
   FROM public.ai_models m
  WHERE (is_active = true)
  ORDER BY quality_score DESC, speed_score DESC;


--
-- Name: module_chapter_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_chapter_mapping (
    id character varying NOT NULL,
    chapter_id character varying NOT NULL,
    module_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    id character varying(255) NOT NULL,
    module_name character varying(255),
    status character varying(255),
    description character varying(255),
    thumbnail_id character varying(255),
    parent_id character varying(255),
    created_by_user_id character varying(255)
);


--
-- Name: node_dedupe_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_dedupe_record (
    id character varying NOT NULL,
    workflow_id character varying NOT NULL,
    node_template_id character varying NOT NULL,
    workflow_id_scope character varying,
    schedule_run_id character varying,
    operation_key character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: node_execution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_execution (
    id character varying NOT NULL,
    workflow_execution_id character varying NOT NULL,
    node_link_id character varying NOT NULL,
    node_template_id character varying NOT NULL,
    execution_order integer NOT NULL,
    status character varying DEFAULT 'PENDING'::character varying NOT NULL,
    input_data text,
    output_data text,
    routing_decision_json text,
    error_message text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone
);


--
-- Name: node_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_template (
    id character varying NOT NULL,
    institute_id character varying NOT NULL,
    node_name character varying NOT NULL,
    node_type character varying NOT NULL,
    status character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    config_json text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version integer DEFAULT 1,
    retry_config jsonb
);


--
-- Name: node_template_backup_bug2_case; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_template_backup_bug2_case (
    id character varying,
    institute_id character varying,
    node_name character varying,
    node_type character varying,
    status character varying,
    config_json text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    version integer,
    retry_config jsonb,
    backed_up_at timestamp with time zone
);


--
-- Name: node_template_backup_bug6; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_template_backup_bug6 (
    id character varying,
    institute_id character varying,
    node_name character varying,
    node_type character varying,
    status character varying,
    config_json text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    version integer,
    retry_config jsonb,
    backed_up_at timestamp with time zone
);


--
-- Name: notification_event_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_event_config (
    id character varying(255) NOT NULL,
    event_name character varying(100) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_id character varying(255) NOT NULL,
    template_type character varying(50) NOT NULL,
    template_id character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(255),
    template_name character varying(255)
);


--
-- Name: notification_rate_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_rate_limit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institute_id character varying(255) NOT NULL,
    channel character varying(50) NOT NULL,
    daily_limit integer DEFAULT 1000 NOT NULL,
    daily_used integer DEFAULT 0 NOT NULL,
    reset_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_setting (
    id character varying(64) NOT NULL,
    source character varying(255),
    source_id character varying(255),
    comma_separated_communication_types text,
    status character varying(50),
    comma_separated_email_ids text,
    comma_separated_mobile_numbers text,
    comma_separated_roles text,
    monthly boolean,
    weekly boolean,
    daily boolean,
    type character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: oauth_connect_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_connect_state (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    vendor character varying(50) NOT NULL,
    audience_id character varying(255),
    initiated_by character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    user_token_enc text,
    pages_json_enc text,
    session_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL
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
    explanation_text_id character varying(255)
);


--
-- Name: ota_bundle_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ota_bundle_version (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    version character varying(20) NOT NULL,
    platform character varying(10) DEFAULT 'ALL'::character varying NOT NULL,
    bundle_file_id text NOT NULL,
    bundle_download_url text NOT NULL,
    checksum character varying(64) NOT NULL,
    bundle_size_bytes bigint,
    min_native_version character varying(20) DEFAULT '1.0.0'::character varying NOT NULL,
    force_update boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    target_app_ids text,
    release_notes text,
    published_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: package; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package (
    id character varying(255) NOT NULL,
    package_name character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    thumbnail_file_id character varying(255),
    status character varying(50) NOT NULL,
    is_course_published_to_catalaouge boolean,
    course_preview_image_media_id character varying(255),
    course_banner_media_id character varying(255),
    course_media_id character varying(255),
    why_learn text,
    who_should_learn text,
    about_the_course text,
    comma_separated_tags text,
    course_depth integer,
    course_html_description text,
    original_course_id character varying(255),
    created_by_user_id character varying(255),
    version_number integer DEFAULT 1,
    course_audit_logs text,
    package_type character varying(50) DEFAULT 'COURSE'::character varying,
    drip_condition_json text,
    course_setting text,
    updated_by_user_id character varying(255)
);


--
-- Name: package_group_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_group_mapping (
    id character varying(255) NOT NULL,
    group_id character varying(255) NOT NULL,
    package_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: package_institute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_institute (
    package_id character varying(255),
    group_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    institute_id character varying NOT NULL,
    id character varying NOT NULL
);


--
-- Name: package_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_session (
    id character varying(255) NOT NULL,
    level_id character varying(255),
    session_id character varying(255),
    start_time date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    status character varying(255),
    package_id character varying(255),
    group_id character varying(255),
    enrollment_policy_settings text,
    is_org_associated boolean DEFAULT false,
    available_slots integer DEFAULT 0,
    max_seats integer,
    version bigint DEFAULT 0,
    is_parent boolean DEFAULT false,
    parent_id character varying(255),
    name character varying(255),
    content_copied_by character varying(20),
    content_copied_from_package_session_id character varying(255),
    created_by_user_id character varying(255),
    updated_by_user_id character varying(255),
    CONSTRAINT check_positive_available_slots CHECK ((available_slots >= 0))
);


--
-- Name: package_session_enroll_invite_payment_plan_to_referral_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_session_enroll_invite_payment_plan_to_referral_option (
    id character varying(36) NOT NULL,
    payment_plan_id character varying(36) NOT NULL,
    referral_option_id character varying(36) NOT NULL,
    package_session_invite_payment_option_id character varying(36) NOT NULL,
    status character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: package_session_learner_invitation_to_payment_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_session_learner_invitation_to_payment_option (
    id character varying(255) NOT NULL,
    enroll_invite_id character varying(255),
    package_session_id character varying(255),
    payment_option_id character varying(255),
    status character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cpo_id character varying(255)
);


--
-- Name: payment_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_log (
    id character varying(255) NOT NULL,
    status character varying(255),
    payment_status character varying(255),
    user_id character varying(255),
    vendor character varying(255),
    vendor_id character varying(255),
    date date,
    currency character varying(255),
    user_plan_id character varying(255),
    payment_amount double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payment_specific_data text,
    tracking_id character varying(255) DEFAULT NULL::character varying,
    tracking_source character varying(255) DEFAULT NULL::character varying,
    order_status character varying(50) DEFAULT 'ORDERED'::character varying,
    unallocated_amount double precision DEFAULT 0
);


--
-- Name: COLUMN payment_log.tracking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_log.tracking_id IS 'External tracking ID from shipping provider';


--
-- Name: COLUMN payment_log.tracking_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_log.tracking_source IS 'Source of tracking information (e.g., FedEx, UPS, DHL)';


--
-- Name: COLUMN payment_log.order_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_log.order_status IS 'Order fulfillment status (ORDERED, SHIPPED, DELIVERED, CANCELLED)';


--
-- Name: COLUMN payment_log.unallocated_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_log.unallocated_amount IS 'Amount from this payment that was not allocated to any student_fee_payment (excess/overpayment).';


--
-- Name: payment_log_line_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_log_line_item (
    id character varying(255) NOT NULL,
    payment_log_id character varying(255),
    type character varying(255),
    amount integer,
    source character varying(255),
    source_id character varying(255)
);


--
-- Name: payment_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_option (
    id character varying(255) NOT NULL,
    name character varying(255),
    status character varying(255),
    source character varying(255),
    source_id character varying(255),
    tag character varying(255),
    type character varying(255),
    require_approval boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payment_option_metadata_json text,
    unit character varying(255),
    complex_payment_option_id character varying(255)
);


--
-- Name: COLUMN payment_option.unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_option.unit IS 'Unit information for the payment option (e.g., currency, time period, etc.)';


--
-- Name: payment_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_plan (
    id character varying(255) NOT NULL,
    name character varying(255),
    status character varying(255),
    validity_in_days integer,
    actual_price double precision,
    elevated_price double precision,
    currency character varying(255),
    description text,
    tag character varying(255),
    feature_json text,
    payment_option_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    member_count integer DEFAULT 1
);


--
-- Name: COLUMN payment_plan.member_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_plan.member_count IS 'Maximum number of members that can be added for sub-org plans. Default is 1.';


--
-- Name: persistent_guest_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persistent_guest_tokens (
    id character varying(255) NOT NULL,
    token character varying(500) NOT NULL,
    email character varying(255) NOT NULL,
    guest_name character varying(255),
    mobile_number character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    last_used_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE persistent_guest_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.persistent_guest_tokens IS 'Stores persistent tokens for guest users to avoid re-entering details';


--
-- Name: COLUMN persistent_guest_tokens.token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.persistent_guest_tokens.token IS 'Unique token string for guest identification';


--
-- Name: COLUMN persistent_guest_tokens.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.persistent_guest_tokens.expires_at IS 'When the token expires (typically 4 days after creation)';


--
-- Name: COLUMN persistent_guest_tokens.last_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.persistent_guest_tokens.last_used_at IS 'Last time the token was used to track activity';


--
-- Name: COLUMN persistent_guest_tokens.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.persistent_guest_tokens.is_active IS 'Whether the token is still valid';


--
-- Name: platform_invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_invoice (
    id character varying(255) NOT NULL,
    platform_payment_id character varying(255) NOT NULL,
    invoice_number character varying(64) NOT NULL,
    supplier_legal_name character varying(255) NOT NULL,
    supplier_gstin character varying(15),
    supplier_state_code character varying(2) NOT NULL,
    supplier_address text NOT NULL,
    buyer_institute_id character varying(255) NOT NULL,
    buyer_legal_name character varying(255) NOT NULL,
    buyer_gstin character varying(15),
    buyer_state_code character varying(2),
    buyer_address text,
    place_of_supply character varying(2) NOT NULL,
    is_export boolean DEFAULT false NOT NULL,
    currency character varying(3) NOT NULL,
    base_amount_minor bigint NOT NULL,
    cgst_amount_minor bigint DEFAULT 0 NOT NULL,
    sgst_amount_minor bigint DEFAULT 0 NOT NULL,
    igst_amount_minor bigint DEFAULT 0 NOT NULL,
    total_amount_minor bigint NOT NULL,
    pdf_s3_url text,
    issued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: platform_invoice_line_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_invoice_line_item (
    id character varying(255) NOT NULL,
    platform_invoice_id character varying(255) NOT NULL,
    description character varying(255) NOT NULL,
    hsn_sac_code character varying(8) NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    unit_price_minor bigint NOT NULL,
    base_amount_minor bigint NOT NULL,
    cgst_rate_bps integer DEFAULT 0 NOT NULL,
    cgst_amount_minor bigint DEFAULT 0 NOT NULL,
    sgst_rate_bps integer DEFAULT 0 NOT NULL,
    sgst_amount_minor bigint DEFAULT 0 NOT NULL,
    igst_rate_bps integer DEFAULT 0 NOT NULL,
    igst_amount_minor bigint DEFAULT 0 NOT NULL,
    total_amount_minor bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: platform_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_payment (
    id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    buyer_user_id character varying(255),
    vendor character varying(32) DEFAULT 'RAZORPAY'::character varying NOT NULL,
    vendor_order_id character varying(64),
    vendor_payment_id character varying(64),
    currency character varying(3) NOT NULL,
    base_amount_minor bigint NOT NULL,
    tax_amount_minor bigint DEFAULT 0 NOT NULL,
    total_amount_minor bigint NOT NULL,
    status character varying(32) NOT NULL,
    payment_status character varying(32) NOT NULL,
    payment_specific_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: platform_payment_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_payment_config (
    id character varying(255) NOT NULL,
    singleton_lock boolean DEFAULT true NOT NULL,
    vendor character varying(32) DEFAULT 'RAZORPAY'::character varying NOT NULL,
    api_key character varying(255) NOT NULL,
    key_secret_encrypted text NOT NULL,
    webhook_secret_encrypted text NOT NULL,
    supplier_legal_name character varying(255) NOT NULL,
    supplier_gstin character varying(15),
    supplier_state_code character varying(2) NOT NULL,
    supplier_address text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT platform_payment_config_singleton_chk CHECK ((singleton_lock = true))
);


--
-- Name: platform_payment_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_payment_item (
    id character varying(255) NOT NULL,
    platform_payment_id character varying(255) NOT NULL,
    pack_id character varying(255) NOT NULL,
    pack_code_snapshot character varying(64) NOT NULL,
    credits numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    base_amount_minor bigint NOT NULL,
    tax_rate_bps integer NOT NULL,
    tax_amount_minor bigint NOT NULL,
    total_amount_minor bigint NOT NULL,
    hsn_sac_snapshot character varying(8) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_page; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_page (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    institute_id character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'DRAFT'::character varying NOT NULL,
    page_json text,
    settings_json text,
    short_url character varying(500),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_page_invite_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_page_invite_mapping (
    id character varying(255) NOT NULL,
    product_page_id character varying(255) NOT NULL,
    ps_invite_payment_option_id character varying(255) NOT NULL,
    payment_plan_id character varying(255) NOT NULL,
    is_preselected boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: question_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_slide (
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
    points integer,
    re_attempt_count integer,
    source_type character varying(255)
);


--
-- Name: question_slide_tracked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_slide_tracked (
    id character varying(255) NOT NULL,
    attempt_number integer,
    response_json text,
    response_status character varying(255),
    marks double precision,
    activity_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: quiz_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_slide (
    id character varying(255) NOT NULL,
    description character varying(255),
    title character varying(255),
    created_at timestamp(6) without time zone DEFAULT now(),
    updated_at timestamp(6) without time zone DEFAULT now(),
    time_limit_in_minutes integer,
    marks_per_question numeric(10,2) DEFAULT 1.0 NOT NULL,
    negative_marking numeric(10,2) DEFAULT 0.0 NOT NULL,
    pass_percentage double precision,
    re_attempt_count integer
);


--
-- Name: quiz_slide_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_slide_question (
    id character varying NOT NULL,
    parent_rich_text_id character varying,
    text_id character varying,
    explanation_text_id character varying,
    media_id character varying,
    status character varying,
    question_response_type character varying NOT NULL,
    question_type character varying NOT NULL,
    access_level character varying NOT NULL,
    auto_evaluation_json text,
    evaluation_type character varying,
    question_order integer,
    quiz_slide_id character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    can_skip boolean DEFAULT true,
    marks numeric(10,2) DEFAULT NULL::numeric,
    negative_marking numeric(10,2) DEFAULT NULL::numeric
);


--
-- Name: quiz_slide_question_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_slide_question_options (
    id character varying NOT NULL,
    quiz_slide_question_id character varying NOT NULL,
    text_id character varying,
    explanation_text_id character varying,
    media_id character varying,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: quiz_slide_question_tracked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_slide_question_tracked (
    id character varying(255) NOT NULL,
    response_json text,
    response_status character varying(255),
    question_id character varying(255),
    activity_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rating; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rating (
    id character varying NOT NULL,
    points double precision,
    user_id character varying,
    likes bigint,
    dislikes bigint,
    source_id character varying,
    source_type character varying,
    text character varying,
    status character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rating_action; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rating_action (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    rating_id character varying(255) NOT NULL,
    action_type character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: referral_benefit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_benefit_logs (
    id character varying(255) NOT NULL,
    user_plan_id character varying(255) NOT NULL,
    referral_mapping_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    benefit_type character varying(100) NOT NULL,
    beneficiary character varying(255),
    benefit_value text NOT NULL,
    status character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: referral_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_mapping (
    id character varying(255) NOT NULL,
    referrer_user_id character varying(255) NOT NULL,
    referee_user_id character varying(255) NOT NULL,
    referral_code character varying(255) NOT NULL,
    user_plan_id character varying(255),
    status character varying(50),
    referral_option_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    short_url character varying(512)
);


--
-- Name: referral_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_option (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255),
    source character varying(100) NOT NULL,
    source_id character varying(100),
    status character varying(50) NOT NULL,
    referrer_discount_json text,
    referee_discount_json text,
    referrer_vesting_days integer,
    tag character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    setting_json text,
    allow_combine_offers boolean DEFAULT false
);


--
-- Name: rich_text_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rich_text_data (
    id character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    content text NOT NULL
);


--
-- Name: schedule_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_notifications (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    session_id character varying(255) NOT NULL,
    type character varying(20) NOT NULL,
    message text,
    status character varying(20),
    channel character varying(100),
    trigger_time timestamp without time zone,
    offset_minutes integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT now(),
    schedule_id character varying(255),
    idempotency_key character varying(255)
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
-- Name: scorm_learner_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scorm_learner_progress (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    slide_id character varying(255) NOT NULL,
    attempt_number integer DEFAULT 1,
    completion_status character varying(50),
    success_status character varying(50),
    score_raw double precision,
    score_min double precision,
    score_max double precision,
    total_time character varying(50),
    cmi_suspend_data text,
    cmi_location character varying(255),
    cmi_exit character varying(50),
    cmi_json jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: scorm_slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scorm_slide (
    id character varying(255) NOT NULL,
    original_file_id character varying(255),
    launch_path character varying(512),
    scorm_version character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    launch_url character varying(512)
);


--
-- Name: sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections (
    id character varying(255) NOT NULL,
    assessment_id character varying(255),
    name character varying(255),
    max_score integer,
    active boolean,
    rules_markdown text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    duration_in_min integer
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id character varying(255) NOT NULL,
    session_name character varying(255),
    status character varying(255),
    start_date date,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id character varying(255),
    updated_by_user_id character varying(255)
);


--
-- Name: session_guest_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_guest_registrations (
    id character varying(255) NOT NULL,
    session_id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: session_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_schedules (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    session_id character varying(255) NOT NULL,
    recurrence_type character varying(20) NOT NULL,
    recurrence_key character varying(15),
    meeting_date date,
    start_time time without time zone,
    last_entry_time time without time zone,
    custom_meeting_link text,
    custom_waiting_room_media_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT now(),
    link_type character varying(255),
    status character varying(50),
    thumbnail_file_id character varying(255),
    daily_attendance boolean DEFAULT false NOT NULL,
    default_class_link text,
    default_class_link_type character varying(255),
    default_class_name character varying(255),
    learner_button_config text,
    provider_meeting_id character varying(255),
    provider_host_url text,
    provider_recordings_json text,
    last_attendance_sync_at timestamp without time zone,
    last_recording_sync_at timestamp without time zone,
    bbb_server_id character varying(36)
);


--
-- Name: COLUMN session_schedules.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_schedules.status IS 'Valid values: ACTIVE, DELETED, CANCELLED, COMPLETED';


--
-- Name: slide; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slide (
    id character varying(255) NOT NULL,
    source_id character varying(255),
    source_type character varying(255),
    title character varying(255),
    image_file_id character varying(255),
    description text,
    created_at timestamp(6) without time zone DEFAULT now(),
    updated_at timestamp(6) without time zone DEFAULT now(),
    status character varying(255),
    last_sync_date timestamp without time zone,
    parent_id character varying(255),
    created_by_user_id character varying(255),
    drip_condition_json text,
    updated_by_user_id character varying(255)
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    user_id character varying(255),
    institute_id character varying(255),
    id character varying(255) NOT NULL
);


--
-- Name: student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student (
    id character varying(255) NOT NULL,
    username character varying(255),
    user_id character varying(255),
    email character varying(255),
    full_name character varying(255),
    address_line character varying(255),
    region character varying(255),
    city character varying(255),
    pin_code character varying(50),
    mobile_number character varying(50),
    date_of_birth date,
    gender character varying(10),
    fathers_name character varying(255),
    mothers_name character varying(255),
    parents_mobile_number character varying(50),
    parents_email character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    linked_institute_name character varying(255),
    face_file_id character varying(255),
    parents_to_mother_mobile_number character varying(255),
    parents_to_mother_email character varying(50),
    id_number character varying(50),
    id_type character varying(20),
    previous_school_name character varying(255),
    previous_school_board character varying(50),
    last_class_attended character varying(50),
    last_exam_result character varying(50),
    subjects_studied text,
    applying_for_class character varying(50),
    academic_year character varying(20),
    board_preference character varying(50),
    tc_number character varying(50),
    tc_issue_date date,
    tc_pending boolean DEFAULT false,
    has_special_education_needs boolean DEFAULT false,
    is_physically_challenged boolean DEFAULT false,
    medical_conditions text,
    dietary_restrictions text,
    blood_group character varying(10),
    mother_tongue character varying(50),
    languages_known text,
    category character varying(20),
    nationality character varying(50),
    admission_no character varying(50),
    date_of_admission date,
    admission_type character varying(50),
    caste character varying(50),
    guardian_name character varying(255),
    guardian_mobile character varying(20),
    guardian_email character varying(255),
    tnc_accepted boolean DEFAULT false,
    tnc_file_id character varying(255),
    tnc_accepted_date timestamp without time zone
);


--
-- Name: student_analysis_process; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_analysis_process (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    start_date_iso date NOT NULL,
    end_date_iso date NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    report_json text,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: student_fee_adjustment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_fee_adjustment_history (
    id character varying(36) NOT NULL,
    student_fee_payment_id character varying(36) NOT NULL,
    institute_id character varying(255) NOT NULL,
    event_type character varying(40) NOT NULL,
    adjustment_type character varying(40) NOT NULL,
    amount numeric(19,4) NOT NULL,
    reason text,
    resulting_status character varying(40) NOT NULL,
    actor_user_id character varying(255) NOT NULL,
    actor_role character varying(100),
    previous_event_id character varying(36),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_fee_allocation_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_fee_allocation_ledger (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(255) NOT NULL,
    payment_log_id character varying(255) NOT NULL,
    student_fee_payment_id character varying(255) NOT NULL,
    amount_allocated numeric(10,2) NOT NULL,
    transaction_type character varying(50) NOT NULL,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: student_fee_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_fee_payment (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(255) NOT NULL,
    user_plan_id character varying(255) NOT NULL,
    package_session_ids text,
    cpo_id character varying(255) NOT NULL,
    asv_id character varying(255) NOT NULL,
    i_id character varying(255) NOT NULL,
    amount_expected numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0.00,
    due_date date,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_skippable boolean DEFAULT false,
    fee_type_id character varying(255),
    institute_id character varying(255),
    current_adjustment_history_id character varying(36),
    start_date date,
    original_amount numeric(19,2)
);


--
-- Name: student_session_institute_group_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_session_institute_group_mapping (
    user_id character varying(255),
    package_session_id character varying(255),
    institute_id character varying(255),
    group_id character varying(255),
    enrolled_date date,
    status character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    institute_enrollment_number character varying,
    id character varying NOT NULL,
    expiry_date timestamp without time zone,
    destination_package_session_id character varying(255),
    user_plan_id character varying(255),
    automated_completion_certificate_file_id character varying(255),
    type_id character varying(100),
    type character varying(100),
    source character varying(100),
    desired_level_id character varying(255),
    desired_package_id character varying(255),
    comma_separated_org_roles text,
    sub_org_id character varying(255)
);


--
-- Name: student_sub_org; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_sub_org (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    student_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    sub_org_id character varying(255) NOT NULL,
    link_type character varying(50) DEFAULT 'DIRECT'::character varying NOT NULL,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: studio_avatar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_avatar (
    id character varying(64) NOT NULL,
    institute_id character varying(255) NOT NULL,
    name character varying(120) NOT NULL,
    face_image_url text,
    description text,
    voice_id character varying(120),
    voice_provider character varying(32),
    voice_language character varying(32),
    voice_gender character varying(16),
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    provider character varying(32) DEFAULT 'custom'::character varying NOT NULL,
    external_avatar_id character varying(120),
    preview_image_url text
);


--
-- Name: TABLE studio_avatar; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.studio_avatar IS 'Saved host-avatar profiles per studio. Hydrated into host.avatar payload at video-gen time.';


--
-- Name: COLUMN studio_avatar.voice_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.studio_avatar.voice_id IS 'TTS voice id from ai_service voices catalog. Optional — if null, voice falls back to per-generation defaults.';


--
-- Name: COLUMN studio_avatar.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.studio_avatar.provider IS 'custom (user-uploaded face) | argil | veed — drives whether face_image_url or external_avatar_id is the source of truth.';


--
-- Name: COLUMN studio_avatar.external_avatar_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.studio_avatar.external_avatar_id IS 'fal.ai catalog enum value when provider != custom. Null for custom.';


--
-- Name: COLUMN studio_avatar.preview_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.studio_avatar.preview_image_url IS 'URL the FE renders on the avatar card. For custom: same as face_image_url. For built-ins: self-hosted thumbnail (null in v1; FE shows initials).';


--
-- Name: sub_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_modules (
    id character varying(255) NOT NULL,
    submodule_name character varying(255),
    module_id character varying(255)
);


--
-- Name: subject; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject (
    id character varying(255) NOT NULL,
    subject_name character varying(255),
    subject_code character varying(255),
    credit integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status character varying(255),
    thumbnail_id character varying(255),
    parent_id character varying(255),
    created_by_user_id character varying(255)
);


--
-- Name: subject_chapter_module_and_package_session_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_chapter_module_and_package_session_mapping (
    id character varying(255) NOT NULL,
    subject_id character varying(255) NOT NULL,
    chapter_id character varying(255),
    module_id character varying(255),
    institute_id character varying(255),
    package_session_id character varying(255),
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: subject_module_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_module_mapping (
    id character varying NOT NULL,
    subject_id character varying NOT NULL,
    module_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    module_order integer
);


--
-- Name: subject_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_session (
    subject_id character varying(255),
    session_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id character varying(255) NOT NULL,
    subject_order integer
);


--
-- Name: system_field_custom_field_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_field_custom_field_mapping (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    institute_id character varying(36) NOT NULL,
    entity_type character varying(50) NOT NULL,
    system_field_name character varying(100) NOT NULL,
    custom_field_id character varying(36) NOT NULL,
    sync_direction character varying(20) DEFAULT 'BIDIRECTIONAL'::character varying NOT NULL,
    converter_class character varying(255),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE system_field_custom_field_mapping; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_field_custom_field_mapping IS 'Maps system fields (database columns) to custom fields for bidirectional synchronization';


--
-- Name: COLUMN system_field_custom_field_mapping.entity_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_field_custom_field_mapping.entity_type IS 'The entity type: STUDENT, USER, ENQUIRY, etc.';


--
-- Name: COLUMN system_field_custom_field_mapping.system_field_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_field_custom_field_mapping.system_field_name IS 'The database column name in snake_case: full_name, mobile_number, etc.';


--
-- Name: COLUMN system_field_custom_field_mapping.sync_direction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_field_custom_field_mapping.sync_direction IS 'Sync direction: BIDIRECTIONAL (both ways), TO_SYSTEM (custom->system only), TO_CUSTOM (system->custom only), NONE (manual only)';


--
-- Name: system_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_files (
    id character varying(255) NOT NULL,
    file_type character varying(50) NOT NULL,
    media_type character varying(50) NOT NULL,
    data text NOT NULL,
    name character varying(255) NOT NULL,
    folder_name character varying(255),
    thumbnail_file_id character varying(255),
    institute_id character varying(255) NOT NULL,
    created_by_user_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status character varying(50) DEFAULT 'ACTIVE'::character varying NOT NULL,
    description text,
    CONSTRAINT chk_system_files_file_type CHECK (((file_type)::text = ANY (ARRAY[('File'::character varying)::text, ('Url'::character varying)::text, ('Html'::character varying)::text]))),
    CONSTRAINT chk_system_files_status CHECK (((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('DELETED'::character varying)::text, ('ARCHIVED'::character varying)::text])))
);


--
-- Name: TABLE system_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_files IS 'Stores system files that can be linked to batch, user, or institute with access controls';


--
-- Name: COLUMN system_files.file_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_files.file_type IS 'Type of file storage: File (stored file with ID), Url (external URL), or Html (HTML content/string)';


--
-- Name: COLUMN system_files.media_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_files.media_type IS 'Media category: video, audio, pdf, doc, image, note, or unknown';


--
-- Name: COLUMN system_files.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_files.data IS 'File identifier (UUID) for stored files or URL for external files';


--
-- Name: COLUMN system_files.thumbnail_file_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_files.thumbnail_file_id IS 'Optional thumbnail file reference';


--
-- Name: COLUMN system_files.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_files.status IS 'File status: ACTIVE, DELETED (soft delete), or ARCHIVED';


--
-- Name: COLUMN system_files.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_files.description IS 'Optional description for the system file';


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id character varying(255) NOT NULL,
    tag_name character varying(255) NOT NULL,
    institute_id character varying(255),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id character varying(255),
    status character varying(255) DEFAULT 'ACTIVE'::character varying NOT NULL
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
-- Name: teacher_planning_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_planning_logs (
    id character varying(255) NOT NULL,
    created_by_user_id character varying(255) NOT NULL,
    log_type character varying(20) NOT NULL,
    entity character varying(50) DEFAULT 'packageSession'::character varying NOT NULL,
    entity_id character varying(255) NOT NULL,
    interval_type character varying(20) NOT NULL,
    interval_type_id character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    content text NOT NULL,
    subject_id character varying(255) NOT NULL,
    comma_separated_file_ids text,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    institute_id character varying(255) NOT NULL,
    is_shared_with_student boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_teacher_planning_logs_interval_type CHECK (((interval_type)::text = ANY (ARRAY[('daily'::character varying)::text, ('weekly'::character varying)::text, ('monthly'::character varying)::text, ('yearly_month'::character varying)::text, ('yearly_quarter'::character varying)::text]))),
    CONSTRAINT chk_teacher_planning_logs_log_type CHECK (((log_type)::text = ANY (ARRAY[('planning'::character varying)::text, ('diary_log'::character varying)::text]))),
    CONSTRAINT chk_teacher_planning_logs_status CHECK (((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('DELETED'::character varying)::text])))
);


--
-- Name: TABLE teacher_planning_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.teacher_planning_logs IS 'Stores teacher planning entries and diary logs linked to entity and subjects';


--
-- Name: COLUMN teacher_planning_logs.log_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.log_type IS 'Type of entry: planning or diary_log';


--
-- Name: COLUMN teacher_planning_logs.entity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.entity IS 'Type of entity this log is linked to (e.g., packageSession)';


--
-- Name: COLUMN teacher_planning_logs.entity_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.entity_id IS 'ID of the entity (e.g., package session ID)';


--
-- Name: COLUMN teacher_planning_logs.interval_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.interval_type IS 'Time interval type: daily, weekly, monthly, yearly_month, yearly_quarter';


--
-- Name: COLUMN teacher_planning_logs.interval_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.interval_type_id IS 'Identifier based on interval_type (format varies by type)';


--
-- Name: COLUMN teacher_planning_logs.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.content IS 'HTML content of the planning or diary entry';


--
-- Name: COLUMN teacher_planning_logs.subject_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.subject_id IS 'Subject this entry is linked to';


--
-- Name: COLUMN teacher_planning_logs.comma_separated_file_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.comma_separated_file_ids IS 'Optional comma-separated list of file IDs for attachments';


--
-- Name: COLUMN teacher_planning_logs.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.status IS 'Entry status: ACTIVE or DELETED (soft delete)';


--
-- Name: COLUMN teacher_planning_logs.institute_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teacher_planning_logs.institute_id IS 'Institute this planning/diary log belongs to';


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id character varying(36) NOT NULL,
    type character varying(50) NOT NULL,
    vendor_id character varying(36),
    institute_id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    subject character varying(500),
    content text,
    content_type character varying(50),
    setting_json text,
    can_delete boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(36),
    updated_by character varying(36),
    dynamic_parameters text,
    status character varying(50),
    template_category character varying(50)
);


--
-- Name: TABLE templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.templates IS 'Templates table for storing email and WhatsApp notification templates for institutes';


--
-- Name: COLUMN templates.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.id IS 'Primary key (UUID)';


--
-- Name: COLUMN templates.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.type IS 'Template type: EMAIL, WHATSAPP, SMS, etc.';


--
-- Name: COLUMN templates.vendor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.vendor_id IS 'Vendor ID for vendor-specific templates';


--
-- Name: COLUMN templates.institute_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.institute_id IS 'Institute ID this template belongs to';


--
-- Name: COLUMN templates.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.name IS 'Template name (unique per institute)';


--
-- Name: COLUMN templates.subject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.subject IS 'Email subject line or notification title';


--
-- Name: COLUMN templates.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.content IS 'Template content/body';


--
-- Name: COLUMN templates.content_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.content_type IS 'Content type: HTML, TEXT, JSON, etc.';


--
-- Name: COLUMN templates.setting_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.setting_json IS 'Additional settings in JSON format';


--
-- Name: COLUMN templates.can_delete; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.can_delete IS 'Whether this template can be deleted';


--
-- Name: COLUMN templates.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.created_at IS 'Creation timestamp';


--
-- Name: COLUMN templates.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.updated_at IS 'Last update timestamp';


--
-- Name: COLUMN templates.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.created_by IS 'User ID who created this template';


--
-- Name: COLUMN templates.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.updated_by IS 'User ID who last updated this template';


--
-- Name: COLUMN templates.dynamic_parameters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.dynamic_parameters IS 'JSON string containing key-value pairs for template dynamic parameters based on contentType (WHATSAPP, EMAIL, etc.)';


--
-- Name: COLUMN templates.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.status IS 'Template status: ACTIVE, INACTIVE, DRAFT, etc.';


--
-- Name: COLUMN templates.template_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.template_category IS 'Template category: NOTIFICATION, MARKETING, SYSTEM, etc.';


--
-- Name: timeline_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timeline_event (
    id character varying(36) NOT NULL,
    type character varying(50) NOT NULL,
    type_id character varying(255) NOT NULL,
    action_type character varying(100) NOT NULL,
    actor_type character varying(50) NOT NULL,
    actor_id character varying(255),
    actor_name character varying(255),
    title character varying(500) NOT NULL,
    description text,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_pinned boolean DEFAULT false,
    student_user_id text,
    category character varying(20) DEFAULT 'ACTIVITY'::character varying NOT NULL
);


--
-- Name: TABLE timeline_event; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.timeline_event IS 'Timeline event system for tracking all actions across entities';


--
-- Name: COLUMN timeline_event.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.type IS 'Parent entity type: ENQUIRY, APPLICANT, STUDENT, etc.';


--
-- Name: COLUMN timeline_event.type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.type_id IS 'Parent entity ID (UUID or identifier)';


--
-- Name: COLUMN timeline_event.action_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.action_type IS 'Standardized action type for filtering';


--
-- Name: COLUMN timeline_event.actor_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.actor_type IS 'Type of actor: ADMIN, SYSTEM, PARENT, STUDENT';


--
-- Name: COLUMN timeline_event.actor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.actor_id IS 'User ID of actor (nullable for SYSTEM)';


--
-- Name: COLUMN timeline_event.actor_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.actor_name IS 'Snapshot of actor name for quick display';


--
-- Name: COLUMN timeline_event.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.title IS 'Human-readable short title for UI display';


--
-- Name: COLUMN timeline_event.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.description IS 'Detailed description or note content';


--
-- Name: COLUMN timeline_event.metadata_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_event.metadata_json IS 'Flexible JSON for additional context (from/to values, etc.)';


--
-- Name: user_institute_payment_gateway_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_institute_payment_gateway_mapping (
    id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL,
    institute_payment_gateway_mapping_id character varying(36) NOT NULL,
    payment_gateway_customer_id character varying(100),
    payment_gateway_customer_data text,
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_lead_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_lead_profile (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id text NOT NULL,
    institute_id text NOT NULL,
    best_score integer DEFAULT 0 NOT NULL,
    best_score_response_id text,
    lead_tier character varying(10),
    conversion_status character varying(20) DEFAULT 'LEAD'::character varying NOT NULL,
    converted_at timestamp without time zone,
    campaign_count integer DEFAULT 0 NOT NULL,
    best_source_type text,
    total_timeline_events integer DEFAULT 0 NOT NULL,
    demo_login_count integer DEFAULT 0 NOT NULL,
    demo_attendance_count integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp without time zone,
    last_calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    assigned_counselor_id character varying(255),
    assigned_counselor_name character varying(255),
    first_response_at timestamp without time zone
);


--
-- Name: user_linked_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_linked_data (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    data character varying(255) NOT NULL,
    percentage integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_plan (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    plan_id character varying(255),
    plan_json text,
    applied_coupon_discount_id character varying(255),
    applied_coupon_discount_json text,
    status character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    json_payment_details text,
    enroll_invite_id character varying(255),
    payment_option_id character varying(255),
    payment_option_json text,
    source character varying(50) DEFAULT 'USER'::character varying NOT NULL,
    sub_org_id character varying(255) DEFAULT NULL::character varying,
    start_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tags (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    tag_id character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id character varying(255)
);


--
-- Name: users_operations_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_operations_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_user_id character varying(255),
    source character varying(255),
    source_id character varying(255),
    created_by character varying(255),
    from_value text,
    to_value text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: video; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video (
    id character varying(255) NOT NULL,
    description character varying(255),
    title character varying(255),
    url character varying(255),
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    video_length bigint,
    published_url character varying(255),
    published_video_length integer,
    source_type character varying(255),
    embedded_type character varying(255),
    embedded_data text
);


--
-- Name: video_slide_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_slide_question (
    id character varying NOT NULL,
    parent_rich_text_id character varying,
    text_id character varying,
    explanation_text_id character varying,
    media_id character varying,
    status character varying,
    question_response_type character varying NOT NULL,
    question_type character varying NOT NULL,
    access_level character varying NOT NULL,
    auto_evaluation_json text,
    evaluation_type character varying,
    question_order integer,
    question_time_in_millis bigint,
    video_slide_id character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    can_skip boolean DEFAULT true
);


--
-- Name: video_slide_question_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_slide_question_options (
    id character varying NOT NULL,
    video_slide_question_id character varying NOT NULL,
    text_id character varying,
    explanation_text_id character varying,
    media_id character varying,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: video_slide_question_tracked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_slide_question_tracked (
    id character varying NOT NULL,
    response_json text,
    response_status text,
    activity_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: video_tracked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_tracked (
    id character varying(255) NOT NULL,
    activity_id character varying(255),
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: vision_review_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vision_review_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id character varying(64) NOT NULL,
    shot_idx integer NOT NULL,
    shot_type character varying(64),
    quality_tier character varying(32) NOT NULL,
    prompt_version character varying(32),
    issue_codes text[] NOT NULL,
    severity_max integer NOT NULL,
    shipped character varying(16) NOT NULL,
    original_html_url text,
    regen_html_url text,
    screenshots_pre_urls text[],
    screenshots_post_urls text[],
    reviewer_pre_json jsonb NOT NULL,
    reviewer_post_json jsonb,
    review_ms integer,
    review_cost_usd numeric(10,6),
    regen_ms integer,
    regen_cost_usd numeric(10,6),
    shot_meta jsonb,
    shot_pack jsonb,
    host_present boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE vision_review_cases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vision_review_cases IS 'One row per shot flagged by the vision reviewer. Drives manual prompt-tuning review.';


--
-- Name: COLUMN vision_review_cases.prompt_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vision_review_cases.prompt_version IS 'Frozen reviewer rubric version. Bump on every prompt edit so rows are comparable across time.';


--
-- Name: COLUMN vision_review_cases.severity_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vision_review_cases.severity_max IS 'Max severity across all issues: 0=clean, 1=minor, 2=notable, 3=blocking.';


--
-- Name: COLUMN vision_review_cases.shipped; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vision_review_cases.shipped IS 'first_try (regen not fired), regen (regen succeeded), ship_original (regen worse — reverted to original).';


--
-- Name: web_hook; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_hook (
    id character varying(255) NOT NULL,
    event_type character varying(255),
    vendor character varying(255) NOT NULL,
    payload text NOT NULL,
    status character varying(50) NOT NULL,
    order_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at timestamp without time zone,
    error_message text
);


--
-- Name: workflow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow (
    id character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    status character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    workflow_type character varying NOT NULL,
    created_by_user_id character varying DEFAULT 'punit-punde'::character varying NOT NULL,
    institute_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_backup_bug2_prereq; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_backup_bug2_prereq (
    id character varying,
    name character varying,
    description text,
    status character varying,
    workflow_type character varying,
    created_by_user_id character varying,
    institute_id character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    backed_up_at timestamp with time zone
);


--
-- Name: workflow_execution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_execution (
    id character varying NOT NULL,
    workflow_id character varying NOT NULL,
    status character varying DEFAULT 'RUNNING'::character varying NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    workflow_schedule_id character varying,
    idempotency_key character varying NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    workflow_type character varying(20) DEFAULT 'SCHEDULED'::character varying NOT NULL,
    workflow_trigger_id character varying(36)
);


--
-- Name: workflow_execution_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_execution_log (
    id character varying(255) NOT NULL,
    workflow_execution_id character varying(255) NOT NULL,
    node_template_id character varying(255) NOT NULL,
    node_type character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    started_at timestamp without time zone NOT NULL,
    completed_at timestamp without time zone,
    execution_time_ms bigint,
    details_json text,
    error_message text,
    error_type character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_execution_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_execution_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id character varying(255) NOT NULL,
    paused_at_node_id character varying(255) NOT NULL,
    serialized_context jsonb NOT NULL,
    resume_at timestamp with time zone,
    pause_reason character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'WAITING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_node_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_node_mapping (
    id character varying NOT NULL,
    workflow_id character varying NOT NULL,
    node_template_id character varying NOT NULL,
    node_order integer NOT NULL,
    is_start_node boolean DEFAULT false,
    is_end_node boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    override_config text
);


--
-- Name: workflow_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_schedule (
    id character varying NOT NULL,
    workflow_id character varying NOT NULL,
    schedule_type character varying NOT NULL,
    cron_expr character varying,
    interval_minutes integer,
    day_of_month integer,
    timezone character varying DEFAULT 'UTC'::character varying NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    status character varying DEFAULT 'ACTIVE'::character varying NOT NULL,
    last_run_at timestamp without time zone,
    next_run_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_ws_cron_requires_expr CHECK ((((schedule_type)::text <> 'CRON'::text) OR (cron_expr IS NOT NULL))),
    CONSTRAINT chk_ws_dom_range CHECK (((day_of_month IS NULL) OR ((day_of_month >= 1) AND (day_of_month <= 31)))),
    CONSTRAINT chk_ws_interval_requires_value CHECK ((((schedule_type)::text <> 'INTERVAL'::text) OR (interval_minutes IS NOT NULL)))
);


--
-- Name: workflow_schedule_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_schedule_run (
    id character varying NOT NULL,
    schedule_id character varying NOT NULL,
    workflow_id character varying NOT NULL,
    planned_run_at timestamp without time zone NOT NULL,
    fired_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status character varying DEFAULT 'CREATED'::character varying NOT NULL,
    dedupe_key character varying NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    template_json jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    institute_id character varying(255),
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_trigger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_trigger (
    id character varying(36) NOT NULL,
    workflow_id character varying(255) NOT NULL,
    trigger_event_name character varying(255) NOT NULL,
    institute_id character varying(255) NOT NULL,
    description text,
    status character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    event_id character varying(255),
    idempotency_generation_setting text,
    webhook_secret character varying(255),
    webhook_url_slug character varying(255),
    event_applied_type character varying(50)
);


--
-- Name: COLUMN workflow_trigger.idempotency_generation_setting; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_trigger.idempotency_generation_setting IS 'JSON configuration for idempotency key generation. Defines strategy (NONE, UUID, TIME_WINDOW, CONTEXT_BASED, CONTEXT_TIME_WINDOW, EVENT_BASED, CUSTOM_EXPRESSION) and related settings (ttlMinutes, contextFields, etc.). Example: {"strategy":"CONTEXT_BASED","contextFields":["userId"]}';


--
-- Name: youtube_upload_defaults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.youtube_upload_defaults (
    institute_id character varying(255) NOT NULL,
    feature_enabled boolean DEFAULT false NOT NULL,
    auto_upload_enabled boolean DEFAULT true NOT NULL,
    privacy_status character varying(16) DEFAULT 'unlisted'::character varying NOT NULL,
    embeddable boolean DEFAULT true NOT NULL,
    public_stats_viewable boolean DEFAULT false NOT NULL,
    made_for_kids boolean DEFAULT false NOT NULL,
    category_id character varying(8) DEFAULT '27'::character varying NOT NULL,
    license character varying(32) DEFAULT 'youtube'::character varying NOT NULL,
    default_language character varying(16),
    tags_csv text,
    title_template text DEFAULT '{session_title} | {date}'::text NOT NULL,
    description_template text,
    notify_subscribers boolean DEFAULT false NOT NULL,
    default_playlist_id character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: youtube_upload_job; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.youtube_upload_job (
    id character varying(36) NOT NULL,
    institute_id character varying(255) NOT NULL,
    session_schedule_id character varying(255) NOT NULL,
    recording_id character varying(255),
    recording_file_id character varying(255) NOT NULL,
    status character varying(32) DEFAULT 'QUEUED'::character varying NOT NULL,
    youtube_video_id character varying(64),
    youtube_video_url text,
    title text,
    description text,
    privacy_status character varying(16),
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_retry_at timestamp with time zone,
    last_error text,
    last_error_code character varying(64),
    triggered_by_user_id character varying(255),
    triggered_via character varying(16) DEFAULT 'AUTO'::character varying NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: credit_rate_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_rate_config ALTER COLUMN id SET DEFAULT nextval('public.credit_rate_config_id_seq'::regclass);


--
-- Name: live_session_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_logs ALTER COLUMN id SET DEFAULT nextval('public.live_session_logs_id_seq'::regclass);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: ad_platform_page_subscription ad_platform_page_subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_platform_page_subscription
    ADD CONSTRAINT ad_platform_page_subscription_pkey PRIMARY KEY (id);


--
-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id);


--
-- Name: admission_pipeline admission_pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_pipeline
    ADD CONSTRAINT admission_pipeline_pkey PRIMARY KEY (id);


--
-- Name: aft_installments aft_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aft_installments
    ADD CONSTRAINT aft_installments_pkey PRIMARY KEY (id);


--
-- Name: ai_api_keys ai_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_api_keys
    ADD CONSTRAINT ai_api_keys_pkey PRIMARY KEY (id);


--
-- Name: ai_content_extraction ai_content_extraction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_content_extraction
    ADD CONSTRAINT ai_content_extraction_pkey PRIMARY KEY (id);


--
-- Name: ai_content_source ai_content_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_content_source
    ADD CONSTRAINT ai_content_source_pkey PRIMARY KEY (id);


--
-- Name: ai_credit_invoice_sequence ai_credit_invoice_sequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credit_invoice_sequence
    ADD CONSTRAINT ai_credit_invoice_sequence_pkey PRIMARY KEY (yyyymm);


--
-- Name: ai_gen_video ai_gen_video_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_gen_video
    ADD CONSTRAINT ai_gen_video_pkey PRIMARY KEY (id);


--
-- Name: ai_gen_video ai_gen_video_video_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_gen_video
    ADD CONSTRAINT ai_gen_video_video_id_key UNIQUE (video_id);


--
-- Name: ai_generated_artifact ai_generated_artifact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generated_artifact
    ADD CONSTRAINT ai_generated_artifact_pkey PRIMARY KEY (id);


--
-- Name: ai_input_assets ai_input_assets_mode_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.ai_input_assets
    ADD CONSTRAINT ai_input_assets_mode_check CHECK (((mode)::text = ANY ((ARRAY['podcast'::character varying, 'demo'::character varying, 'photo'::character varying, 'screenshot'::character varying, 'diagram'::character varying])::text[]))) NOT VALID;


--
-- Name: ai_input_assets ai_input_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_input_assets
    ADD CONSTRAINT ai_input_videos_pkey PRIMARY KEY (id);


--
-- Name: ai_model_defaults ai_model_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_defaults
    ADD CONSTRAINT ai_model_defaults_pkey PRIMARY KEY (id);


--
-- Name: ai_model_defaults ai_model_defaults_use_case_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_defaults
    ADD CONSTRAINT ai_model_defaults_use_case_key UNIQUE (use_case);


--
-- Name: ai_model_stage_assignments ai_model_stage_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_stage_assignments
    ADD CONSTRAINT ai_model_stage_assignments_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_model_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_model_id_key UNIQUE (model_id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_reel_candidates ai_reel_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reel_candidates
    ADD CONSTRAINT ai_reel_candidates_pkey PRIMARY KEY (id);


--
-- Name: ai_reels ai_reels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reels
    ADD CONSTRAINT ai_reels_pkey PRIMARY KEY (id);


--
-- Name: ai_reels ai_reels_reel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reels
    ADD CONSTRAINT ai_reels_reel_id_key UNIQUE (reel_id);


--
-- Name: ai_token_usage ai_token_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_token_usage
    ADD CONSTRAINT ai_token_usage_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (config_key);


--
-- Name: applicant applicant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant
    ADD CONSTRAINT applicant_pkey PRIMARY KEY (id);


--
-- Name: applicant_stage applicant_stage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_stage
    ADD CONSTRAINT applicant_stage_pkey PRIMARY KEY (id);


--
-- Name: application_stage application_stage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_stage
    ADD CONSTRAINT application_stage_pkey PRIMARY KEY (id);


--
-- Name: applied_coupon_discount applied_coupon_discount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applied_coupon_discount
    ADD CONSTRAINT applied_coupon_discount_pkey PRIMARY KEY (id);


--
-- Name: assessment_slide assessment_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_slide
    ADD CONSTRAINT assessment_slide_pkey PRIMARY KEY (id);


--
-- Name: assigned_fee_value assigned_fee_value_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assigned_fee_value
    ADD CONSTRAINT assigned_fee_value_pkey PRIMARY KEY (id);


--
-- Name: assignment_slide assignment_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide
    ADD CONSTRAINT assignment_slide_pkey PRIMARY KEY (id);


--
-- Name: assignment_slide_question_options assignment_slide_question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide_question_options
    ADD CONSTRAINT assignment_slide_question_options_pkey PRIMARY KEY (id);


--
-- Name: assignment_slide_question assignment_slide_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide_question
    ADD CONSTRAINT assignment_slide_question_pkey PRIMARY KEY (id);


--
-- Name: assignment_slide_tracked assignment_slide_tracked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide_tracked
    ADD CONSTRAINT assignment_slide_tracked_pkey PRIMARY KEY (id);


--
-- Name: audience_communication audience_communication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience_communication
    ADD CONSTRAINT audience_communication_pkey PRIMARY KEY (id);


--
-- Name: audience audience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience
    ADD CONSTRAINT audience_pkey PRIMARY KEY (id);


--
-- Name: audience_response audience_response_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience_response
    ADD CONSTRAINT audience_response_pkey PRIMARY KEY (id);


--
-- Name: audio_slide audio_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_slide
    ADD CONSTRAINT audio_slide_pkey PRIMARY KEY (id);


--
-- Name: audio_tracked audio_tracked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_tracked
    ADD CONSTRAINT audio_tracked_pkey PRIMARY KEY (id);


--
-- Name: bbb_server_pool bbb_server_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bbb_server_pool
    ADD CONSTRAINT bbb_server_pool_pkey PRIMARY KEY (id);


--
-- Name: bbb_server_pool bbb_server_pool_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bbb_server_pool
    ADD CONSTRAINT bbb_server_pool_slug_key UNIQUE (slug);


--
-- Name: booking_types booking_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_types
    ADD CONSTRAINT booking_types_pkey PRIMARY KEY (id);


--
-- Name: brand_kit brand_kit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit
    ADD CONSTRAINT brand_kit_pkey PRIMARY KEY (id);


--
-- Name: catalogue_institute_mapping catalogue_institute_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_institute_mapping
    ADD CONSTRAINT catalogue_institute_mapping_pkey PRIMARY KEY (id);


--
-- Name: chapter_package_session_mapping chapter_package_session_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_package_session_mapping
    ADD CONSTRAINT chapter_package_session_mapping_pkey PRIMARY KEY (id);


--
-- Name: chapter chapter_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter
    ADD CONSTRAINT chapter_pk PRIMARY KEY (id);


--
-- Name: chapter_to_slides chapter_to_slides_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_to_slides
    ADD CONSTRAINT chapter_to_slides_pk PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: checklist checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist
    ADD CONSTRAINT checklist_pkey PRIMARY KEY (id);


--
-- Name: client_secret_key client_secret_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_secret_key
    ADD CONSTRAINT client_secret_key_pkey PRIMARY KEY (client_name);


--
-- Name: coding_submissions coding_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coding_submissions
    ADD CONSTRAINT coding_submissions_pkey PRIMARY KEY (id);


--
-- Name: complex_payment_option complex_payment_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_payment_option
    ADD CONSTRAINT complex_payment_option_pkey PRIMARY KEY (id);


--
-- Name: concentration_score concentration_score_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concentration_score
    ADD CONSTRAINT concentration_score_pkey PRIMARY KEY (id);


--
-- Name: content_embeddings content_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_embeddings
    ADD CONSTRAINT content_embeddings_pkey PRIMARY KEY (id);


--
-- Name: counselor_pool_audience counselor_pool_audience_audience_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool_audience
    ADD CONSTRAINT counselor_pool_audience_audience_id_key UNIQUE (audience_id);


--
-- Name: counselor_pool_audience counselor_pool_audience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool_audience
    ADD CONSTRAINT counselor_pool_audience_pkey PRIMARY KEY (id);


--
-- Name: counselor_pool_member counselor_pool_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool_member
    ADD CONSTRAINT counselor_pool_member_pkey PRIMARY KEY (id);


--
-- Name: counselor_pool_member counselor_pool_member_pool_id_audience_id_counselor_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool_member
    ADD CONSTRAINT counselor_pool_member_pool_id_audience_id_counselor_user_id_key UNIQUE (pool_id, audience_id, counselor_user_id);


--
-- Name: counselor_pool counselor_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool
    ADD CONSTRAINT counselor_pool_pkey PRIMARY KEY (id);


--
-- Name: counselor_pool_shift_member counselor_pool_shift_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool_shift_member
    ADD CONSTRAINT counselor_pool_shift_member_pkey PRIMARY KEY (id);


--
-- Name: counselor_pool_shift_member counselor_pool_shift_member_shift_id_counselor_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool_shift_member
    ADD CONSTRAINT counselor_pool_shift_member_shift_id_counselor_user_id_key UNIQUE (shift_id, counselor_user_id);


--
-- Name: counselor_pool_shift counselor_pool_shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_pool_shift
    ADD CONSTRAINT counselor_pool_shift_pkey PRIMARY KEY (id);


--
-- Name: coupon_code coupon_code_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_code
    ADD CONSTRAINT coupon_code_code_key UNIQUE (code);


--
-- Name: coupon_code coupon_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_code
    ADD CONSTRAINT coupon_code_pkey PRIMARY KEY (id);


--
-- Name: course_catalogue course_catalogue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_catalogue
    ADD CONSTRAINT course_catalogue_pkey PRIMARY KEY (id);


--
-- Name: course_structure_changes_log course_structure_changes_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_structure_changes_log
    ADD CONSTRAINT course_structure_changes_log_pkey PRIMARY KEY (id);


--
-- Name: credit_alerts credit_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_alerts
    ADD CONSTRAINT credit_alerts_pkey PRIMARY KEY (id);


--
-- Name: credit_pack credit_pack_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack
    ADD CONSTRAINT credit_pack_code_key UNIQUE (code);


--
-- Name: credit_pack credit_pack_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack
    ADD CONSTRAINT credit_pack_pkey PRIMARY KEY (id);


--
-- Name: credit_pack_price credit_pack_price_pack_id_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_price
    ADD CONSTRAINT credit_pack_price_pack_id_currency_key UNIQUE (pack_id, currency);


--
-- Name: credit_pack_price credit_pack_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_price
    ADD CONSTRAINT credit_pack_price_pkey PRIMARY KEY (id);


--
-- Name: credit_pricing credit_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pricing
    ADD CONSTRAINT credit_pricing_pkey PRIMARY KEY (id);


--
-- Name: credit_pricing credit_pricing_request_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pricing
    ADD CONSTRAINT credit_pricing_request_type_key UNIQUE (request_type);


--
-- Name: credit_rate_config credit_rate_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_rate_config
    ADD CONSTRAINT credit_rate_config_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: custom_field_values custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: discount_option discount_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_option
    ADD CONSTRAINT discount_option_pkey PRIMARY KEY (id);


--
-- Name: document_slide document_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_slide
    ADD CONSTRAINT document_pk PRIMARY KEY (id);


--
-- Name: document_tracked document_tracked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tracked
    ADD CONSTRAINT document_tracked_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: doubt_assignee doubt_assignee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doubt_assignee
    ADD CONSTRAINT doubt_assignee_pkey PRIMARY KEY (id);


--
-- Name: doubts doubts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doubts
    ADD CONSTRAINT doubts_pkey PRIMARY KEY (id);


--
-- Name: embeddings embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_pkey PRIMARY KEY (id);


--
-- Name: enquiry enquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiry
    ADD CONSTRAINT enquiry_pkey PRIMARY KEY (id);


--
-- Name: enroll_invite enroll_invite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enroll_invite
    ADD CONSTRAINT enroll_invite_pkey PRIMARY KEY (id);


--
-- Name: entity_access entity_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_access
    ADD CONSTRAINT entity_access_pkey PRIMARY KEY (id);


--
-- Name: faculty_subject_package_session_mapping faculty_subject_package_session_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_subject_package_session_mapping
    ADD CONSTRAINT faculty_subject_package_session_mapping_pkey PRIMARY KEY (id);


--
-- Name: fee_type fee_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_type
    ADD CONSTRAINT fee_type_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: form_webhook_connector form_webhook_connector_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_webhook_connector
    ADD CONSTRAINT form_webhook_connector_pkey PRIMARY KEY (id);


--
-- Name: hr_approval_action hr_approval_action_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_approval_action
    ADD CONSTRAINT hr_approval_action_pkey PRIMARY KEY (id);


--
-- Name: hr_approval_chain hr_approval_chain_institute_id_entity_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_approval_chain
    ADD CONSTRAINT hr_approval_chain_institute_id_entity_type_key UNIQUE (institute_id, entity_type);


--
-- Name: hr_approval_chain hr_approval_chain_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_approval_chain
    ADD CONSTRAINT hr_approval_chain_pkey PRIMARY KEY (id);


--
-- Name: hr_approval_request hr_approval_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_approval_request
    ADD CONSTRAINT hr_approval_request_pkey PRIMARY KEY (id);


--
-- Name: hr_attendance_config hr_attendance_config_institute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_config
    ADD CONSTRAINT hr_attendance_config_institute_id_key UNIQUE (institute_id);


--
-- Name: hr_attendance_config hr_attendance_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_config
    ADD CONSTRAINT hr_attendance_config_pkey PRIMARY KEY (id);


--
-- Name: hr_attendance_record hr_attendance_record_employee_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_record
    ADD CONSTRAINT hr_attendance_record_employee_id_attendance_date_key UNIQUE (employee_id, attendance_date);


--
-- Name: hr_attendance_record hr_attendance_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_record
    ADD CONSTRAINT hr_attendance_record_pkey PRIMARY KEY (id);


--
-- Name: hr_attendance_regularization hr_attendance_regularization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_regularization
    ADD CONSTRAINT hr_attendance_regularization_pkey PRIMARY KEY (id);


--
-- Name: hr_bank_export_log hr_bank_export_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_bank_export_log
    ADD CONSTRAINT hr_bank_export_log_pkey PRIMARY KEY (id);


--
-- Name: hr_comp_off hr_comp_off_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_comp_off
    ADD CONSTRAINT hr_comp_off_pkey PRIMARY KEY (id);


--
-- Name: hr_department hr_department_institute_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_department
    ADD CONSTRAINT hr_department_institute_id_code_key UNIQUE (institute_id, code);


--
-- Name: hr_department hr_department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_department
    ADD CONSTRAINT hr_department_pkey PRIMARY KEY (id);


--
-- Name: hr_designation hr_designation_institute_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_designation
    ADD CONSTRAINT hr_designation_institute_id_code_key UNIQUE (institute_id, code);


--
-- Name: hr_designation hr_designation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_designation
    ADD CONSTRAINT hr_designation_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_bank_detail hr_employee_bank_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_bank_detail
    ADD CONSTRAINT hr_employee_bank_detail_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_document hr_employee_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_document
    ADD CONSTRAINT hr_employee_document_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_loan hr_employee_loan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_loan
    ADD CONSTRAINT hr_employee_loan_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_profile hr_employee_profile_institute_id_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profile
    ADD CONSTRAINT hr_employee_profile_institute_id_employee_code_key UNIQUE (institute_id, employee_code);


--
-- Name: hr_employee_profile hr_employee_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profile
    ADD CONSTRAINT hr_employee_profile_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_profile hr_employee_profile_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profile
    ADD CONSTRAINT hr_employee_profile_user_id_key UNIQUE (user_id);


--
-- Name: hr_employee_salary_component hr_employee_salary_component_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_salary_component
    ADD CONSTRAINT hr_employee_salary_component_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_salary_structure hr_employee_salary_structure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_salary_structure
    ADD CONSTRAINT hr_employee_salary_structure_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_shift_mapping hr_employee_shift_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_shift_mapping
    ADD CONSTRAINT hr_employee_shift_mapping_pkey PRIMARY KEY (id);


--
-- Name: hr_holiday hr_holiday_institute_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_holiday
    ADD CONSTRAINT hr_holiday_institute_id_date_key UNIQUE (institute_id, date);


--
-- Name: hr_holiday hr_holiday_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_holiday
    ADD CONSTRAINT hr_holiday_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_application hr_leave_application_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_application
    ADD CONSTRAINT hr_leave_application_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_balance hr_leave_balance_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_balance
    ADD CONSTRAINT hr_leave_balance_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: hr_leave_balance hr_leave_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_balance
    ADD CONSTRAINT hr_leave_balance_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_policy hr_leave_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_policy
    ADD CONSTRAINT hr_leave_policy_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_type hr_leave_type_institute_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_type
    ADD CONSTRAINT hr_leave_type_institute_id_code_key UNIQUE (institute_id, code);


--
-- Name: hr_leave_type hr_leave_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_type
    ADD CONSTRAINT hr_leave_type_pkey PRIMARY KEY (id);


--
-- Name: hr_loan_repayment hr_loan_repayment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_loan_repayment
    ADD CONSTRAINT hr_loan_repayment_pkey PRIMARY KEY (id);


--
-- Name: hr_payroll_entry_component hr_payroll_entry_component_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry_component
    ADD CONSTRAINT hr_payroll_entry_component_pkey PRIMARY KEY (id);


--
-- Name: hr_payroll_entry hr_payroll_entry_payroll_run_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry
    ADD CONSTRAINT hr_payroll_entry_payroll_run_id_employee_id_key UNIQUE (payroll_run_id, employee_id);


--
-- Name: hr_payroll_entry hr_payroll_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry
    ADD CONSTRAINT hr_payroll_entry_pkey PRIMARY KEY (id);


--
-- Name: hr_payroll_run hr_payroll_run_institute_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_run
    ADD CONSTRAINT hr_payroll_run_institute_id_month_year_key UNIQUE (institute_id, month, year);


--
-- Name: hr_payroll_run hr_payroll_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_run
    ADD CONSTRAINT hr_payroll_run_pkey PRIMARY KEY (id);


--
-- Name: hr_payslip hr_payslip_payroll_entry_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payslip
    ADD CONSTRAINT hr_payslip_payroll_entry_id_key UNIQUE (payroll_entry_id);


--
-- Name: hr_payslip hr_payslip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payslip
    ADD CONSTRAINT hr_payslip_pkey PRIMARY KEY (id);


--
-- Name: hr_reimbursement hr_reimbursement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_reimbursement
    ADD CONSTRAINT hr_reimbursement_pkey PRIMARY KEY (id);


--
-- Name: hr_salary_component hr_salary_component_institute_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_component
    ADD CONSTRAINT hr_salary_component_institute_id_code_key UNIQUE (institute_id, code);


--
-- Name: hr_salary_component hr_salary_component_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_component
    ADD CONSTRAINT hr_salary_component_pkey PRIMARY KEY (id);


--
-- Name: hr_salary_revision hr_salary_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_revision
    ADD CONSTRAINT hr_salary_revision_pkey PRIMARY KEY (id);


--
-- Name: hr_salary_template_component hr_salary_template_component_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_template_component
    ADD CONSTRAINT hr_salary_template_component_pkey PRIMARY KEY (id);


--
-- Name: hr_salary_template hr_salary_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_template
    ADD CONSTRAINT hr_salary_template_pkey PRIMARY KEY (id);


--
-- Name: hr_shift hr_shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_shift
    ADD CONSTRAINT hr_shift_pkey PRIMARY KEY (id);


--
-- Name: hr_tax_computation hr_tax_computation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tax_computation
    ADD CONSTRAINT hr_tax_computation_pkey PRIMARY KEY (id);


--
-- Name: hr_tax_configuration hr_tax_configuration_institute_id_country_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tax_configuration
    ADD CONSTRAINT hr_tax_configuration_institute_id_country_code_key UNIQUE (institute_id, country_code);


--
-- Name: hr_tax_configuration hr_tax_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tax_configuration
    ADD CONSTRAINT hr_tax_configuration_pkey PRIMARY KEY (id);


--
-- Name: hr_tax_declaration hr_tax_declaration_employee_id_financial_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tax_declaration
    ADD CONSTRAINT hr_tax_declaration_employee_id_financial_year_key UNIQUE (employee_id, financial_year);


--
-- Name: hr_tax_declaration hr_tax_declaration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tax_declaration
    ADD CONSTRAINT hr_tax_declaration_pkey PRIMARY KEY (id);


--
-- Name: html_video_slide html_video_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.html_video_slide
    ADD CONSTRAINT html_video_slide_pkey PRIMARY KEY (id);


--
-- Name: institute_credits institute_credits_institute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_credits
    ADD CONSTRAINT institute_credits_institute_id_key UNIQUE (institute_id);


--
-- Name: institute_credits institute_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_credits
    ADD CONSTRAINT institute_credits_pkey PRIMARY KEY (id);


--
-- Name: institute_custom_fields institute_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_custom_fields
    ADD CONSTRAINT institute_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: institute_domain_routing institute_domain_routing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_domain_routing
    ADD CONSTRAINT institute_domain_routing_pkey PRIMARY KEY (id);


--
-- Name: institute_fee_type_priority institute_fee_type_priority_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_fee_type_priority
    ADD CONSTRAINT institute_fee_type_priority_pkey PRIMARY KEY (id);


--
-- Name: institute_live_session_provider_mapping institute_live_session_provider_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_live_session_provider_mapping
    ADD CONSTRAINT institute_live_session_provider_mapping_pkey PRIMARY KEY (id);


--
-- Name: institute_payment_gateway_mapping institute_payment_gateway_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_payment_gateway_mapping
    ADD CONSTRAINT institute_payment_gateway_mapping_pkey PRIMARY KEY (id);


--
-- Name: institute_suborg institute_suborg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_suborg
    ADD CONSTRAINT institute_suborg_pkey PRIMARY KEY (id);


--
-- Name: institute_youtube_credentials institute_youtube_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_youtube_credentials
    ADD CONSTRAINT institute_youtube_credentials_pkey PRIMARY KEY (institute_id);


--
-- Name: instructor_copilot_logs instructor_copilot_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructor_copilot_logs
    ADD CONSTRAINT instructor_copilot_logs_pkey PRIMARY KEY (id);


--
-- Name: invoice invoice_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoice_line_item invoice_line_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_item
    ADD CONSTRAINT invoice_line_item_pkey PRIMARY KEY (id);


--
-- Name: invoice_payment_log_mapping invoice_payment_log_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payment_log_mapping
    ADD CONSTRAINT invoice_payment_log_mapping_pkey PRIMARY KEY (id);


--
-- Name: invoice_payment_log_mapping invoice_payment_log_mapping_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payment_log_mapping
    ADD CONSTRAINT invoice_payment_log_mapping_unique UNIQUE (invoice_id, payment_log_id);


--
-- Name: invoice invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_pkey PRIMARY KEY (id);


--
-- Name: issued_certificate issued_certificate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_certificate
    ADD CONSTRAINT issued_certificate_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_items knowledge_base_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_items
    ADD CONSTRAINT knowledge_base_items_pkey PRIMARY KEY (id);


--
-- Name: lead_assignment_counter lead_assignment_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_assignment_counter
    ADD CONSTRAINT lead_assignment_counter_pkey PRIMARY KEY (id);


--
-- Name: lead_assignment_counter lead_assignment_counter_scope_type_scope_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_assignment_counter
    ADD CONSTRAINT lead_assignment_counter_scope_type_scope_id_key UNIQUE (scope_type, scope_id);


--
-- Name: lead_followup lead_followup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_followup
    ADD CONSTRAINT lead_followup_pkey PRIMARY KEY (id);


--
-- Name: lead_score lead_score_audience_response_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_score
    ADD CONSTRAINT lead_score_audience_response_id_key UNIQUE (audience_response_id);


--
-- Name: lead_score lead_score_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_score
    ADD CONSTRAINT lead_score_pkey PRIMARY KEY (id);


--
-- Name: lead_sla_config lead_sla_config_institute_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_sla_config
    ADD CONSTRAINT lead_sla_config_institute_id_key UNIQUE (institute_id);


--
-- Name: lead_sla_config lead_sla_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_sla_config
    ADD CONSTRAINT lead_sla_config_pkey PRIMARY KEY (id);


--
-- Name: lead_sla_notify_role lead_sla_notify_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_sla_notify_role
    ADD CONSTRAINT lead_sla_notify_role_pkey PRIMARY KEY (id);


--
-- Name: lead_sla_reminder_window lead_sla_reminder_window_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_sla_reminder_window
    ADD CONSTRAINT lead_sla_reminder_window_pkey PRIMARY KEY (id);


--
-- Name: lead_status_history lead_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_status_history
    ADD CONSTRAINT lead_status_history_pkey PRIMARY KEY (id);


--
-- Name: lead_status lead_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_status
    ADD CONSTRAINT lead_status_pkey PRIMARY KEY (id);


--
-- Name: learner_invitation_custom_field learner_invitation_custom_field_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation_custom_field
    ADD CONSTRAINT learner_invitation_custom_field_pkey PRIMARY KEY (id);


--
-- Name: learner_invitation_custom_field_response learner_invitation_custom_field_response_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation_custom_field_response
    ADD CONSTRAINT learner_invitation_custom_field_response_pkey PRIMARY KEY (id);


--
-- Name: learner_invitation learner_invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation
    ADD CONSTRAINT learner_invitation_pkey PRIMARY KEY (id);


--
-- Name: learner_invitation_response learner_invitation_response_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation_response
    ADD CONSTRAINT learner_invitation_response_pkey PRIMARY KEY (id);


--
-- Name: learner_operation learner_operation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_operation
    ADD CONSTRAINT learner_operation_pkey PRIMARY KEY (id);


--
-- Name: learning_analytics learning_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_analytics
    ADD CONSTRAINT learning_analytics_pkey PRIMARY KEY (id);


--
-- Name: linked_events linked_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linked_events
    ADD CONSTRAINT linked_events_pkey PRIMARY KEY (id);


--
-- Name: linked_users linked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linked_users
    ADD CONSTRAINT linked_users_pkey PRIMARY KEY (id);


--
-- Name: live_session_logs live_session_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_logs
    ADD CONSTRAINT live_session_logs_pkey PRIMARY KEY (id);


--
-- Name: live_session_notification_config live_session_notification_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_notification_config
    ADD CONSTRAINT live_session_notification_config_pkey PRIMARY KEY (id);


--
-- Name: live_session_participants live_session_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_participants
    ADD CONSTRAINT live_session_participants_pkey PRIMARY KEY (id);


--
-- Name: migration_staging_keap_payments migration_staging_keap_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_staging_keap_payments
    ADD CONSTRAINT migration_staging_keap_payments_pkey PRIMARY KEY (id);


--
-- Name: migration_staging_keap_users migration_staging_keap_users_keap_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_staging_keap_users
    ADD CONSTRAINT migration_staging_keap_users_keap_contact_id_key UNIQUE (keap_contact_id);


--
-- Name: migration_staging_keap_users migration_staging_keap_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_staging_keap_users
    ADD CONSTRAINT migration_staging_keap_users_pkey PRIMARY KEY (id);


--
-- Name: model_pricing model_pricing_model_pattern_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_pricing
    ADD CONSTRAINT model_pricing_model_pattern_key UNIQUE (model_pattern);


--
-- Name: model_pricing model_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_pricing
    ADD CONSTRAINT model_pricing_pkey PRIMARY KEY (id);


--
-- Name: module_chapter_mapping module_chapter_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_chapter_mapping
    ADD CONSTRAINT module_chapter_mapping_pkey PRIMARY KEY (id);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: node_dedupe_record node_dedupe_record_node_template_id_operation_key_schedule__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_dedupe_record
    ADD CONSTRAINT node_dedupe_record_node_template_id_operation_key_schedule__key UNIQUE (node_template_id, operation_key, schedule_run_id);


--
-- Name: node_dedupe_record node_dedupe_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_dedupe_record
    ADD CONSTRAINT node_dedupe_record_pkey PRIMARY KEY (id);


--
-- Name: node_execution node_execution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_execution
    ADD CONSTRAINT node_execution_pkey PRIMARY KEY (id);


--
-- Name: node_template node_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_template
    ADD CONSTRAINT node_template_pkey PRIMARY KEY (id);


--
-- Name: notification_rate_limit notification_rate_limit_institute_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_rate_limit
    ADD CONSTRAINT notification_rate_limit_institute_id_channel_key UNIQUE (institute_id, channel);


--
-- Name: notification_rate_limit notification_rate_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_rate_limit
    ADD CONSTRAINT notification_rate_limit_pkey PRIMARY KEY (id);


--
-- Name: notification_setting notification_setting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_setting
    ADD CONSTRAINT notification_setting_pkey PRIMARY KEY (id);


--
-- Name: oauth_connect_state oauth_connect_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_connect_state
    ADD CONSTRAINT oauth_connect_state_pkey PRIMARY KEY (id);


--
-- Name: option option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option
    ADD CONSTRAINT option_pkey PRIMARY KEY (id);


--
-- Name: ota_bundle_version ota_bundle_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ota_bundle_version
    ADD CONSTRAINT ota_bundle_version_pkey PRIMARY KEY (id);


--
-- Name: ota_bundle_version ota_bundle_version_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ota_bundle_version
    ADD CONSTRAINT ota_bundle_version_version_key UNIQUE (version);


--
-- Name: package_group_mapping package_group_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_group_mapping
    ADD CONSTRAINT package_group_mapping_pkey PRIMARY KEY (id);


--
-- Name: package_institute package_institute_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_institute
    ADD CONSTRAINT package_institute_pk PRIMARY KEY (id);


--
-- Name: package_session_enroll_invite_payment_plan_to_referral_option package_session_enroll_invite_payment_plan_to_referral_opt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_enroll_invite_payment_plan_to_referral_option
    ADD CONSTRAINT package_session_enroll_invite_payment_plan_to_referral_opt_pkey PRIMARY KEY (id);


--
-- Name: package_session_learner_invitation_to_payment_option package_session_learner_invitation_to_payment_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_learner_invitation_to_payment_option
    ADD CONSTRAINT package_session_learner_invitation_to_payment_option_pkey PRIMARY KEY (id);


--
-- Name: payment_log_line_item payment_log_line_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_log_line_item
    ADD CONSTRAINT payment_log_line_item_pkey PRIMARY KEY (id);


--
-- Name: payment_log payment_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_log
    ADD CONSTRAINT payment_log_pkey PRIMARY KEY (id);


--
-- Name: payment_option payment_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_option
    ADD CONSTRAINT payment_option_pkey PRIMARY KEY (id);


--
-- Name: payment_plan payment_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plan
    ADD CONSTRAINT payment_plan_pkey PRIMARY KEY (id);


--
-- Name: persistent_guest_tokens persistent_guest_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persistent_guest_tokens
    ADD CONSTRAINT persistent_guest_tokens_pkey PRIMARY KEY (id);


--
-- Name: persistent_guest_tokens persistent_guest_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persistent_guest_tokens
    ADD CONSTRAINT persistent_guest_tokens_token_key UNIQUE (token);


--
-- Name: assessments pk_assessment_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT pk_assessment_id PRIMARY KEY (id);


--
-- Name: groups pk_group_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT pk_group_id PRIMARY KEY (id);


--
-- Name: institutes pk_institute_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutes
    ADD CONSTRAINT pk_institute_id PRIMARY KEY (id);


--
-- Name: institute_submodule_mapping pk_institute_submodule_mapping; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_submodule_mapping
    ADD CONSTRAINT pk_institute_submodule_mapping PRIMARY KEY (id);


--
-- Name: level pk_level_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level
    ADD CONSTRAINT pk_level_id PRIMARY KEY (id);


--
-- Name: institute_metadata pk_metadata_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_metadata
    ADD CONSTRAINT pk_metadata_id PRIMARY KEY (id);


--
-- Name: notification_event_config pk_notification_event_config; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_event_config
    ADD CONSTRAINT pk_notification_event_config PRIMARY KEY (id);


--
-- Name: package pk_package_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package
    ADD CONSTRAINT pk_package_id PRIMARY KEY (id);


--
-- Name: sections pk_section_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT pk_section_id PRIMARY KEY (id);


--
-- Name: package_session pk_session_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session
    ADD CONSTRAINT pk_session_id PRIMARY KEY (id);


--
-- Name: subject pk_subject_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject
    ADD CONSTRAINT pk_subject_id PRIMARY KEY (id);


--
-- Name: platform_invoice platform_invoice_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invoice
    ADD CONSTRAINT platform_invoice_invoice_number_key UNIQUE (invoice_number);


--
-- Name: platform_invoice_line_item platform_invoice_line_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invoice_line_item
    ADD CONSTRAINT platform_invoice_line_item_pkey PRIMARY KEY (id);


--
-- Name: platform_invoice platform_invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invoice
    ADD CONSTRAINT platform_invoice_pkey PRIMARY KEY (id);


--
-- Name: platform_invoice platform_invoice_platform_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invoice
    ADD CONSTRAINT platform_invoice_platform_payment_id_key UNIQUE (platform_payment_id);


--
-- Name: platform_payment_config platform_payment_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_payment_config
    ADD CONSTRAINT platform_payment_config_pkey PRIMARY KEY (id);


--
-- Name: platform_payment_config platform_payment_config_singleton_lock_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_payment_config
    ADD CONSTRAINT platform_payment_config_singleton_lock_key UNIQUE (singleton_lock);


--
-- Name: platform_payment_item platform_payment_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_payment_item
    ADD CONSTRAINT platform_payment_item_pkey PRIMARY KEY (id);


--
-- Name: platform_payment platform_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_payment
    ADD CONSTRAINT platform_payment_pkey PRIMARY KEY (id);


--
-- Name: platform_payment platform_payment_vendor_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_payment
    ADD CONSTRAINT platform_payment_vendor_order_id_key UNIQUE (vendor_order_id);


--
-- Name: product_page_invite_mapping product_page_invite_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_page_invite_mapping
    ADD CONSTRAINT product_page_invite_mapping_pkey PRIMARY KEY (id);


--
-- Name: product_page product_page_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_page
    ADD CONSTRAINT product_page_pkey PRIMARY KEY (id);


--
-- Name: question_slide question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_slide
    ADD CONSTRAINT question_pkey PRIMARY KEY (id);


--
-- Name: question_slide_tracked question_slide_tracked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_slide_tracked
    ADD CONSTRAINT question_slide_tracked_pkey PRIMARY KEY (id);


--
-- Name: quiz_slide quiz_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide
    ADD CONSTRAINT quiz_pk PRIMARY KEY (id);


--
-- Name: quiz_slide_question_options quiz_slide_question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question_options
    ADD CONSTRAINT quiz_slide_question_options_pkey PRIMARY KEY (id);


--
-- Name: quiz_slide_question quiz_slide_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question
    ADD CONSTRAINT quiz_slide_question_pkey PRIMARY KEY (id);


--
-- Name: quiz_slide_question_tracked quiz_slide_question_tracked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question_tracked
    ADD CONSTRAINT quiz_slide_question_tracked_pkey PRIMARY KEY (id);


--
-- Name: rating_action rating_action_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rating_action
    ADD CONSTRAINT rating_action_pkey PRIMARY KEY (id);


--
-- Name: rating rating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rating
    ADD CONSTRAINT rating_pkey PRIMARY KEY (id);


--
-- Name: referral_benefit_logs referral_benefit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_benefit_logs
    ADD CONSTRAINT referral_benefit_logs_pkey PRIMARY KEY (id);


--
-- Name: referral_mapping referral_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_mapping
    ADD CONSTRAINT referral_mapping_pkey PRIMARY KEY (id);


--
-- Name: referral_option referral_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_option
    ADD CONSTRAINT referral_option_pkey PRIMARY KEY (id);


--
-- Name: rich_text_data rich_text_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rich_text_data
    ADD CONSTRAINT rich_text_data_pkey PRIMARY KEY (id);


--
-- Name: schedule_notifications schedule_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_notifications
    ADD CONSTRAINT schedule_notifications_pkey PRIMARY KEY (id);


--
-- Name: scheduler_activity_log scheduler_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_activity_log
    ADD CONSTRAINT scheduler_activity_log_pkey PRIMARY KEY (id);


--
-- Name: scorm_learner_progress scorm_learner_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scorm_learner_progress
    ADD CONSTRAINT scorm_learner_progress_pkey PRIMARY KEY (id);


--
-- Name: scorm_slide scorm_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scorm_slide
    ADD CONSTRAINT scorm_slide_pkey PRIMARY KEY (id);


--
-- Name: session_guest_registrations session_guest_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_guest_registrations
    ADD CONSTRAINT session_guest_registrations_pkey PRIMARY KEY (id);


--
-- Name: session_guest_registrations session_guest_registrations_session_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_guest_registrations
    ADD CONSTRAINT session_guest_registrations_session_id_email_key UNIQUE (session_id, email);


--
-- Name: session session_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pk PRIMARY KEY (id);


--
-- Name: session_schedules session_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_schedules
    ADD CONSTRAINT session_schedules_pkey PRIMARY KEY (id);


--
-- Name: live_session sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: slide slide_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slide
    ADD CONSTRAINT slide_pk PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: student_analysis_process student_analysis_process_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_analysis_process
    ADD CONSTRAINT student_analysis_process_pkey PRIMARY KEY (id);


--
-- Name: student_fee_adjustment_history student_fee_adjustment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustment_history
    ADD CONSTRAINT student_fee_adjustment_history_pkey PRIMARY KEY (id);


--
-- Name: student_fee_allocation_ledger student_fee_allocation_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_allocation_ledger
    ADD CONSTRAINT student_fee_allocation_ledger_pkey PRIMARY KEY (id);


--
-- Name: student_fee_payment student_fee_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_payment
    ADD CONSTRAINT student_fee_payment_pkey PRIMARY KEY (id);


--
-- Name: student student_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student
    ADD CONSTRAINT student_pkey PRIMARY KEY (id);


--
-- Name: student_session_institute_group_mapping student_session_institute_group_mapping_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT student_session_institute_group_mapping_pk PRIMARY KEY (id);


--
-- Name: student_sub_org student_sub_org_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_sub_org
    ADD CONSTRAINT student_sub_org_pkey PRIMARY KEY (id);


--
-- Name: student student_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student
    ADD CONSTRAINT student_unique UNIQUE (user_id, username);


--
-- Name: studio_avatar studio_avatar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_avatar
    ADD CONSTRAINT studio_avatar_pkey PRIMARY KEY (id);


--
-- Name: sub_modules sub_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_modules
    ADD CONSTRAINT sub_modules_pkey PRIMARY KEY (id);


--
-- Name: subject_chapter_module_and_package_session_mapping subject_chapter_module_and_package_session_mapping_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_module_and_package_session_mapping
    ADD CONSTRAINT subject_chapter_module_and_package_session_mapping_pk PRIMARY KEY (id);


--
-- Name: subject_module_mapping subject_module_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_module_mapping
    ADD CONSTRAINT subject_module_mapping_pkey PRIMARY KEY (id);


--
-- Name: subject_session subject_session_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_session
    ADD CONSTRAINT subject_session_pk PRIMARY KEY (id);


--
-- Name: system_field_custom_field_mapping system_field_custom_field_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_field_custom_field_mapping
    ADD CONSTRAINT system_field_custom_field_mapping_pkey PRIMARY KEY (id);


--
-- Name: system_files system_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_files
    ADD CONSTRAINT system_files_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: task_execution_audit task_execution_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT task_execution_audit_pkey PRIMARY KEY (id);


--
-- Name: teacher_planning_logs teacher_planning_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_planning_logs
    ADD CONSTRAINT teacher_planning_logs_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: timeline_event timeline_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_event
    ADD CONSTRAINT timeline_event_pkey PRIMARY KEY (id);


--
-- Name: migration_staging_keap_users uc_keap_contact_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_staging_keap_users
    ADD CONSTRAINT uc_keap_contact_id UNIQUE (keap_contact_id);


--
-- Name: rating_action uc_user_rating; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rating_action
    ADD CONSTRAINT uc_user_rating UNIQUE (user_id, rating_id);


--
-- Name: schedule_notifications uk_schedule_notifications_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_notifications
    ADD CONSTRAINT uk_schedule_notifications_idempotency_key UNIQUE (idempotency_key);


--
-- Name: system_field_custom_field_mapping uk_system_field_mapping; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_field_custom_field_mapping
    ADD CONSTRAINT uk_system_field_mapping UNIQUE (institute_id, entity_type, system_field_name, custom_field_id);


--
-- Name: scorm_learner_progress uk_user_slide_attempt; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scorm_learner_progress
    ADD CONSTRAINT uk_user_slide_attempt UNIQUE (user_id, slide_id, attempt_number);


--
-- Name: form_webhook_connector uk_vendor_vendor_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_webhook_connector
    ADD CONSTRAINT uk_vendor_vendor_id UNIQUE (vendor, vendor_id);


--
-- Name: audience unique_institute_campaign; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience
    ADD CONSTRAINT unique_institute_campaign UNIQUE (institute_id, campaign_name);


--
-- Name: ai_content_extraction uq_ai_content_extraction; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_content_extraction
    ADD CONSTRAINT uq_ai_content_extraction UNIQUE (source_id, extraction_type);


--
-- Name: ai_content_source uq_ai_content_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_content_source
    ADD CONSTRAINT uq_ai_content_source UNIQUE (source_type, source_id);


--
-- Name: student_session_institute_group_mapping uq_dest_pkg_inst_user_status; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT uq_dest_pkg_inst_user_status UNIQUE (destination_package_session_id, package_session_id, institute_id, user_id, status);


--
-- Name: student_session_institute_group_mapping uq_destination_pkg_inst_status_pkg_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT uq_destination_pkg_inst_status_pkg_user UNIQUE (destination_package_session_id, institute_id, status, package_session_id, user_id);


--
-- Name: institute_fee_type_priority uq_inst_scope_feetype; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_fee_type_priority
    ADD CONSTRAINT uq_inst_scope_feetype UNIQUE (institute_id, scope, fee_type_id);


--
-- Name: ad_platform_page_subscription uq_page_subscription; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_platform_page_subscription
    ADD CONSTRAINT uq_page_subscription UNIQUE (vendor, platform_page_id);


--
-- Name: product_page uq_product_page_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_page
    ADD CONSTRAINT uq_product_page_code UNIQUE (code);


--
-- Name: ai_model_stage_assignments uq_stage_assignment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_stage_assignments
    ADD CONSTRAINT uq_stage_assignment UNIQUE (use_case, quality_tier, stage_id);


--
-- Name: student_sub_org uq_student_sub_org_user_suborg; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_sub_org
    ADD CONSTRAINT uq_student_sub_org_user_suborg UNIQUE (user_id, sub_org_id);


--
-- Name: workflow_trigger uq_workflow_trigger_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_trigger
    ADD CONSTRAINT uq_workflow_trigger_id PRIMARY KEY (id);


--
-- Name: user_institute_payment_gateway_mapping user_institute_payment_gateway_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_institute_payment_gateway_mapping
    ADD CONSTRAINT user_institute_payment_gateway_mapping_pkey PRIMARY KEY (id);


--
-- Name: user_lead_profile user_lead_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lead_profile
    ADD CONSTRAINT user_lead_profile_pkey PRIMARY KEY (id);


--
-- Name: user_lead_profile user_lead_profile_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lead_profile
    ADD CONSTRAINT user_lead_profile_user_id_key UNIQUE (user_id);


--
-- Name: user_linked_data user_linked_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_linked_data
    ADD CONSTRAINT user_linked_data_pkey PRIMARY KEY (id);


--
-- Name: user_plan user_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_plan
    ADD CONSTRAINT user_plan_pkey PRIMARY KEY (id);


--
-- Name: user_tags user_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_pkey PRIMARY KEY (id);


--
-- Name: users_operations_log users_operations_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_operations_log
    ADD CONSTRAINT users_operations_log_pkey PRIMARY KEY (id);


--
-- Name: video video_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video
    ADD CONSTRAINT video_pk PRIMARY KEY (id);


--
-- Name: video_slide_question_options video_slide_question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question_options
    ADD CONSTRAINT video_slide_question_options_pkey PRIMARY KEY (id);


--
-- Name: video_slide_question video_slide_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question
    ADD CONSTRAINT video_slide_question_pkey PRIMARY KEY (id);


--
-- Name: video_slide_question_tracked video_slide_question_tracked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question_tracked
    ADD CONSTRAINT video_slide_question_tracked_pkey PRIMARY KEY (id);


--
-- Name: video_tracked video_tracked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_tracked
    ADD CONSTRAINT video_tracked_pkey PRIMARY KEY (id);


--
-- Name: vision_review_cases vision_review_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vision_review_cases
    ADD CONSTRAINT vision_review_cases_pkey PRIMARY KEY (id);


--
-- Name: web_hook web_hook_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_hook
    ADD CONSTRAINT web_hook_pkey PRIMARY KEY (id);


--
-- Name: workflow_execution_log workflow_execution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution_log
    ADD CONSTRAINT workflow_execution_log_pkey PRIMARY KEY (id);


--
-- Name: workflow_execution workflow_execution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution
    ADD CONSTRAINT workflow_execution_pkey PRIMARY KEY (id);


--
-- Name: workflow_execution_state workflow_execution_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution_state
    ADD CONSTRAINT workflow_execution_state_pkey PRIMARY KEY (id);


--
-- Name: workflow_node_mapping workflow_node_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_node_mapping
    ADD CONSTRAINT workflow_node_mapping_pkey PRIMARY KEY (id);


--
-- Name: workflow_node_mapping workflow_node_mapping_workflow_id_node_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_node_mapping
    ADD CONSTRAINT workflow_node_mapping_workflow_id_node_order_key UNIQUE (workflow_id, node_order);


--
-- Name: workflow_node_mapping workflow_node_mapping_workflow_id_node_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_node_mapping
    ADD CONSTRAINT workflow_node_mapping_workflow_id_node_template_id_key UNIQUE (workflow_id, node_template_id);


--
-- Name: workflow workflow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow
    ADD CONSTRAINT workflow_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedule workflow_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedule
    ADD CONSTRAINT workflow_schedule_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedule_run workflow_schedule_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedule_run
    ADD CONSTRAINT workflow_schedule_run_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedule_run workflow_schedule_run_schedule_id_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedule_run
    ADD CONSTRAINT workflow_schedule_run_schedule_id_dedupe_key_key UNIQUE (schedule_id, dedupe_key);


--
-- Name: workflow_schedule_run workflow_schedule_run_schedule_id_planned_run_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedule_run
    ADD CONSTRAINT workflow_schedule_run_schedule_id_planned_run_at_key UNIQUE (schedule_id, planned_run_at);


--
-- Name: workflow_template workflow_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template
    ADD CONSTRAINT workflow_template_pkey PRIMARY KEY (id);


--
-- Name: youtube_upload_defaults youtube_upload_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youtube_upload_defaults
    ADD CONSTRAINT youtube_upload_defaults_pkey PRIMARY KEY (institute_id);


--
-- Name: youtube_upload_job youtube_upload_job_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youtube_upload_job
    ADD CONSTRAINT youtube_upload_job_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_aal_created_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aal_created_brin ON public.admin_activity_log USING brin (created_at);


--
-- Name: idx_aal_inst_actor_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aal_inst_actor_time ON public.admin_activity_log USING btree (institute_id, actor_id, created_at DESC);


--
-- Name: idx_aal_inst_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aal_inst_created ON public.admin_activity_log USING btree (institute_id, created_at DESC);


--
-- Name: idx_aal_inst_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aal_inst_entity ON public.admin_activity_log USING btree (institute_id, entity_type, entity_id, created_at DESC);


--
-- Name: idx_activity_log_slide_id_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_slide_id_user_id ON public.activity_log USING btree (slide_id, user_id);


--
-- Name: idx_activity_log_source_type_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_source_type_source_id ON public.activity_log USING btree (source_type, source_id);


--
-- Name: idx_activity_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_status ON public.activity_log USING btree (status) WHERE (status IS NOT NULL);


--
-- Name: idx_activity_log_time_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_time_range ON public.activity_log USING btree (start_time, end_time);


--
-- Name: idx_activity_log_user_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_user_id_created_at ON public.activity_log USING btree (user_id, created_at DESC);


--
-- Name: idx_admission_pipeline_applicant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admission_pipeline_applicant ON public.admission_pipeline USING btree (applicant_id);


--
-- Name: idx_admission_pipeline_child_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admission_pipeline_child_user ON public.admission_pipeline USING btree (child_user_id);


--
-- Name: idx_admission_pipeline_enquiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admission_pipeline_enquiry ON public.admission_pipeline USING btree (enquiry_id);


--
-- Name: idx_admission_pipeline_institute_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admission_pipeline_institute_session ON public.admission_pipeline USING btree (institute_id, package_session_id);


--
-- Name: idx_admission_pipeline_parent_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admission_pipeline_parent_user ON public.admission_pipeline USING btree (parent_user_id);


--
-- Name: idx_ai_api_keys_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_api_keys_created_at ON public.ai_api_keys USING btree (created_at);


--
-- Name: idx_ai_api_keys_institute_id_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_api_keys_institute_id_lookup ON public.ai_api_keys USING btree (institute_id, is_active) WHERE ((is_active = true) AND (user_id IS NULL));


--
-- Name: idx_ai_api_keys_user_id_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_api_keys_user_id_lookup ON public.ai_api_keys USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_ai_content_extraction_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_content_extraction_job ON public.ai_content_extraction USING btree (job_id);


--
-- Name: idx_ai_content_extraction_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_content_extraction_source ON public.ai_content_extraction USING btree (source_id);


--
-- Name: idx_ai_content_extraction_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_content_extraction_status ON public.ai_content_extraction USING btree (status);


--
-- Name: idx_ai_content_source_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_content_source_institute ON public.ai_content_source USING btree (institute_id);


--
-- Name: idx_ai_content_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_content_source_type ON public.ai_content_source USING btree (source_type);


--
-- Name: idx_ai_gen_video_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gen_video_content_type ON public.ai_gen_video USING btree (content_type);


--
-- Name: idx_ai_gen_video_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gen_video_created_at ON public.ai_gen_video USING btree (created_at);


--
-- Name: idx_ai_gen_video_current_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gen_video_current_stage ON public.ai_gen_video USING btree (current_stage);


--
-- Name: idx_ai_gen_video_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gen_video_status ON public.ai_gen_video USING btree (status);


--
-- Name: idx_ai_gen_video_video_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gen_video_video_id ON public.ai_gen_video USING btree (video_id);


--
-- Name: idx_ai_generated_artifact_extraction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_generated_artifact_extraction ON public.ai_generated_artifact USING btree (extraction_id);


--
-- Name: idx_ai_generated_artifact_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_generated_artifact_source ON public.ai_generated_artifact USING btree (source_id);


--
-- Name: idx_ai_generated_artifact_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_generated_artifact_type_id ON public.ai_generated_artifact USING btree (artifact_type, artifact_id);


--
-- Name: idx_ai_models_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_category ON public.ai_models USING btree (category);


--
-- Name: idx_ai_models_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_display_order ON public.ai_models USING btree (display_order);


--
-- Name: idx_ai_models_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_is_active ON public.ai_models USING btree (is_active);


--
-- Name: idx_ai_models_is_free; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_is_free ON public.ai_models USING btree (is_free);


--
-- Name: idx_ai_models_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_provider ON public.ai_models USING btree (provider);


--
-- Name: idx_ai_models_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_tier ON public.ai_models USING btree (tier);


--
-- Name: idx_ai_token_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_created_at ON public.ai_token_usage USING btree (created_at);


--
-- Name: idx_ai_token_usage_institute_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_institute_created ON public.ai_token_usage USING btree (institute_id, created_at);


--
-- Name: idx_ai_token_usage_provider_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_provider_created ON public.ai_token_usage USING btree (api_provider, created_at);


--
-- Name: idx_ai_token_usage_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_request_id ON public.ai_token_usage USING btree (request_id) WHERE (request_id IS NOT NULL);


--
-- Name: idx_ai_token_usage_total_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_total_price ON public.ai_token_usage USING btree (total_price) WHERE (total_price IS NOT NULL);


--
-- Name: idx_ai_token_usage_total_tokens; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_total_tokens ON public.ai_token_usage USING btree (total_tokens);


--
-- Name: idx_ai_token_usage_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_type_created ON public.ai_token_usage USING btree (request_type, created_at);


--
-- Name: idx_ai_token_usage_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_token_usage_user_created ON public.ai_token_usage USING btree (user_id, created_at);


--
-- Name: idx_aia_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aia_institute ON public.ai_input_assets USING btree (institute_id);


--
-- Name: idx_aia_institute_kind_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aia_institute_kind_created ON public.ai_input_assets USING btree (institute_id, kind, created_at DESC);


--
-- Name: idx_aia_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aia_status ON public.ai_input_assets USING btree (status);


--
-- Name: idx_aiv_inst_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aiv_inst_status ON public.ai_input_assets USING btree (institute_id, status);


--
-- Name: idx_applicant_app_stage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicant_app_stage_id ON public.applicant USING btree (application_stage_id);


--
-- Name: idx_applicant_stage_applicant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicant_stage_applicant_id ON public.applicant_stage USING btree (applicant_id);


--
-- Name: idx_applicant_stage_stage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicant_stage_stage_id ON public.applicant_stage USING btree (stage_id);


--
-- Name: idx_applicant_tracking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicant_tracking_id ON public.applicant USING btree (tracking_id);


--
-- Name: idx_application_stage_first; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_stage_first ON public.application_stage USING btree (institute_id, workflow_type, is_first);


--
-- Name: idx_application_stage_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_stage_institute ON public.application_stage USING btree (institute_id);


--
-- Name: idx_application_stage_last; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_stage_last ON public.application_stage USING btree (institute_id, workflow_type, is_last);


--
-- Name: idx_application_stage_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_stage_source ON public.application_stage USING btree (source, source_id);


--
-- Name: idx_application_stage_workflow_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_stage_workflow_type ON public.application_stage USING btree (institute_id, workflow_type);


--
-- Name: idx_ar_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_dedupe ON public.audience_response USING btree (audience_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: idx_ar_input_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_input_asset ON public.ai_reels USING btree (input_asset_id);


--
-- Name: idx_ar_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_institute ON public.ai_reels USING btree (institute_id);


--
-- Name: idx_ar_institute_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_institute_created ON public.ai_reels USING btree (institute_id, created_at DESC);


--
-- Name: idx_ar_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_status ON public.ai_reels USING btree (status);


--
-- Name: idx_arc_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_arc_lookup ON public.ai_reel_candidates USING btree (input_asset_id, config_hash, rank);


--
-- Name: idx_arc_ttl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_arc_ttl ON public.ai_reel_candidates USING btree (ttl_at);


--
-- Name: idx_asqo_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asqo_question_id ON public.assignment_slide_question_options USING btree (assignment_slide_question_id);


--
-- Name: idx_assessment_slide_assessment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessment_slide_assessment_id ON public.assessment_slide USING btree (assessment_id);


--
-- Name: idx_assignment_slide_question_assignment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_slide_question_assignment_id ON public.assignment_slide_question USING btree (assignment_slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_assignment_slide_tracked_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_slide_tracked_activity_id ON public.assignment_slide_tracked USING btree (activity_id);


--
-- Name: idx_audience_communication_audience_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_communication_audience_id ON public.audience_communication USING btree (audience_id);


--
-- Name: idx_audience_communication_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_communication_institute_id ON public.audience_communication USING btree (institute_id);


--
-- Name: idx_audience_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_created_at ON public.audience USING btree (created_at);


--
-- Name: idx_audience_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_dates ON public.audience USING btree (start_date, end_date);


--
-- Name: idx_audience_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_id ON public.form_webhook_connector USING btree (audience_id);


--
-- Name: idx_audience_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_institute_id ON public.audience USING btree (institute_id);


--
-- Name: idx_audience_response_applicant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_applicant_id ON public.audience_response USING btree (applicant_id);


--
-- Name: idx_audience_response_audience_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_audience_id ON public.audience_response USING btree (audience_id);


--
-- Name: idx_audience_response_audience_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_audience_source ON public.audience_response USING btree (audience_id, source_type);


--
-- Name: idx_audience_response_audience_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_audience_submitted ON public.audience_response USING btree (audience_id, submitted_at DESC);


--
-- Name: idx_audience_response_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_created_at ON public.audience_response USING btree (workflow_activate_day_at);


--
-- Name: idx_audience_response_dest_pkg_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_dest_pkg_session_id ON public.audience_response USING btree (destination_package_session_id);


--
-- Name: idx_audience_response_enquiry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_enquiry_id ON public.audience_response USING btree (enquiry_id);


--
-- Name: idx_audience_response_lead_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_lead_status ON public.audience_response USING btree (lead_status_id);


--
-- Name: idx_audience_response_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_source_type ON public.audience_response USING btree (source_type);


--
-- Name: idx_audience_response_student_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_student_user_id ON public.audience_response USING btree (student_user_id);


--
-- Name: idx_audience_response_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_submitted_at ON public.audience_response USING btree (submitted_at);


--
-- Name: idx_audience_response_tat_scan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_tat_scan ON public.audience_response USING btree (overall_status, tat_due_at, tat_reminder_stage);


--
-- Name: idx_audience_response_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_user_id ON public.audience_response USING btree (user_id);


--
-- Name: idx_audience_response_workflow_activate_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_response_workflow_activate_day ON public.audience_response USING btree (audience_id, workflow_activate_day_at);


--
-- Name: idx_audience_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_session_id ON public.audience USING btree (session_id);


--
-- Name: idx_audience_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_status ON public.audience USING btree (status);


--
-- Name: idx_audio_slide_audio_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audio_slide_audio_file_id ON public.audio_slide USING btree (audio_file_id);


--
-- Name: idx_audio_tracked_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audio_tracked_activity_id ON public.audio_tracked USING btree (activity_id);


--
-- Name: idx_booking_types_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_booking_types_code ON public.booking_types USING btree (code);


--
-- Name: idx_booking_types_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_types_institute_id ON public.booking_types USING btree (institute_id);


--
-- Name: idx_brand_kit_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_kit_institute ON public.brand_kit USING btree (institute_id);


--
-- Name: idx_cc_tg_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cc_tg_name ON public.course_catalogue USING btree (tag_name);


--
-- Name: idx_chapter_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_created_at ON public.chapter USING btree (created_at DESC);


--
-- Name: idx_chapter_package_session_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_package_session_mapping ON public.chapter_package_session_mapping USING btree (chapter_id, package_session_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_chapter_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_status ON public.chapter USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_chapter_to_slides_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_to_slides_chapter_id ON public.chapter_to_slides USING btree (chapter_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_chapter_to_slides_chapter_status_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_to_slides_chapter_status_order ON public.chapter_to_slides USING btree (chapter_id, status, slide_order) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_chapter_to_slides_slide_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_to_slides_slide_id ON public.chapter_to_slides USING btree (slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at DESC);


--
-- Name: idx_chat_messages_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_session_id ON public.chat_messages USING btree (session_id, id);


--
-- Name: idx_chat_messages_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_type ON public.chat_messages USING btree (session_id, message_type);


--
-- Name: idx_chat_sessions_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_institute_id ON public.chat_sessions USING btree (institute_id);


--
-- Name: idx_chat_sessions_last_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_last_active ON public.chat_sessions USING btree (last_active DESC);


--
-- Name: idx_chat_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_status ON public.chat_sessions USING btree (status);


--
-- Name: idx_chat_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions USING btree (user_id, status);


--
-- Name: idx_cim_ins_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cim_ins_id ON public.catalogue_institute_mapping USING btree (institute_id);


--
-- Name: idx_cim_src; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cim_src ON public.catalogue_institute_mapping USING btree (source, source_id);


--
-- Name: idx_coding_submissions_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coding_submissions_learner ON public.coding_submissions USING btree (learner_id);


--
-- Name: idx_coding_submissions_slide; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coding_submissions_slide ON public.coding_submissions USING btree (slide_id);


--
-- Name: idx_coding_submissions_slide_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coding_submissions_slide_learner ON public.coding_submissions USING btree (slide_id, learner_id);


--
-- Name: idx_concentration_score_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concentration_score_activity_id ON public.concentration_score USING btree (activity_id);


--
-- Name: idx_content_embeddings_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_embeddings_institute ON public.content_embeddings USING btree (institute_id);


--
-- Name: idx_content_embeddings_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_embeddings_source ON public.content_embeddings USING btree (source_type, source_id);


--
-- Name: idx_content_embeddings_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_embeddings_vector ON public.content_embeddings USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_counselor_pool_audience_pool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counselor_pool_audience_pool ON public.counselor_pool_audience USING btree (pool_id);


--
-- Name: idx_counselor_pool_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counselor_pool_institute ON public.counselor_pool USING btree (institute_id);


--
-- Name: idx_counselor_pool_member_counselor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counselor_pool_member_counselor ON public.counselor_pool_member USING btree (counselor_user_id);


--
-- Name: idx_counselor_pool_member_pool_audience_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counselor_pool_member_pool_audience_order ON public.counselor_pool_member USING btree (pool_id, audience_id, display_order);


--
-- Name: idx_counselor_pool_shift_member_counselor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counselor_pool_shift_member_counselor ON public.counselor_pool_shift_member USING btree (counselor_user_id);


--
-- Name: idx_counselor_pool_shift_member_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counselor_pool_shift_member_shift ON public.counselor_pool_shift_member USING btree (shift_id);


--
-- Name: idx_counselor_pool_shift_pool_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counselor_pool_shift_pool_day ON public.counselor_pool_shift USING btree (pool_id, day_of_week, start_time);


--
-- Name: idx_cpsm_package_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpsm_package_session_id ON public.chapter_package_session_mapping USING btree (package_session_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_created_at ON public.workflow_execution_log USING btree (created_at);


--
-- Name: idx_credit_alerts_acknowledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_alerts_acknowledged ON public.credit_alerts USING btree (acknowledged);


--
-- Name: idx_credit_alerts_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_alerts_institute_id ON public.credit_alerts USING btree (institute_id);


--
-- Name: idx_credit_alerts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_alerts_type ON public.credit_alerts USING btree (alert_type);


--
-- Name: idx_credit_pack_active_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_pack_active_order ON public.credit_pack USING btree (is_active, display_order);


--
-- Name: idx_credit_pack_price_pack_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_pack_price_pack_currency ON public.credit_pack_price USING btree (pack_id, currency);


--
-- Name: idx_credit_rate_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_rate_effective ON public.credit_rate_config USING btree (effective_from DESC);


--
-- Name: idx_credit_transactions_batch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_batch_id ON public.credit_transactions USING btree (batch_id);


--
-- Name: idx_credit_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions USING btree (created_at);


--
-- Name: idx_credit_transactions_external_ref_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_credit_transactions_external_ref_unique ON public.credit_transactions USING btree (external_reference_id) WHERE (external_reference_id IS NOT NULL);


--
-- Name: idx_credit_transactions_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_institute_id ON public.credit_transactions USING btree (institute_id);


--
-- Name: idx_credit_transactions_reference_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_reference_id ON public.credit_transactions USING btree (reference_id);


--
-- Name: idx_credit_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_type ON public.credit_transactions USING btree (transaction_type);


--
-- Name: idx_custom_fields_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_key ON public.custom_fields USING btree (field_key);


--
-- Name: idx_custom_fields_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_fields_type ON public.custom_fields USING btree (field_type);


--
-- Name: idx_dedupe_template_key_sr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dedupe_template_key_sr ON public.node_dedupe_record USING btree (node_template_id, operation_key, schedule_run_id);


--
-- Name: idx_dedupe_wf_sr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dedupe_wf_sr ON public.node_dedupe_record USING btree (workflow_id, schedule_run_id);


--
-- Name: idx_document_slide_type_pages; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_slide_type_pages ON public.document_slide USING btree (type, published_document_total_pages);


--
-- Name: idx_document_tracked_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_tracked_activity_id ON public.document_tracked USING btree (activity_id);


--
-- Name: idx_document_tracked_page_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_tracked_page_number ON public.document_tracked USING btree (activity_id, page_number);


--
-- Name: idx_doubt_assignee_doubt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doubt_assignee_doubt_id ON public.doubt_assignee USING btree (doubt_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_doubts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doubts_status ON public.doubts USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_doubts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doubts_user_id ON public.doubts USING btree (user_id, created_at DESC) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_enquiry_assigned_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enquiry_assigned_user_id ON public.enquiry USING btree (assigned_user_id);


--
-- Name: idx_enquiry_tracking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enquiry_tracking_id ON public.enquiry USING btree (enquiry_tracking_id);


--
-- Name: idx_enroll_invite_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enroll_invite_status ON public.enroll_invite USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_enroll_invite_sub_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enroll_invite_sub_org_id ON public.enroll_invite USING btree (sub_org_id);


--
-- Name: idx_entity_access_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_access_entity_id ON public.entity_access USING btree (entity_id);


--
-- Name: idx_entity_access_level_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_access_level_id ON public.entity_access USING btree (level_id);


--
-- Name: idx_faculty_package_session_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faculty_package_session_mapping ON public.faculty_subject_package_session_mapping USING btree (package_session_id, user_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_faculty_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faculty_subject_id ON public.faculty_subject_package_session_mapping USING btree (subject_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_faculty_user_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faculty_user_id_status ON public.faculty_subject_package_session_mapping USING btree (user_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_fwc_platform_form_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fwc_platform_form_vendor ON public.form_webhook_connector USING btree (platform_form_id, vendor) WHERE ((platform_form_id IS NOT NULL) AND (is_active = true));


--
-- Name: idx_fwc_platform_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fwc_platform_page_id ON public.form_webhook_connector USING btree (platform_page_id) WHERE (platform_page_id IS NOT NULL);


--
-- Name: idx_hr_approval_action_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_approval_action_request ON public.hr_approval_action USING btree (request_id);


--
-- Name: idx_hr_approval_chain_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_approval_chain_institute ON public.hr_approval_chain USING btree (institute_id);


--
-- Name: idx_hr_approval_req_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_approval_req_entity ON public.hr_approval_request USING btree (entity_type, entity_id);


--
-- Name: idx_hr_approval_req_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_approval_req_institute ON public.hr_approval_request USING btree (institute_id);


--
-- Name: idx_hr_approval_req_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_approval_req_requester ON public.hr_approval_request USING btree (requester_id);


--
-- Name: idx_hr_approval_req_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_approval_req_status ON public.hr_approval_request USING btree (status);


--
-- Name: idx_hr_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_attendance_date ON public.hr_attendance_record USING btree (attendance_date);


--
-- Name: idx_hr_attendance_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_attendance_employee_date ON public.hr_attendance_record USING btree (employee_id, attendance_date);


--
-- Name: idx_hr_attendance_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_attendance_institute ON public.hr_attendance_record USING btree (institute_id);


--
-- Name: idx_hr_attendance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_attendance_status ON public.hr_attendance_record USING btree (status);


--
-- Name: idx_hr_bank_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_bank_employee ON public.hr_employee_bank_detail USING btree (employee_id);


--
-- Name: idx_hr_bank_export_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_bank_export_run ON public.hr_bank_export_log USING btree (payroll_run_id);


--
-- Name: idx_hr_comp_off_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_comp_off_employee ON public.hr_comp_off USING btree (employee_id);


--
-- Name: idx_hr_comp_off_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_comp_off_status ON public.hr_comp_off USING btree (status);


--
-- Name: idx_hr_department_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_department_institute ON public.hr_department USING btree (institute_id);


--
-- Name: idx_hr_department_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_department_parent ON public.hr_department USING btree (parent_id);


--
-- Name: idx_hr_designation_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_designation_institute ON public.hr_designation USING btree (institute_id);


--
-- Name: idx_hr_document_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_document_employee ON public.hr_employee_document USING btree (employee_id);


--
-- Name: idx_hr_emp_salary_comp_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_emp_salary_comp_structure ON public.hr_employee_salary_component USING btree (salary_structure_id);


--
-- Name: idx_hr_employee_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_employee_department ON public.hr_employee_profile USING btree (department_id);


--
-- Name: idx_hr_employee_designation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_employee_designation ON public.hr_employee_profile USING btree (designation_id);


--
-- Name: idx_hr_employee_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_employee_institute ON public.hr_employee_profile USING btree (institute_id);


--
-- Name: idx_hr_employee_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_employee_manager ON public.hr_employee_profile USING btree (reporting_manager_id);


--
-- Name: idx_hr_employee_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_employee_status ON public.hr_employee_profile USING btree (employment_status);


--
-- Name: idx_hr_employee_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_employee_user ON public.hr_employee_profile USING btree (user_id);


--
-- Name: idx_hr_holiday_institute_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_holiday_institute_year ON public.hr_holiday USING btree (institute_id, year);


--
-- Name: idx_hr_leave_app_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_app_dates ON public.hr_leave_application USING btree (from_date, to_date);


--
-- Name: idx_hr_leave_app_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_app_employee ON public.hr_leave_application USING btree (employee_id);


--
-- Name: idx_hr_leave_app_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_app_institute ON public.hr_leave_application USING btree (institute_id);


--
-- Name: idx_hr_leave_app_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_app_status ON public.hr_leave_application USING btree (status);


--
-- Name: idx_hr_leave_balance_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_balance_employee ON public.hr_leave_balance USING btree (employee_id);


--
-- Name: idx_hr_leave_policy_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_policy_institute ON public.hr_leave_policy USING btree (institute_id);


--
-- Name: idx_hr_leave_policy_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_policy_type ON public.hr_leave_policy USING btree (leave_type_id);


--
-- Name: idx_hr_leave_type_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_leave_type_institute ON public.hr_leave_type USING btree (institute_id);


--
-- Name: idx_hr_loan_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_loan_employee ON public.hr_employee_loan USING btree (employee_id);


--
-- Name: idx_hr_loan_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_loan_institute ON public.hr_employee_loan USING btree (institute_id);


--
-- Name: idx_hr_loan_repayment_loan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_loan_repayment_loan ON public.hr_loan_repayment USING btree (loan_id);


--
-- Name: idx_hr_loan_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_loan_status ON public.hr_employee_loan USING btree (status);


--
-- Name: idx_hr_payroll_entry_comp_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_entry_comp_entry ON public.hr_payroll_entry_component USING btree (payroll_entry_id);


--
-- Name: idx_hr_payroll_entry_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_entry_employee ON public.hr_payroll_entry USING btree (employee_id);


--
-- Name: idx_hr_payroll_entry_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_entry_run ON public.hr_payroll_entry USING btree (payroll_run_id);


--
-- Name: idx_hr_payroll_run_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_run_institute ON public.hr_payroll_run USING btree (institute_id);


--
-- Name: idx_hr_payroll_run_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payroll_run_period ON public.hr_payroll_run USING btree (year, month);


--
-- Name: idx_hr_payslip_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payslip_employee ON public.hr_payslip USING btree (employee_id);


--
-- Name: idx_hr_payslip_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payslip_institute ON public.hr_payslip USING btree (institute_id);


--
-- Name: idx_hr_payslip_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_payslip_period ON public.hr_payslip USING btree (year, month);


--
-- Name: idx_hr_regularization_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_regularization_employee ON public.hr_attendance_regularization USING btree (employee_id);


--
-- Name: idx_hr_regularization_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_regularization_status ON public.hr_attendance_regularization USING btree (approval_status);


--
-- Name: idx_hr_reimbursement_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_reimbursement_employee ON public.hr_reimbursement USING btree (employee_id);


--
-- Name: idx_hr_reimbursement_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_reimbursement_institute ON public.hr_reimbursement USING btree (institute_id);


--
-- Name: idx_hr_reimbursement_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_reimbursement_status ON public.hr_reimbursement USING btree (status);


--
-- Name: idx_hr_salary_comp_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_salary_comp_institute ON public.hr_salary_component USING btree (institute_id);


--
-- Name: idx_hr_salary_revision_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_salary_revision_employee ON public.hr_salary_revision USING btree (employee_id);


--
-- Name: idx_hr_salary_structure_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_salary_structure_employee ON public.hr_employee_salary_structure USING btree (employee_id);


--
-- Name: idx_hr_salary_structure_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_salary_structure_status ON public.hr_employee_salary_structure USING btree (status);


--
-- Name: idx_hr_salary_template_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_salary_template_institute ON public.hr_salary_template USING btree (institute_id);


--
-- Name: idx_hr_shift_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_shift_institute ON public.hr_shift USING btree (institute_id);


--
-- Name: idx_hr_shift_mapping_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_shift_mapping_employee ON public.hr_employee_shift_mapping USING btree (employee_id);


--
-- Name: idx_hr_shift_mapping_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_shift_mapping_shift ON public.hr_employee_shift_mapping USING btree (shift_id);


--
-- Name: idx_hr_tax_computation_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tax_computation_employee ON public.hr_tax_computation USING btree (employee_id);


--
-- Name: idx_hr_tax_computation_fy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tax_computation_fy ON public.hr_tax_computation USING btree (financial_year);


--
-- Name: idx_hr_tax_config_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tax_config_institute ON public.hr_tax_configuration USING btree (institute_id);


--
-- Name: idx_hr_tax_declaration_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_tax_declaration_employee ON public.hr_tax_declaration USING btree (employee_id);


--
-- Name: idx_hr_template_comp_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_template_comp_component ON public.hr_salary_template_component USING btree (component_id);


--
-- Name: idx_hr_template_comp_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_template_comp_template ON public.hr_salary_template_component USING btree (template_id);


--
-- Name: idx_idr_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idr_domain ON public.institute_domain_routing USING btree (lower((domain)::text));


--
-- Name: idx_idr_domain_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idr_domain_subdomain ON public.institute_domain_routing USING btree (lower((domain)::text), subdomain);


--
-- Name: idx_idr_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idr_institute_id ON public.institute_domain_routing USING btree (institute_id);


--
-- Name: idx_iftp_inst_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iftp_inst_scope ON public.institute_fee_type_priority USING btree (institute_id, scope, priority_order);


--
-- Name: idx_ilspm_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ilspm_institute_id ON public.institute_live_session_provider_mapping USING btree (institute_id);


--
-- Name: idx_ilspm_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ilspm_provider ON public.institute_live_session_provider_mapping USING btree (provider);


--
-- Name: idx_ilspm_vendor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ilspm_vendor_user_id ON public.institute_live_session_provider_mapping USING btree (vendor_user_id);


--
-- Name: idx_institute_credits_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_institute_credits_balance ON public.institute_credits USING btree (current_balance);


--
-- Name: idx_institute_credits_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_institute_credits_institute_id ON public.institute_credits USING btree (institute_id);


--
-- Name: idx_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_institute_id ON public.form_webhook_connector USING btree (institute_id);


--
-- Name: idx_institutes_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_institutes_product ON public.institutes USING btree (product);


--
-- Name: idx_instructor_copilot_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instructor_copilot_logs_created_at ON public.instructor_copilot_logs USING btree (created_at);


--
-- Name: idx_instructor_copilot_logs_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instructor_copilot_logs_institute_id ON public.instructor_copilot_logs USING btree (institute_id);


--
-- Name: idx_instructor_copilot_logs_package_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instructor_copilot_logs_package_session_id ON public.instructor_copilot_logs USING btree (package_session_id);


--
-- Name: idx_instructor_copilot_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instructor_copilot_logs_status ON public.instructor_copilot_logs USING btree (status);


--
-- Name: idx_instructor_copilot_logs_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instructor_copilot_logs_subject_id ON public.instructor_copilot_logs USING btree (subject_id);


--
-- Name: idx_invoice_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_institute_id ON public.invoice USING btree (institute_id);


--
-- Name: idx_invoice_invoice_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_invoice_date ON public.invoice USING btree (invoice_date);


--
-- Name: idx_invoice_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_invoice_number ON public.invoice USING btree (invoice_number);


--
-- Name: idx_invoice_line_item_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_line_item_invoice_id ON public.invoice_line_item USING btree (invoice_id);


--
-- Name: idx_invoice_line_item_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_line_item_item_type ON public.invoice_line_item USING btree (item_type);


--
-- Name: idx_invoice_line_item_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_line_item_source_id ON public.invoice_line_item USING btree (source_id);


--
-- Name: idx_invoice_payment_log_mapping_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_payment_log_mapping_invoice_id ON public.invoice_payment_log_mapping USING btree (invoice_id);


--
-- Name: idx_invoice_payment_log_mapping_payment_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_payment_log_mapping_payment_log_id ON public.invoice_payment_log_mapping USING btree (payment_log_id);


--
-- Name: idx_invoice_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_status ON public.invoice USING btree (status);


--
-- Name: idx_invoice_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_user_id ON public.invoice USING btree (user_id);


--
-- Name: idx_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_active ON public.form_webhook_connector USING btree (is_active);


--
-- Name: idx_issued_certificate_certificate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_issued_certificate_certificate_id ON public.issued_certificate USING btree (certificate_id);


--
-- Name: idx_issued_certificate_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issued_certificate_institute ON public.issued_certificate USING btree (institute_id);


--
-- Name: idx_issued_certificate_user_pkg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issued_certificate_user_pkg ON public.issued_certificate USING btree (user_id, package_session_id);


--
-- Name: idx_kb_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_items_category ON public.knowledge_base_items USING btree (institute_id, category);


--
-- Name: idx_kb_items_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_items_institute ON public.knowledge_base_items USING btree (institute_id);


--
-- Name: idx_keap_payments_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_keap_payments_contact_id ON public.migration_staging_keap_payments USING btree (keap_contact_id);


--
-- Name: idx_keap_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_keap_payments_status ON public.migration_staging_keap_payments USING btree (migration_status);


--
-- Name: idx_keap_users_record_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_keap_users_record_type ON public.migration_staging_keap_users USING btree (record_type);


--
-- Name: idx_keap_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_keap_users_status ON public.migration_staging_keap_users USING btree (migration_status);


--
-- Name: idx_lead_followup_audience_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followup_audience_response ON public.lead_followup USING btree (audience_response_id);


--
-- Name: idx_lead_followup_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followup_created_by ON public.lead_followup USING btree (created_by);


--
-- Name: idx_lead_followup_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followup_institute ON public.lead_followup USING btree (institute_id);


--
-- Name: idx_lead_followup_is_closed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followup_is_closed ON public.lead_followup USING btree (is_closed);


--
-- Name: idx_lead_followup_schedule_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followup_schedule_time ON public.lead_followup USING btree (schedule_time);


--
-- Name: idx_lead_score_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_score_audience ON public.lead_score USING btree (audience_id, raw_score);


--
-- Name: idx_lead_score_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_score_response ON public.lead_score USING btree (audience_response_id);


--
-- Name: idx_lead_sla_role_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_sla_role_institute ON public.lead_sla_notify_role USING btree (institute_id, sla_type);


--
-- Name: idx_lead_sla_window_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_sla_window_institute ON public.lead_sla_reminder_window USING btree (institute_id, sla_type, display_order);


--
-- Name: idx_lead_status_history_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_status_history_institute ON public.lead_status_history USING btree (institute_id, to_status_id);


--
-- Name: idx_lead_status_history_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_status_history_lead ON public.lead_status_history USING btree (audience_response_id, changed_at);


--
-- Name: idx_lead_status_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_status_institute ON public.lead_status USING btree (institute_id, is_active, display_order);


--
-- Name: idx_learner_invitation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learner_invitation_status ON public.learner_invitation USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_learner_operation_source_id_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learner_operation_source_id_operation ON public.learner_operation USING btree (source_id, operation) WHERE ((operation)::text = ANY (ARRAY[('PERCENTAGE_COMPLETED'::character varying)::text, ('PERCENTAGE_CHAPTER_COMPLETED'::character varying)::text]));


--
-- Name: idx_learner_operation_user_id_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learner_operation_user_id_source ON public.learner_operation USING btree (user_id, source, source_id);


--
-- Name: idx_learner_operation_user_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learner_operation_user_operation ON public.learner_operation USING btree (user_id, operation, source);


--
-- Name: idx_learner_progress_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learner_progress_lookup ON public.learner_operation USING btree (user_id, operation, source_id, value) WHERE ((operation)::text = ANY (ARRAY[('PERCENTAGE_COMPLETED'::character varying)::text, ('PERCENTAGE_CHAPTER_COMPLETED'::character varying)::text]));


--
-- Name: idx_learning_analytics_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_analytics_created ON public.learning_analytics USING btree (created_at);


--
-- Name: idx_learning_analytics_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_analytics_topic ON public.learning_analytics USING btree (user_id, topic);


--
-- Name: idx_learning_analytics_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_analytics_user ON public.learning_analytics USING btree (user_id, event_type);


--
-- Name: idx_ledger_installment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_installment ON public.student_fee_allocation_ledger USING btree (student_fee_payment_id);


--
-- Name: idx_ledger_payment_log; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_payment_log ON public.student_fee_allocation_ledger USING btree (payment_log_id);


--
-- Name: idx_ledger_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_user_id ON public.student_fee_allocation_ledger USING btree (user_id);


--
-- Name: idx_level_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_level_id ON public.level USING btree (id);


--
-- Name: idx_level_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_level_name ON public.level USING btree (level_name) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_level_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_level_name_lower ON public.level USING btree (lower((level_name)::text));


--
-- Name: idx_level_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_level_status ON public.level USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_linked_events_linked_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linked_events_linked_session_id ON public.linked_events USING btree (linked_session_id);


--
-- Name: idx_linked_events_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linked_events_source ON public.linked_events USING btree (source, source_id);


--
-- Name: idx_linked_users_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linked_users_source ON public.linked_users USING btree (source, source_id);


--
-- Name: idx_linked_users_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linked_users_user_id ON public.linked_users USING btree (user_id);


--
-- Name: idx_live_session_access_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_access_level ON public.live_session USING btree (access_level);


--
-- Name: idx_live_session_booking_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_booking_type_id ON public.live_session USING btree (booking_type_id);


--
-- Name: idx_live_session_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_created_at ON public.live_session USING btree (created_at DESC);


--
-- Name: idx_live_session_institute_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_institute_id_status ON public.live_session USING btree (institute_id, status);


--
-- Name: idx_live_session_participants_batch_optimized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_participants_batch_optimized ON public.live_session_participants USING btree (source_id, session_id) WHERE ((source_type)::text = 'BATCH'::text);


--
-- Name: idx_live_session_participants_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_participants_session ON public.live_session_participants USING btree (session_id, source_type, source_id);


--
-- Name: idx_live_session_participants_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_participants_source ON public.live_session_participants USING btree (source_type, source_id);


--
-- Name: idx_live_session_participants_source_optimized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_participants_source_optimized ON public.live_session_participants USING btree (source_type, source_id, session_id);


--
-- Name: idx_live_session_participants_user_optimized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_participants_user_optimized ON public.live_session_participants USING btree (source_id, session_id) WHERE ((source_type)::text = 'USER'::text);


--
-- Name: idx_live_session_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_source ON public.live_session USING btree (source, source_id);


--
-- Name: idx_live_session_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_status ON public.live_session USING btree (status) WHERE ((status)::text = ANY (ARRAY[('LIVE'::character varying)::text, ('DRAFT'::character varying)::text]));


--
-- Name: idx_live_session_status_id_optimized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_session_status_id_optimized ON public.live_session USING btree (status, id) WHERE ((status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('LIVE'::character varying)::text]));


--
-- Name: idx_modules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modules_status ON public.modules USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_node_dedupe_operation_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_dedupe_operation_key ON public.node_dedupe_record USING btree (operation_key);


--
-- Name: idx_node_exec_st; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_exec_st ON public.node_execution USING btree (status, started_at);


--
-- Name: idx_node_exec_wf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_exec_wf ON public.node_execution USING btree (workflow_execution_id, execution_order);


--
-- Name: idx_node_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_template_id ON public.workflow_execution_log USING btree (node_template_id);


--
-- Name: idx_node_template_inst_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_template_inst_status ON public.node_template USING btree (institute_id, status);


--
-- Name: idx_node_template_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_template_name ON public.node_template USING btree (institute_id, node_name);


--
-- Name: idx_node_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_type ON public.workflow_execution_log USING btree (node_type);


--
-- Name: idx_notification_event_config_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_event_config_active ON public.notification_event_config USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_notification_event_config_event_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_event_config_event_source ON public.notification_event_config USING btree (event_name, source_type, source_id);


--
-- Name: idx_notification_event_config_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_event_config_template ON public.notification_event_config USING btree (template_id);


--
-- Name: idx_notification_setting_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_setting_source ON public.notification_setting USING btree (source, source_id, status);


--
-- Name: idx_notification_setting_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_setting_type ON public.notification_setting USING btree (type, status);


--
-- Name: idx_oauth_state_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_state_expires ON public.oauth_connect_state USING btree (expires_at);


--
-- Name: idx_oauth_state_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_state_status ON public.oauth_connect_state USING btree (session_status, expires_at);


--
-- Name: idx_ota_bundle_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ota_bundle_active ON public.ota_bundle_version USING btree (is_active, platform, created_at DESC);


--
-- Name: idx_package_complete_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_complete_lookup ON public.package USING btree (status, is_course_published_to_catalaouge, created_at DESC) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_package_institute_complete_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_institute_complete_lookup ON public.package_institute USING btree (institute_id, package_id, group_id);


--
-- Name: idx_package_institute_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_institute_group_id ON public.package_institute USING btree (group_id) WHERE (group_id IS NOT NULL);


--
-- Name: idx_package_institute_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_institute_institute_id ON public.package_institute USING btree (institute_id);


--
-- Name: idx_package_institute_institute_pkg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_institute_institute_pkg ON public.package_institute USING btree (institute_id, package_id);


--
-- Name: idx_package_session_content_copied_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_session_content_copied_from ON public.package_session USING btree (content_copied_from_package_session_id) WHERE (content_copied_from_package_session_id IS NOT NULL);


--
-- Name: idx_package_session_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_session_created_at_desc ON public.package_session USING btree (created_at DESC) WHERE ((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('HIDDEN'::character varying)::text]));


--
-- Name: idx_package_session_id_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_session_id_package ON public.package_session USING btree (id, package_id);


--
-- Name: idx_package_session_paginated_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_session_paginated_search ON public.package_session USING btree (status, package_id, created_at DESC) WHERE ((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('HIDDEN'::character varying)::text, ('DRAFT'::character varying)::text]));


--
-- Name: idx_package_session_pkg_status_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_session_pkg_status_level ON public.package_session USING btree (package_id, status, level_id);


--
-- Name: idx_package_session_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_package_session_search ON public.package_session USING btree (session_id, level_id, status) WHERE ((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('HIDDEN'::character varying)::text, ('DRAFT'::character varying)::text]));


--
-- Name: idx_page_sub_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_sub_institute ON public.ad_platform_page_subscription USING btree (institute_id, vendor);


--
-- Name: idx_payment_log_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_log_order_status ON public.payment_log USING btree (order_status) WHERE (order_status IS NOT NULL);


--
-- Name: idx_payment_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_log_status ON public.payment_log USING btree (status);


--
-- Name: idx_payment_log_tracking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_log_tracking_id ON public.payment_log USING btree (tracking_id) WHERE (tracking_id IS NOT NULL);


--
-- Name: idx_payment_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_log_user_id ON public.payment_log USING btree (user_id, created_at DESC);


--
-- Name: idx_payment_option_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_option_type ON public.payment_option USING btree (type);


--
-- Name: idx_payment_plan_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_plan_status ON public.payment_plan USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_persistent_guest_tokens_active_expired; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persistent_guest_tokens_active_expired ON public.persistent_guest_tokens USING btree (is_active, expires_at);


--
-- Name: idx_persistent_guest_tokens_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persistent_guest_tokens_email ON public.persistent_guest_tokens USING btree (email);


--
-- Name: idx_persistent_guest_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persistent_guest_tokens_expires_at ON public.persistent_guest_tokens USING btree (expires_at);


--
-- Name: idx_persistent_guest_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persistent_guest_tokens_token ON public.persistent_guest_tokens USING btree (token);


--
-- Name: idx_pi_institute_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pi_institute_package ON public.package_institute USING btree (institute_id, package_id);


--
-- Name: idx_platform_invoice_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_invoice_buyer ON public.platform_invoice USING btree (buyer_institute_id, issued_at DESC);


--
-- Name: idx_platform_invoice_issued; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_invoice_issued ON public.platform_invoice USING btree (issued_at DESC);


--
-- Name: idx_platform_invoice_line_item_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_invoice_line_item_invoice ON public.platform_invoice_line_item USING btree (platform_invoice_id);


--
-- Name: idx_platform_payment_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_payment_institute ON public.platform_payment USING btree (institute_id, created_at DESC);


--
-- Name: idx_platform_payment_item_pack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_payment_item_pack ON public.platform_payment_item USING btree (pack_id);


--
-- Name: idx_platform_payment_item_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_payment_item_payment ON public.platform_payment_item USING btree (platform_payment_id);


--
-- Name: idx_platform_payment_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_payment_payment_status ON public.platform_payment USING btree (payment_status);


--
-- Name: idx_platform_payment_vendor_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_payment_vendor_payment ON public.platform_payment USING btree (vendor_payment_id);


--
-- Name: idx_pp_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_institute_id ON public.product_page USING btree (institute_id);


--
-- Name: idx_pp_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_status ON public.product_page USING btree (status);


--
-- Name: idx_ppim_product_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ppim_product_page_id ON public.product_page_invite_mapping USING btree (product_page_id);


--
-- Name: idx_ppim_ps_invite_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ppim_ps_invite_po_id ON public.product_page_invite_mapping USING btree (ps_invite_payment_option_id);


--
-- Name: idx_ps_package_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ps_package_status ON public.package_session USING btree (package_id, status);


--
-- Name: idx_question_slide_tracked_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_slide_tracked_activity_id ON public.question_slide_tracked USING btree (activity_id);


--
-- Name: idx_quiz_slide_question_options_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_slide_question_options_question_id ON public.quiz_slide_question_options USING btree (quiz_slide_question_id);


--
-- Name: idx_quiz_slide_question_quiz_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_slide_question_quiz_id ON public.quiz_slide_question USING btree (quiz_slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_quiz_slide_question_quiz_status_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_slide_question_quiz_status_order ON public.quiz_slide_question USING btree (quiz_slide_id, status, question_order) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_quiz_slide_question_tracked_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quiz_slide_question_tracked_activity_id ON public.quiz_slide_question_tracked USING btree (activity_id);


--
-- Name: idx_rating_points; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rating_points ON public.rating USING btree (points) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_rating_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rating_source ON public.rating USING btree (source_type, source_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_rating_user_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rating_user_source ON public.rating USING btree (user_id, source_type, source_id) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_referral_benefit_logs_referral_mapping_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_benefit_logs_referral_mapping_id ON public.referral_benefit_logs USING btree (referral_mapping_id);


--
-- Name: idx_referral_benefit_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_benefit_logs_status ON public.referral_benefit_logs USING btree (status);


--
-- Name: idx_referral_benefit_logs_user_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_benefit_logs_user_plan_id ON public.referral_benefit_logs USING btree (user_plan_id);


--
-- Name: idx_referral_mapping_referee_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_mapping_referee_user_id ON public.referral_mapping USING btree (referee_user_id);


--
-- Name: idx_referral_mapping_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_mapping_referral_code ON public.referral_mapping USING btree (referral_code);


--
-- Name: idx_referral_mapping_referral_option_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_mapping_referral_option_id ON public.referral_mapping USING btree (referral_option_id);


--
-- Name: idx_referral_mapping_referrer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_mapping_referrer_user_id ON public.referral_mapping USING btree (referrer_user_id);


--
-- Name: idx_referral_mapping_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_mapping_status ON public.referral_mapping USING btree (status);


--
-- Name: idx_schedule_run_planned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_run_planned ON public.workflow_schedule_run USING btree (schedule_id, planned_run_at);


--
-- Name: idx_schedule_run_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_run_status ON public.workflow_schedule_run USING btree (schedule_id, status);


--
-- Name: idx_scorm_progress_user_slide; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scorm_progress_user_slide ON public.scorm_learner_progress USING btree (user_id, slide_id);


--
-- Name: idx_session_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_name_lower ON public.session USING btree (lower((session_name)::text));


--
-- Name: idx_session_schedule_meeting_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_schedule_meeting_date ON public.session_schedules USING btree (meeting_date, start_time);


--
-- Name: idx_session_schedule_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_schedule_session_id ON public.session_schedules USING btree (session_id);


--
-- Name: idx_session_schedule_time_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_schedule_time_range ON public.session_schedules USING btree (meeting_date, start_time, last_entry_time);


--
-- Name: idx_session_schedules_upcoming_optimized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_schedules_upcoming_optimized ON public.session_schedules USING btree (meeting_date, start_time, session_id) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_session_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_status ON public.session USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_sfah_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfah_actor ON public.student_fee_adjustment_history USING btree (actor_user_id);


--
-- Name: idx_sfah_bill_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfah_bill_created ON public.student_fee_adjustment_history USING btree (student_fee_payment_id, created_at DESC);


--
-- Name: idx_sfah_institute_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfah_institute_event ON public.student_fee_adjustment_history USING btree (institute_id, event_type, created_at DESC);


--
-- Name: idx_sfcfm_custom_field_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfcfm_custom_field_id ON public.system_field_custom_field_mapping USING btree (custom_field_id);


--
-- Name: idx_sfcfm_institute_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfcfm_institute_entity ON public.system_field_custom_field_mapping USING btree (institute_id, entity_type);


--
-- Name: idx_sfcfm_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfcfm_status ON public.system_field_custom_field_mapping USING btree (status);


--
-- Name: idx_sfcfm_system_field; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfcfm_system_field ON public.system_field_custom_field_mapping USING btree (institute_id, entity_type, system_field_name);


--
-- Name: idx_sfp_cpo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfp_cpo_id ON public.student_fee_payment USING btree (cpo_id);


--
-- Name: idx_sfp_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfp_due_date ON public.student_fee_payment USING btree (due_date);


--
-- Name: idx_sfp_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfp_institute_id ON public.student_fee_payment USING btree (institute_id);


--
-- Name: idx_sfp_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfp_status ON public.student_fee_payment USING btree (status);


--
-- Name: idx_sfp_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfp_user_id ON public.student_fee_payment USING btree (user_id);


--
-- Name: idx_sfp_user_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sfp_user_plan_id ON public.student_fee_payment USING btree (user_plan_id);


--
-- Name: idx_slide_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slide_created_at ON public.slide USING btree (created_at DESC) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_slide_source_id_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slide_source_id_type ON public.slide USING btree (source_id, source_type) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_slide_status_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slide_status_source_type ON public.slide USING btree (status, source_type) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_ssigm_composite_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssigm_composite_lookup ON public.student_session_institute_group_mapping USING btree (user_id, package_session_id, institute_id, status);


--
-- Name: idx_ssigm_enrollment_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssigm_enrollment_number ON public.student_session_institute_group_mapping USING btree (institute_enrollment_number);


--
-- Name: idx_ssigm_expiry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssigm_expiry_date ON public.student_session_institute_group_mapping USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);


--
-- Name: idx_ssigm_group_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssigm_group_id_status ON public.student_session_institute_group_mapping USING btree (group_id, status) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_ssigm_institute_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssigm_institute_id_status ON public.student_session_institute_group_mapping USING btree (institute_id, status) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_ssigm_package_session_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssigm_package_session_id_status ON public.student_session_institute_group_mapping USING btree (package_session_id, status) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_ssigm_user_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssigm_user_id_status ON public.student_session_institute_group_mapping USING btree (user_id, status) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_stage_assignments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stage_assignments_active ON public.ai_model_stage_assignments USING btree (is_active);


--
-- Name: idx_stage_assignments_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stage_assignments_lookup ON public.ai_model_stage_assignments USING btree (use_case, quality_tier, stage_id) WHERE (is_active = true);


--
-- Name: idx_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status ON public.workflow_execution_log USING btree (status);


--
-- Name: idx_student_analysis_process_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_analysis_process_created_at ON public.student_analysis_process USING btree (created_at);


--
-- Name: idx_student_analysis_process_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_analysis_process_status ON public.student_analysis_process USING btree (status);


--
-- Name: idx_student_analysis_process_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_analysis_process_user_id ON public.student_analysis_process USING btree (user_id);


--
-- Name: idx_student_batch_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_batch_lookup ON public.student_session_institute_group_mapping USING btree (package_session_id, institute_id, user_id, status) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_student_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_created_at ON public.student USING btree (created_at DESC);


--
-- Name: idx_student_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_email ON public.student USING btree (email);


--
-- Name: idx_student_fee_payment_fee_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_fee_payment_fee_type_id ON public.student_fee_payment USING btree (fee_type_id);


--
-- Name: idx_student_full_name_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_full_name_gin ON public.student USING gin (to_tsvector('english'::regconfig, (full_name)::text));


--
-- Name: idx_student_mobile_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_mobile_number ON public.student USING btree (mobile_number);


--
-- Name: idx_student_search_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_search_composite ON public.student USING gin (to_tsvector('english'::regconfig, (((full_name)::text || ' '::text) || (username)::text)));


--
-- Name: idx_student_sub_org_sub_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_sub_org_sub_org ON public.student_sub_org USING btree (sub_org_id);


--
-- Name: idx_student_sub_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_sub_org_user ON public.student_sub_org USING btree (user_id);


--
-- Name: idx_student_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_user_id ON public.student USING btree (user_id);


--
-- Name: idx_studio_avatar_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_avatar_institute ON public.studio_avatar USING btree (institute_id);


--
-- Name: idx_studio_avatar_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_avatar_provider ON public.studio_avatar USING btree (institute_id, provider);


--
-- Name: idx_subject_module_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subject_module_mapping ON public.subject_module_mapping USING btree (subject_id, module_id);


--
-- Name: idx_subject_session_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subject_session_mapping ON public.subject_session USING btree (subject_id, session_id);


--
-- Name: idx_subject_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subject_status ON public.subject USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_system_files_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_files_institute_id ON public.system_files USING btree (institute_id);


--
-- Name: idx_system_files_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_files_status ON public.system_files USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_tags_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_institute_id ON public.tags USING btree (institute_id);


--
-- Name: idx_tags_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_status ON public.tags USING btree (status);


--
-- Name: idx_tags_tag_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_tag_name ON public.tags USING btree (tag_name);


--
-- Name: idx_tags_unique_name_per_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tags_unique_name_per_institute ON public.tags USING btree (COALESCE(institute_id, ''::character varying), tag_name) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_teacher_planning_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_created_at ON public.teacher_planning_logs USING btree (created_at DESC);


--
-- Name: idx_teacher_planning_logs_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_created_by_user_id ON public.teacher_planning_logs USING btree (created_by_user_id);


--
-- Name: idx_teacher_planning_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_entity ON public.teacher_planning_logs USING btree (entity, entity_id);


--
-- Name: idx_teacher_planning_logs_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_institute_id ON public.teacher_planning_logs USING btree (institute_id);


--
-- Name: idx_teacher_planning_logs_interval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_interval ON public.teacher_planning_logs USING btree (interval_type, interval_type_id);


--
-- Name: idx_teacher_planning_logs_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_log_type ON public.teacher_planning_logs USING btree (log_type);


--
-- Name: idx_teacher_planning_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_status ON public.teacher_planning_logs USING btree (status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_teacher_planning_logs_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_planning_logs_subject_id ON public.teacher_planning_logs USING btree (subject_id);


--
-- Name: idx_templates_can_delete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_can_delete ON public.templates USING btree (can_delete);


--
-- Name: idx_templates_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_created_at ON public.templates USING btree (created_at);


--
-- Name: idx_templates_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_institute_id ON public.templates USING btree (institute_id);


--
-- Name: idx_templates_institute_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_templates_institute_name_unique ON public.templates USING btree (institute_id, name);


--
-- Name: idx_templates_institute_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_institute_status ON public.templates USING btree (institute_id, status);


--
-- Name: idx_templates_institute_status_template_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_institute_status_template_category ON public.templates USING btree (institute_id, status, template_category);


--
-- Name: idx_templates_institute_template_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_institute_template_category ON public.templates USING btree (institute_id, template_category);


--
-- Name: idx_templates_institute_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_institute_type ON public.templates USING btree (institute_id, type);


--
-- Name: idx_templates_institute_type_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_institute_type_vendor ON public.templates USING btree (institute_id, type, vendor_id);


--
-- Name: idx_templates_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_name ON public.templates USING btree (name);


--
-- Name: idx_templates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_status ON public.templates USING btree (status);


--
-- Name: idx_templates_template_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_template_category ON public.templates USING btree (template_category);


--
-- Name: idx_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_type ON public.templates USING btree (type);


--
-- Name: idx_templates_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_vendor_id ON public.templates USING btree (vendor_id);


--
-- Name: idx_timeline_event_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_event_action_type ON public.timeline_event USING btree (action_type, created_at DESC);


--
-- Name: idx_timeline_event_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_event_actor ON public.timeline_event USING btree (actor_id, created_at DESC) WHERE (actor_id IS NOT NULL);


--
-- Name: idx_timeline_event_metadata_json; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_event_metadata_json ON public.timeline_event USING gin (metadata_json);


--
-- Name: idx_timeline_event_student_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_event_student_category ON public.timeline_event USING btree (student_user_id, category);


--
-- Name: idx_timeline_event_type_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_event_type_type_id ON public.timeline_event USING btree (type, type_id, created_at DESC);


--
-- Name: idx_timeline_event_type_typeid_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_event_type_typeid_category ON public.timeline_event USING btree (type, type_id, category);


--
-- Name: idx_timeline_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_pinned ON public.timeline_event USING btree (type, type_id, is_pinned) WHERE (is_pinned = true);


--
-- Name: idx_timeline_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_student ON public.timeline_event USING btree (student_user_id) WHERE (student_user_id IS NOT NULL);


--
-- Name: idx_user_lead_profile_counselor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_lead_profile_counselor ON public.user_lead_profile USING btree (assigned_counselor_id) WHERE (assigned_counselor_id IS NOT NULL);


--
-- Name: idx_user_lead_profile_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_lead_profile_institute ON public.user_lead_profile USING btree (institute_id);


--
-- Name: idx_user_lead_profile_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_lead_profile_status ON public.user_lead_profile USING btree (institute_id, conversion_status);


--
-- Name: idx_user_lead_profile_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_lead_profile_tier ON public.user_lead_profile USING btree (institute_id, lead_tier);


--
-- Name: idx_user_linked_data_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_linked_data_user_id ON public.user_linked_data USING btree (user_id);


--
-- Name: idx_user_linked_data_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_linked_data_user_type ON public.user_linked_data USING btree (user_id, type);


--
-- Name: idx_user_plan_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_plan_user_id ON public.user_plan USING btree (user_id, status);


--
-- Name: idx_user_tags_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tags_institute_id ON public.user_tags USING btree (institute_id);


--
-- Name: idx_user_tags_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tags_status ON public.user_tags USING btree (status);


--
-- Name: idx_user_tags_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tags_tag_id ON public.user_tags USING btree (tag_id);


--
-- Name: idx_user_tags_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_tags_unique_active ON public.user_tags USING btree (user_id, tag_id, institute_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_user_tags_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tags_user_id ON public.user_tags USING btree (user_id);


--
-- Name: idx_users_ops_log_action_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_ops_log_action_user ON public.users_operations_log USING btree (action_user_id);


--
-- Name: idx_users_ops_log_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_ops_log_source ON public.users_operations_log USING btree (source, source_id);


--
-- Name: idx_vendor_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_vendor_id ON public.form_webhook_connector USING btree (vendor, vendor_id);


--
-- Name: idx_video_slide_published_length; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_slide_published_length ON public.video USING btree (published_video_length) WHERE (published_video_length IS NOT NULL);


--
-- Name: idx_video_slide_question_video_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_slide_question_video_id ON public.video_slide_question USING btree (video_slide_id, status) WHERE ((status)::text <> 'DELETED'::text);


--
-- Name: idx_video_tracked_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_tracked_activity_id ON public.video_tracked USING btree (activity_id);


--
-- Name: idx_video_tracked_time_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_tracked_time_range ON public.video_tracked USING btree (start_time, end_time);


--
-- Name: idx_vrc_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vrc_created_at ON public.vision_review_cases USING btree (created_at);


--
-- Name: idx_vrc_issue_codes_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vrc_issue_codes_gin ON public.vision_review_cases USING gin (issue_codes);


--
-- Name: idx_vrc_quality_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vrc_quality_tier ON public.vision_review_cases USING btree (quality_tier);


--
-- Name: idx_vrc_severity_max; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vrc_severity_max ON public.vision_review_cases USING btree (severity_max);


--
-- Name: idx_vrc_shot_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vrc_shot_type ON public.vision_review_cases USING btree (shot_type);


--
-- Name: idx_vrc_video_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vrc_video_id ON public.vision_review_cases USING btree (video_id);


--
-- Name: idx_wf_exec_state_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_exec_state_execution ON public.workflow_execution_state USING btree (execution_id);


--
-- Name: idx_wf_exec_state_resume; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_exec_state_resume ON public.workflow_execution_state USING btree (status, resume_at) WHERE ((status)::text = 'WAITING'::text);


--
-- Name: idx_wf_node_link_wf_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wf_node_link_wf_order ON public.workflow_node_mapping USING btree (workflow_id, node_order);


--
-- Name: idx_wf_trigger_webhook_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_wf_trigger_webhook_slug ON public.workflow_trigger USING btree (webhook_url_slug) WHERE (webhook_url_slug IS NOT NULL);


--
-- Name: idx_workflow_exec_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_exec_status ON public.workflow_execution_log USING btree (workflow_execution_id, status);


--
-- Name: idx_workflow_execution_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_execution_id ON public.workflow_execution_log USING btree (workflow_execution_id);


--
-- Name: idx_workflow_execution_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_workflow_execution_idempotency_key ON public.workflow_execution USING btree (idempotency_key);


--
-- Name: idx_workflow_execution_schedule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_execution_schedule_id ON public.workflow_execution USING btree (workflow_schedule_id);


--
-- Name: idx_workflow_execution_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_execution_status ON public.workflow_execution USING btree (status);


--
-- Name: idx_workflow_execution_workflow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_execution_workflow_id ON public.workflow_execution USING btree (workflow_id);


--
-- Name: idx_workflow_institute_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_institute_status ON public.workflow USING btree (institute_id, status, workflow_type);


--
-- Name: idx_workflow_schedule_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_schedule_next_run ON public.workflow_schedule USING btree (status, next_run_at);


--
-- Name: idx_workflow_schedule_workflow_stat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_schedule_workflow_stat ON public.workflow_schedule USING btree (workflow_id, status);


--
-- Name: idx_workflow_template_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_template_category ON public.workflow_template USING btree (category);


--
-- Name: idx_workflow_template_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_template_institute ON public.workflow_template USING btree (institute_id);


--
-- Name: idx_workflow_trigger_event_applied_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_trigger_event_applied_type ON public.workflow_trigger USING btree (event_applied_type);


--
-- Name: idx_workflow_trigger_event_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_trigger_event_name ON public.workflow_trigger USING btree (trigger_event_name);


--
-- Name: idx_workflow_trigger_institute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_trigger_institute_id ON public.workflow_trigger USING btree (institute_id);


--
-- Name: idx_youtube_upload_job_institute_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youtube_upload_job_institute_created ON public.youtube_upload_job USING btree (institute_id, created_at DESC);


--
-- Name: idx_youtube_upload_job_schedule_recording; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youtube_upload_job_schedule_recording ON public.youtube_upload_job USING btree (session_schedule_id, recording_id);


--
-- Name: idx_youtube_upload_job_status_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youtube_upload_job_status_retry ON public.youtube_upload_job USING btree (status, next_retry_at);


--
-- Name: package_comma_separated_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX package_comma_separated_tags_idx ON public.package USING btree (comma_separated_tags);


--
-- Name: uq_audience_response_tat_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_audience_response_tat_dedup ON public.audience_response USING btree (tat_reminder_dedup_key) WHERE (tat_reminder_dedup_key IS NOT NULL);


--
-- Name: uq_brand_kit_default_per_institute; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_brand_kit_default_per_institute ON public.brand_kit USING btree (institute_id) WHERE (is_default = true);


--
-- Name: uq_ilspm_institute_provider_global; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ilspm_institute_provider_global ON public.institute_live_session_provider_mapping USING btree (institute_id, provider) WHERE (vendor_user_id IS NULL);


--
-- Name: uq_ilspm_institute_provider_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ilspm_institute_provider_vendor ON public.institute_live_session_provider_mapping USING btree (institute_id, provider, vendor_user_id) WHERE (vendor_user_id IS NOT NULL);


--
-- Name: uq_institute_live_session_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_institute_live_session_provider ON public.institute_live_session_provider_mapping USING btree (COALESCE(institute_id, '__PLATFORM__'::character varying), provider);


--
-- Name: uq_lead_status_institute_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_lead_status_institute_key ON public.lead_status USING btree (institute_id, status_key);


--
-- Name: uq_payment_option_complex_payment_option_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_payment_option_complex_payment_option_id ON public.payment_option USING btree (complex_payment_option_id) WHERE (complex_payment_option_id IS NOT NULL);


--
-- Name: uq_youtube_upload_job_active_file; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_youtube_upload_job_active_file ON public.youtube_upload_job USING btree (recording_file_id) WHERE ((status)::text = ANY ((ARRAY['QUEUED'::character varying, 'UPLOADING'::character varying])::text[]));


--
-- Name: ai_gen_video trg_ai_gen_video_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ai_gen_video_updated_at BEFORE UPDATE ON public.ai_gen_video FOR EACH ROW EXECUTE FUNCTION public.update_ai_gen_video_updated_at();


--
-- Name: ai_input_assets trg_ai_input_videos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ai_input_videos_updated_at BEFORE UPDATE ON public.ai_input_assets FOR EACH ROW EXECUTE FUNCTION public.update_ai_input_videos_updated_at();


--
-- Name: brand_kit trg_brand_kit_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_kit_updated_at BEFORE UPDATE ON public.brand_kit FOR EACH ROW EXECUTE FUNCTION public.update_brand_kit_updated_at();


--
-- Name: custom_field_values trg_enrich_audience_response_defaults; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enrich_audience_response_defaults AFTER INSERT ON public.custom_field_values FOR EACH ROW EXECUTE FUNCTION public.enrich_audience_response_with_center_defaults();


--
-- Name: studio_avatar trg_studio_avatar_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_studio_avatar_updated_at BEFORE UPDATE ON public.studio_avatar FOR EACH ROW EXECUTE FUNCTION public.update_studio_avatar_updated_at();


--
-- Name: entity_access trigger_entity_access_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_entity_access_updated_at BEFORE UPDATE ON public.entity_access FOR EACH ROW EXECUTE FUNCTION public.update_entity_access_updated_at();


--
-- Name: tags trigger_normalize_tag_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_normalize_tag_name BEFORE INSERT OR UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.normalize_tag_name();


--
-- Name: system_files trigger_system_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_system_files_updated_at BEFORE UPDATE ON public.system_files FOR EACH ROW EXECUTE FUNCTION public.update_system_files_updated_at();


--
-- Name: teacher_planning_logs trigger_teacher_planning_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_teacher_planning_logs_updated_at BEFORE UPDATE ON public.teacher_planning_logs FOR EACH ROW EXECUTE FUNCTION public.update_teacher_planning_logs_updated_at();


--
-- Name: ai_api_keys trigger_update_ai_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_ai_api_keys_updated_at BEFORE UPDATE ON public.ai_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_ai_api_keys_updated_at();


--
-- Name: booking_types trigger_update_booking_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_booking_types_updated_at BEFORE UPDATE ON public.booking_types FOR EACH ROW EXECUTE FUNCTION public.update_booking_types_updated_at();


--
-- Name: chat_messages trigger_update_chat_messages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_chat_messages BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_updated_at();


--
-- Name: chat_sessions trigger_update_chat_sessions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_chat_sessions BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_chat_updated_at();


--
-- Name: system_field_custom_field_mapping trigger_update_sfcfm_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_sfcfm_updated_at BEFORE UPDATE ON public.system_field_custom_field_mapping FOR EACH ROW EXECUTE FUNCTION public.update_sfcfm_updated_at();


--
-- Name: student_analysis_process trigger_update_student_analysis_process; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_student_analysis_process BEFORE UPDATE ON public.student_analysis_process FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_student_analysis_process();


--
-- Name: tags trigger_update_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_tags_updated_at BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_tags();


--
-- Name: user_linked_data trigger_update_user_linked_data; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_linked_data BEFORE UPDATE ON public.user_linked_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_user_linked_data();


--
-- Name: user_tags trigger_update_user_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_tags_updated_at BEFORE UPDATE ON public.user_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_tags();


--
-- Name: notification_event_config update_notification_event_config_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_event_config_updated_on BEFORE UPDATE ON public.notification_event_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: templates update_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assessments update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: client_secret_key update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.client_secret_key FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: faculty_session_institute_group update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.faculty_session_institute_group FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: groups update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: institute_metadata update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.institute_metadata FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: institutes update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.institutes FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: level update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.level FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: package update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.package FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: package_institute update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.package_institute FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: package_session update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.package_session FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: sections update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: student_session_institute_group_mapping update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.student_session_institute_group_mapping FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: subject update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.subject FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: subject_session update_user_task_updated_on; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_task_updated_on BEFORE UPDATE ON public.subject_session FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_user_task();


--
-- Name: activity_log activity_log_slide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_slide_id_fkey FOREIGN KEY (slide_id) REFERENCES public.slide(id);


--
-- Name: ai_content_extraction ai_content_extraction_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_content_extraction
    ADD CONSTRAINT ai_content_extraction_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ai_content_source(id);


--
-- Name: ai_generated_artifact ai_generated_artifact_extraction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generated_artifact
    ADD CONSTRAINT ai_generated_artifact_extraction_id_fkey FOREIGN KEY (extraction_id) REFERENCES public.ai_content_extraction(id);


--
-- Name: ai_generated_artifact ai_generated_artifact_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generated_artifact
    ADD CONSTRAINT ai_generated_artifact_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ai_content_source(id);


--
-- Name: ai_reels ai_reels_parent_candidate_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_reels
    ADD CONSTRAINT ai_reels_parent_candidate_fk FOREIGN KEY (parent_candidate_id) REFERENCES public.ai_reel_candidates(id) ON DELETE SET NULL;


--
-- Name: applied_coupon_discount applied_coupon_discount_coupon_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applied_coupon_discount
    ADD CONSTRAINT applied_coupon_discount_coupon_code_id_fkey FOREIGN KEY (coupon_code_id) REFERENCES public.coupon_code(id);


--
-- Name: audio_tracked audio_tracked_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_tracked
    ADD CONSTRAINT audio_tracked_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity_log(id);


--
-- Name: brand_kit brand_kit_institute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_kit
    ADD CONSTRAINT brand_kit_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: credit_pack_price credit_pack_price_pack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_price
    ADD CONSTRAINT credit_pack_price_pack_id_fkey FOREIGN KEY (pack_id) REFERENCES public.credit_pack(id) ON DELETE CASCADE;


--
-- Name: custom_field_values custom_field_values_custom_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE;


--
-- Name: discount_option discount_option_discount_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_option
    ADD CONSTRAINT discount_option_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.applied_coupon_discount(id);


--
-- Name: discount_option discount_option_package_session_learner_invitation_to_paym_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_option
    ADD CONSTRAINT discount_option_package_session_learner_invitation_to_paym_fkey FOREIGN KEY (package_session_learner_invitation_to_payment_option_id) REFERENCES public.package_session_learner_invitation_to_payment_option(id);


--
-- Name: discount_option discount_option_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_option
    ADD CONSTRAINT discount_option_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plan(id);


--
-- Name: document_tracked document_tracked_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tracked
    ADD CONSTRAINT document_tracked_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity_log(id) ON DELETE CASCADE;


--
-- Name: concentration_score fk_activity; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concentration_score
    ADD CONSTRAINT fk_activity FOREIGN KEY (activity_id) REFERENCES public.activity_log(id);


--
-- Name: video_slide_question_tracked fk_activity; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question_tracked
    ADD CONSTRAINT fk_activity FOREIGN KEY (activity_id) REFERENCES public.activity_log(id);


--
-- Name: quiz_slide_question_tracked fk_activity_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question_tracked
    ADD CONSTRAINT fk_activity_id FOREIGN KEY (activity_id) REFERENCES public.activity_log(id);


--
-- Name: question_slide_tracked fk_activity_log; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_slide_tracked
    ADD CONSTRAINT fk_activity_log FOREIGN KEY (activity_id) REFERENCES public.activity_log(id) ON DELETE CASCADE;


--
-- Name: aft_installments fk_aft_inst_afv; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aft_installments
    ADD CONSTRAINT fk_aft_inst_afv FOREIGN KEY (assigned_fee_value_id) REFERENCES public.assigned_fee_value(id);


--
-- Name: assigned_fee_value fk_afv_fee_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assigned_fee_value
    ADD CONSTRAINT fk_afv_fee_type FOREIGN KEY (fee_type_id) REFERENCES public.fee_type(id);


--
-- Name: sections fk_assessment_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT fk_assessment_id FOREIGN KEY (assessment_id) REFERENCES public.assessments(id);


--
-- Name: assignment_slide_tracked fk_assignment_activity_log; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide_tracked
    ADD CONSTRAINT fk_assignment_activity_log FOREIGN KEY (activity_id) REFERENCES public.activity_log(id) ON DELETE CASCADE;


--
-- Name: assignment_slide_question fk_assignment_slide; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide_question
    ADD CONSTRAINT fk_assignment_slide FOREIGN KEY (assignment_slide_id) REFERENCES public.assignment_slide(id);


--
-- Name: assignment_slide_question_options fk_assignment_slide_question; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide_question_options
    ADD CONSTRAINT fk_assignment_slide_question FOREIGN KEY (assignment_slide_question_id) REFERENCES public.assignment_slide_question(id) ON DELETE CASCADE;


--
-- Name: audience fk_audience_institute; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience
    ADD CONSTRAINT fk_audience_institute FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;


--
-- Name: audience_response fk_audience_response_audience; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience_response
    ADD CONSTRAINT fk_audience_response_audience FOREIGN KEY (audience_id) REFERENCES public.audience(id) ON DELETE CASCADE;


--
-- Name: audience fk_audience_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience
    ADD CONSTRAINT fk_audience_session FOREIGN KEY (session_id) REFERENCES public.session(id) ON DELETE SET NULL;


--
-- Name: chapter_package_session_mapping fk_chapter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_package_session_mapping
    ADD CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id);


--
-- Name: chapter_to_slides fk_chapter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_to_slides
    ADD CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id) ON DELETE CASCADE;


--
-- Name: module_chapter_mapping fk_chapter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_chapter_mapping
    ADD CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id);


--
-- Name: subject_chapter_module_and_package_session_mapping fk_chapter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_module_and_package_session_mapping
    ADD CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES public.chapter(id);


--
-- Name: chat_messages fk_chat_message_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT fk_chat_message_session FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_sessions fk_chat_session_institute; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT fk_chat_session_institute FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: catalogue_institute_mapping fk_course_catalogue; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_institute_mapping
    ADD CONSTRAINT fk_course_catalogue FOREIGN KEY (course_catalogue) REFERENCES public.course_catalogue(id);


--
-- Name: institute_custom_fields fk_custom_field_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_custom_fields
    ADD CONSTRAINT fk_custom_field_id FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE;


--
-- Name: doubt_assignee fk_doubt; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doubt_assignee
    ADD CONSTRAINT fk_doubt FOREIGN KEY (doubt_id) REFERENCES public.doubts(id);


--
-- Name: enroll_invite fk_enroll_invite_sub_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enroll_invite
    ADD CONSTRAINT fk_enroll_invite_sub_org FOREIGN KEY (sub_org_id) REFERENCES public.institutes(id);


--
-- Name: quiz_slide_question fk_explanation_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question
    ADD CONSTRAINT fk_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id);


--
-- Name: video_slide_question fk_explanation_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question
    ADD CONSTRAINT fk_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id);


--
-- Name: fee_type fk_fee_type_cpo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_type
    ADD CONSTRAINT fk_fee_type_cpo FOREIGN KEY (cpo_id) REFERENCES public.complex_payment_option(id);


--
-- Name: documents fk_folder; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_folder FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: form_webhook_connector fk_form_webhook_connector_audience; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_webhook_connector
    ADD CONSTRAINT fk_form_webhook_connector_audience FOREIGN KEY (audience_id) REFERENCES public.audience(id) ON DELETE CASCADE;


--
-- Name: form_webhook_connector fk_form_webhook_connector_institute; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_webhook_connector
    ADD CONSTRAINT fk_form_webhook_connector_institute FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;


--
-- Name: package_institute fk_group_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_institute
    ADD CONSTRAINT fk_group_id FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: package_session fk_group_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session
    ADD CONSTRAINT fk_group_id FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: student_session_institute_group_mapping fk_group_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT fk_group_id FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: subject_session fk_group_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_session
    ADD CONSTRAINT fk_group_id FOREIGN KEY (session_id) REFERENCES public.package_session(id);


--
-- Name: faculty_session_institute_group fk_institute_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_session_institute_group
    ADD CONSTRAINT fk_institute_id FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: institute_metadata fk_institute_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institute_metadata
    ADD CONSTRAINT fk_institute_id FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: student_session_institute_group_mapping fk_institute_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT fk_institute_id FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: user_institute_payment_gateway_mapping fk_institute_payment_gateway_mapping; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_institute_payment_gateway_mapping
    ADD CONSTRAINT fk_institute_payment_gateway_mapping FOREIGN KEY (institute_payment_gateway_mapping_id) REFERENCES public.institute_payment_gateway_mapping(id) ON DELETE CASCADE;


--
-- Name: migration_staging_keap_payments fk_keap_payment_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_staging_keap_payments
    ADD CONSTRAINT fk_keap_payment_user FOREIGN KEY (keap_contact_id) REFERENCES public.migration_staging_keap_users(keap_contact_id);


--
-- Name: student_fee_allocation_ledger fk_ledger_installment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_allocation_ledger
    ADD CONSTRAINT fk_ledger_installment FOREIGN KEY (student_fee_payment_id) REFERENCES public.student_fee_payment(id);


--
-- Name: student_fee_allocation_ledger fk_ledger_payment_log; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_allocation_ledger
    ADD CONSTRAINT fk_ledger_payment_log FOREIGN KEY (payment_log_id) REFERENCES public.payment_log(id);


--
-- Name: package_session fk_level_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session
    ADD CONSTRAINT fk_level_id FOREIGN KEY (level_id) REFERENCES public.level(id);


--
-- Name: linked_events fk_linked_events_live_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linked_events
    ADD CONSTRAINT fk_linked_events_live_session FOREIGN KEY (linked_session_id) REFERENCES public.live_session(id) ON DELETE SET NULL;


--
-- Name: live_session fk_live_session_booking_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session
    ADD CONSTRAINT fk_live_session_booking_type FOREIGN KEY (booking_type_id) REFERENCES public.booking_types(id) ON DELETE SET NULL;


--
-- Name: live_session_logs fk_live_session_logs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_logs
    ADD CONSTRAINT fk_live_session_logs FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE;


--
-- Name: live_session_logs fk_live_session_logs_schedule_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_logs
    ADD CONSTRAINT fk_live_session_logs_schedule_id FOREIGN KEY (schedule_id) REFERENCES public.session_schedules(id) ON DELETE CASCADE;


--
-- Name: live_session_participants fk_live_session_participants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_participants
    ADD CONSTRAINT fk_live_session_participants FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE;


--
-- Name: module_chapter_mapping fk_module; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_chapter_mapping
    ADD CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: sub_modules fk_module; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_modules
    ADD CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: subject_chapter_module_and_package_session_mapping fk_module; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_module_and_package_session_mapping
    ADD CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: subject_module_mapping fk_module; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_module_mapping
    ADD CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: option fk_option_explanation_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option
    ADD CONSTRAINT fk_option_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: option fk_option_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option
    ADD CONSTRAINT fk_option_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: package_institute fk_package_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_institute
    ADD CONSTRAINT fk_package_id FOREIGN KEY (package_id) REFERENCES public.package(id);


--
-- Name: chapter_package_session_mapping fk_package_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_package_session_mapping
    ADD CONSTRAINT fk_package_session FOREIGN KEY (package_session_id) REFERENCES public.package_session(id);


--
-- Name: subject_chapter_module_and_package_session_mapping fk_package_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_module_and_package_session_mapping
    ADD CONSTRAINT fk_package_session FOREIGN KEY (package_session_id) REFERENCES public.package_session(id);


--
-- Name: package_session_enroll_invite_payment_plan_to_referral_option fk_package_session_invite_payment_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_enroll_invite_payment_plan_to_referral_option
    ADD CONSTRAINT fk_package_session_invite_payment_option FOREIGN KEY (package_session_invite_payment_option_id) REFERENCES public.package_session_learner_invitation_to_payment_option(id);


--
-- Name: groups fk_parent_group_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT fk_parent_group_id FOREIGN KEY (parent_group_id) REFERENCES public.groups(id);


--
-- Name: assignment_slide fk_parent_rich_text; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide
    ADD CONSTRAINT fk_parent_rich_text FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: quiz_slide_question fk_parent_rich_text; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question
    ADD CONSTRAINT fk_parent_rich_text FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id);


--
-- Name: video_slide_question fk_parent_rich_text; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question
    ADD CONSTRAINT fk_parent_rich_text FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id);


--
-- Name: package_session_learner_invitation_to_payment_option fk_payment_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_learner_invitation_to_payment_option
    ADD CONSTRAINT fk_payment_option FOREIGN KEY (payment_option_id) REFERENCES public.payment_option(id);


--
-- Name: payment_option fk_payment_option_cpo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_option
    ADD CONSTRAINT fk_payment_option_cpo FOREIGN KEY (complex_payment_option_id) REFERENCES public.complex_payment_option(id);


--
-- Name: package_session_enroll_invite_payment_plan_to_referral_option fk_payment_plan; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_enroll_invite_payment_plan_to_referral_option
    ADD CONSTRAINT fk_payment_plan FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plan(id);


--
-- Name: option fk_question_slide; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option
    ADD CONSTRAINT fk_question_slide FOREIGN KEY (question_id) REFERENCES public.question_slide(id) ON DELETE SET NULL;


--
-- Name: question_slide fk_question_slide_explanation_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_slide
    ADD CONSTRAINT fk_question_slide_explanation_text_id FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: question_slide fk_question_slide_parent_rich_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_slide
    ADD CONSTRAINT fk_question_slide_parent_rich_text_id FOREIGN KEY (parent_rich_text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: question_slide fk_question_slide_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_slide
    ADD CONSTRAINT fk_question_slide_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: quiz_slide fk_quiz_desc_rich_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide
    ADD CONSTRAINT fk_quiz_desc_rich_text_id FOREIGN KEY (description) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: rating_action fk_rating; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rating_action
    ADD CONSTRAINT fk_rating FOREIGN KEY (rating_id) REFERENCES public.rating(id);


--
-- Name: referral_benefit_logs fk_referral_benefit_logs_referral_mapping; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_benefit_logs
    ADD CONSTRAINT fk_referral_benefit_logs_referral_mapping FOREIGN KEY (referral_mapping_id) REFERENCES public.referral_mapping(id);


--
-- Name: referral_benefit_logs fk_referral_benefit_logs_user_plan; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_benefit_logs
    ADD CONSTRAINT fk_referral_benefit_logs_user_plan FOREIGN KEY (user_plan_id) REFERENCES public.user_plan(id);


--
-- Name: referral_mapping fk_referral_mapping_referral_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_mapping
    ADD CONSTRAINT fk_referral_mapping_referral_option FOREIGN KEY (referral_option_id) REFERENCES public.referral_option(id);


--
-- Name: referral_mapping fk_referral_mapping_user_plan; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_mapping
    ADD CONSTRAINT fk_referral_mapping_user_plan FOREIGN KEY (user_plan_id) REFERENCES public.user_plan(id);


--
-- Name: package_session_enroll_invite_payment_plan_to_referral_option fk_referral_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_enroll_invite_payment_plan_to_referral_option
    ADD CONSTRAINT fk_referral_option FOREIGN KEY (referral_option_id) REFERENCES public.referral_option(id);


--
-- Name: schedule_notifications fk_schedule_notifications; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_notifications
    ADD CONSTRAINT fk_schedule_notifications FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE;


--
-- Name: faculty_session_institute_group fk_session_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_session_institute_group
    ADD CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES public.package_session(id);


--
-- Name: student_session_institute_group_mapping fk_session_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT fk_session_id FOREIGN KEY (package_session_id) REFERENCES public.package_session(id);


--
-- Name: session_schedules fk_session_schedule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_schedules
    ADD CONSTRAINT fk_session_schedule FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE;


--
-- Name: student_fee_payment fk_sfp_asv; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_payment
    ADD CONSTRAINT fk_sfp_asv FOREIGN KEY (asv_id) REFERENCES public.assigned_fee_value(id);


--
-- Name: student_fee_payment fk_sfp_cpo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_payment
    ADD CONSTRAINT fk_sfp_cpo FOREIGN KEY (cpo_id) REFERENCES public.complex_payment_option(id);


--
-- Name: student_fee_payment fk_sfp_installment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_payment
    ADD CONSTRAINT fk_sfp_installment FOREIGN KEY (i_id) REFERENCES public.aft_installments(id);


--
-- Name: chapter_to_slides fk_slide; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_to_slides
    ADD CONSTRAINT fk_slide FOREIGN KEY (slide_id) REFERENCES public.slide(id) ON DELETE CASCADE;


--
-- Name: student_session_institute_group_mapping fk_student_session_sub_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT fk_student_session_sub_org FOREIGN KEY (sub_org_id) REFERENCES public.institutes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: student_session_institute_group_mapping fk_student_ssigm_user_plan_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_institute_group_mapping
    ADD CONSTRAINT fk_student_ssigm_user_plan_id FOREIGN KEY (user_plan_id) REFERENCES public.user_plan(id);


--
-- Name: student_sub_org fk_student_sub_org_institute; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_sub_org
    ADD CONSTRAINT fk_student_sub_org_institute FOREIGN KEY (sub_org_id) REFERENCES public.institutes(id);


--
-- Name: student_sub_org fk_student_sub_org_student; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_sub_org
    ADD CONSTRAINT fk_student_sub_org_student FOREIGN KEY (student_id) REFERENCES public.student(id);


--
-- Name: subject_chapter_module_and_package_session_mapping fk_subject; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_chapter_module_and_package_session_mapping
    ADD CONSTRAINT fk_subject FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: subject_module_mapping fk_subject; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_module_mapping
    ADD CONSTRAINT fk_subject FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: subject_session fk_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_session
    ADD CONSTRAINT fk_subject_id FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: system_files fk_system_files_institute; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_files
    ADD CONSTRAINT fk_system_files_institute FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;


--
-- Name: task_execution_audit fk_task_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_execution_audit
    ADD CONSTRAINT fk_task_id FOREIGN KEY (task_id) REFERENCES public.scheduler_activity_log(id);


--
-- Name: faculty_subject_package_session_mapping fk_teacher_mapping_package_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_subject_package_session_mapping
    ADD CONSTRAINT fk_teacher_mapping_package_session FOREIGN KEY (package_session_id) REFERENCES public.package_session(id);


--
-- Name: faculty_subject_package_session_mapping fk_teacher_mapping_subject; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_subject_package_session_mapping
    ADD CONSTRAINT fk_teacher_mapping_subject FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: teacher_planning_logs fk_teacher_planning_logs_institute; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_planning_logs
    ADD CONSTRAINT fk_teacher_planning_logs_institute FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE;


--
-- Name: assignment_slide fk_text_data; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_slide
    ADD CONSTRAINT fk_text_data FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id) ON DELETE SET NULL;


--
-- Name: quiz_slide_question fk_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question
    ADD CONSTRAINT fk_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id);


--
-- Name: video_slide_question fk_text_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question
    ADD CONSTRAINT fk_text_id FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id);


--
-- Name: user_plan fk_user_plan_enroll_invite; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_plan
    ADD CONSTRAINT fk_user_plan_enroll_invite FOREIGN KEY (enroll_invite_id) REFERENCES public.enroll_invite(id);


--
-- Name: user_plan fk_user_plan_payment_option; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_plan
    ADD CONSTRAINT fk_user_plan_payment_option FOREIGN KEY (payment_option_id) REFERENCES public.payment_option(id);


--
-- Name: user_tags fk_user_tags_tag_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT fk_user_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.tags(id);


--
-- Name: workflow_execution_log fk_workflow_execution_log_execution; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution_log
    ADD CONSTRAINT fk_workflow_execution_log_execution FOREIGN KEY (workflow_execution_id) REFERENCES public.workflow_execution(id) ON DELETE CASCADE;


--
-- Name: workflow_execution_log fk_workflow_execution_log_node_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution_log
    ADD CONSTRAINT fk_workflow_execution_log_node_template FOREIGN KEY (node_template_id) REFERENCES public.node_template(id) ON DELETE CASCADE;


--
-- Name: workflow_execution fk_workflow_execution_schedule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution
    ADD CONSTRAINT fk_workflow_execution_schedule FOREIGN KEY (workflow_schedule_id) REFERENCES public.workflow_schedule(id) ON DELETE SET NULL;


--
-- Name: workflow_execution fk_workflow_execution_trigger; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution
    ADD CONSTRAINT fk_workflow_execution_trigger FOREIGN KEY (workflow_trigger_id) REFERENCES public.workflow_trigger(id);


--
-- Name: workflow_execution fk_workflow_execution_workflow; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution
    ADD CONSTRAINT fk_workflow_execution_workflow FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE;


--
-- Name: hr_approval_action hr_approval_action_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_approval_action
    ADD CONSTRAINT hr_approval_action_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.hr_approval_request(id);


--
-- Name: hr_attendance_record hr_attendance_record_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_record
    ADD CONSTRAINT hr_attendance_record_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_attendance_record hr_attendance_record_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_record
    ADD CONSTRAINT hr_attendance_record_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.hr_shift(id);


--
-- Name: hr_attendance_regularization hr_attendance_regularization_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_regularization
    ADD CONSTRAINT hr_attendance_regularization_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.hr_attendance_record(id);


--
-- Name: hr_attendance_regularization hr_attendance_regularization_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_attendance_regularization
    ADD CONSTRAINT hr_attendance_regularization_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_bank_export_log hr_bank_export_log_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_bank_export_log
    ADD CONSTRAINT hr_bank_export_log_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.hr_payroll_run(id);


--
-- Name: hr_comp_off hr_comp_off_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_comp_off
    ADD CONSTRAINT hr_comp_off_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_comp_off hr_comp_off_used_leave_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_comp_off
    ADD CONSTRAINT hr_comp_off_used_leave_application_id_fkey FOREIGN KEY (used_leave_application_id) REFERENCES public.hr_leave_application(id);


--
-- Name: hr_department hr_department_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_department
    ADD CONSTRAINT hr_department_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.hr_department(id);


--
-- Name: hr_employee_bank_detail hr_employee_bank_detail_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_bank_detail
    ADD CONSTRAINT hr_employee_bank_detail_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_employee_document hr_employee_document_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_document
    ADD CONSTRAINT hr_employee_document_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_employee_loan hr_employee_loan_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_loan
    ADD CONSTRAINT hr_employee_loan_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_employee_profile hr_employee_profile_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profile
    ADD CONSTRAINT hr_employee_profile_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.hr_department(id);


--
-- Name: hr_employee_profile hr_employee_profile_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profile
    ADD CONSTRAINT hr_employee_profile_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.hr_designation(id);


--
-- Name: hr_employee_profile hr_employee_profile_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_profile
    ADD CONSTRAINT hr_employee_profile_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_employee_salary_component hr_employee_salary_component_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_salary_component
    ADD CONSTRAINT hr_employee_salary_component_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.hr_salary_component(id);


--
-- Name: hr_employee_salary_component hr_employee_salary_component_salary_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_salary_component
    ADD CONSTRAINT hr_employee_salary_component_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES public.hr_employee_salary_structure(id) ON DELETE CASCADE;


--
-- Name: hr_employee_salary_structure hr_employee_salary_structure_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_salary_structure
    ADD CONSTRAINT hr_employee_salary_structure_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_employee_salary_structure hr_employee_salary_structure_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_salary_structure
    ADD CONSTRAINT hr_employee_salary_structure_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.hr_salary_template(id);


--
-- Name: hr_employee_shift_mapping hr_employee_shift_mapping_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_shift_mapping
    ADD CONSTRAINT hr_employee_shift_mapping_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_employee_shift_mapping hr_employee_shift_mapping_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_shift_mapping
    ADD CONSTRAINT hr_employee_shift_mapping_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.hr_shift(id);


--
-- Name: hr_leave_application hr_leave_application_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_application
    ADD CONSTRAINT hr_leave_application_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_leave_application hr_leave_application_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_application
    ADD CONSTRAINT hr_leave_application_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.hr_leave_type(id);


--
-- Name: hr_leave_balance hr_leave_balance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_balance
    ADD CONSTRAINT hr_leave_balance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_leave_balance hr_leave_balance_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_balance
    ADD CONSTRAINT hr_leave_balance_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.hr_leave_type(id);


--
-- Name: hr_leave_policy hr_leave_policy_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_policy
    ADD CONSTRAINT hr_leave_policy_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.hr_leave_type(id);


--
-- Name: hr_loan_repayment hr_loan_repayment_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_loan_repayment
    ADD CONSTRAINT hr_loan_repayment_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.hr_employee_loan(id);


--
-- Name: hr_loan_repayment hr_loan_repayment_payroll_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_loan_repayment
    ADD CONSTRAINT hr_loan_repayment_payroll_entry_id_fkey FOREIGN KEY (payroll_entry_id) REFERENCES public.hr_payroll_entry(id);


--
-- Name: hr_payroll_entry hr_payroll_entry_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry
    ADD CONSTRAINT hr_payroll_entry_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.hr_employee_bank_detail(id);


--
-- Name: hr_payroll_entry_component hr_payroll_entry_component_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry_component
    ADD CONSTRAINT hr_payroll_entry_component_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.hr_salary_component(id);


--
-- Name: hr_payroll_entry_component hr_payroll_entry_component_payroll_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry_component
    ADD CONSTRAINT hr_payroll_entry_component_payroll_entry_id_fkey FOREIGN KEY (payroll_entry_id) REFERENCES public.hr_payroll_entry(id) ON DELETE CASCADE;


--
-- Name: hr_payroll_entry hr_payroll_entry_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry
    ADD CONSTRAINT hr_payroll_entry_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_payroll_entry hr_payroll_entry_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry
    ADD CONSTRAINT hr_payroll_entry_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.hr_payroll_run(id);


--
-- Name: hr_payroll_entry hr_payroll_entry_salary_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payroll_entry
    ADD CONSTRAINT hr_payroll_entry_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES public.hr_employee_salary_structure(id);


--
-- Name: hr_payslip hr_payslip_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payslip
    ADD CONSTRAINT hr_payslip_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_payslip hr_payslip_payroll_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_payslip
    ADD CONSTRAINT hr_payslip_payroll_entry_id_fkey FOREIGN KEY (payroll_entry_id) REFERENCES public.hr_payroll_entry(id);


--
-- Name: hr_reimbursement hr_reimbursement_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_reimbursement
    ADD CONSTRAINT hr_reimbursement_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_reimbursement hr_reimbursement_payroll_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_reimbursement
    ADD CONSTRAINT hr_reimbursement_payroll_entry_id_fkey FOREIGN KEY (payroll_entry_id) REFERENCES public.hr_payroll_entry(id);


--
-- Name: hr_salary_revision hr_salary_revision_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_revision
    ADD CONSTRAINT hr_salary_revision_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_salary_revision hr_salary_revision_new_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_revision
    ADD CONSTRAINT hr_salary_revision_new_structure_id_fkey FOREIGN KEY (new_structure_id) REFERENCES public.hr_employee_salary_structure(id);


--
-- Name: hr_salary_revision hr_salary_revision_old_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_revision
    ADD CONSTRAINT hr_salary_revision_old_structure_id_fkey FOREIGN KEY (old_structure_id) REFERENCES public.hr_employee_salary_structure(id);


--
-- Name: hr_salary_template_component hr_salary_template_component_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_template_component
    ADD CONSTRAINT hr_salary_template_component_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.hr_salary_component(id);


--
-- Name: hr_salary_template_component hr_salary_template_component_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_salary_template_component
    ADD CONSTRAINT hr_salary_template_component_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.hr_salary_template(id) ON DELETE CASCADE;


--
-- Name: hr_tax_computation hr_tax_computation_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tax_computation
    ADD CONSTRAINT hr_tax_computation_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: hr_tax_declaration hr_tax_declaration_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tax_declaration
    ADD CONSTRAINT hr_tax_declaration_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employee_profile(id);


--
-- Name: invoice_line_item invoice_line_item_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_item
    ADD CONSTRAINT invoice_line_item_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE CASCADE;


--
-- Name: invoice_payment_log_mapping invoice_payment_log_mapping_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payment_log_mapping
    ADD CONSTRAINT invoice_payment_log_mapping_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE CASCADE;


--
-- Name: invoice_payment_log_mapping invoice_payment_log_mapping_payment_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payment_log_mapping
    ADD CONSTRAINT invoice_payment_log_mapping_payment_log_id_fkey FOREIGN KEY (payment_log_id) REFERENCES public.payment_log(id) ON DELETE CASCADE;


--
-- Name: learner_invitation_custom_field_response learner_invitation_custom_fie_learner_invitation_response__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation_custom_field_response
    ADD CONSTRAINT learner_invitation_custom_fie_learner_invitation_response__fkey FOREIGN KEY (learner_invitation_response_id) REFERENCES public.learner_invitation_response(id) ON DELETE CASCADE;


--
-- Name: learner_invitation_custom_field learner_invitation_custom_field_learner_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation_custom_field
    ADD CONSTRAINT learner_invitation_custom_field_learner_invitation_id_fkey FOREIGN KEY (learner_invitation_id) REFERENCES public.learner_invitation(id) ON DELETE CASCADE;


--
-- Name: learner_invitation_custom_field_response learner_invitation_custom_field_response_custom_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation_custom_field_response
    ADD CONSTRAINT learner_invitation_custom_field_response_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.learner_invitation_custom_field(id) ON DELETE CASCADE;


--
-- Name: learner_invitation_response learner_invitation_response_learner_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_invitation_response
    ADD CONSTRAINT learner_invitation_response_learner_invitation_id_fkey FOREIGN KEY (learner_invitation_id) REFERENCES public.learner_invitation(id) ON DELETE CASCADE;


--
-- Name: node_execution node_execution_node_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_execution
    ADD CONSTRAINT node_execution_node_link_id_fkey FOREIGN KEY (node_link_id) REFERENCES public.workflow_node_mapping(id) ON DELETE CASCADE;


--
-- Name: node_execution node_execution_node_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_execution
    ADD CONSTRAINT node_execution_node_template_id_fkey FOREIGN KEY (node_template_id) REFERENCES public.node_template(id);


--
-- Name: node_execution node_execution_workflow_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_execution
    ADD CONSTRAINT node_execution_workflow_execution_id_fkey FOREIGN KEY (workflow_execution_id) REFERENCES public.workflow_execution(id) ON DELETE CASCADE;


--
-- Name: option option_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option
    ADD CONSTRAINT option_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_slide(id) ON DELETE CASCADE;


--
-- Name: package_group_mapping package_group_mapping_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_group_mapping
    ADD CONSTRAINT package_group_mapping_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: package_group_mapping package_group_mapping_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_group_mapping
    ADD CONSTRAINT package_group_mapping_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.package(id);


--
-- Name: package_institute package_institute_institutes_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_institute
    ADD CONSTRAINT package_institute_institutes_fk FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: package_session_learner_invitation_to_payment_option package_session_learner_invitation_to_p_package_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_learner_invitation_to_payment_option
    ADD CONSTRAINT package_session_learner_invitation_to_p_package_session_id_fkey FOREIGN KEY (package_session_id) REFERENCES public.package_session(id);


--
-- Name: package_session_learner_invitation_to_payment_option package_session_learner_invitation_to_pay_enroll_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session_learner_invitation_to_payment_option
    ADD CONSTRAINT package_session_learner_invitation_to_pay_enroll_invite_id_fkey FOREIGN KEY (enroll_invite_id) REFERENCES public.enroll_invite(id);


--
-- Name: package_session package_session_session_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session
    ADD CONSTRAINT package_session_session_fk FOREIGN KEY (session_id) REFERENCES public.session(id);


--
-- Name: payment_log_line_item payment_log_line_item_payment_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_log_line_item
    ADD CONSTRAINT payment_log_line_item_payment_log_id_fkey FOREIGN KEY (payment_log_id) REFERENCES public.payment_log(id);


--
-- Name: payment_log payment_log_user_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_log
    ADD CONSTRAINT payment_log_user_plan_id_fkey FOREIGN KEY (user_plan_id) REFERENCES public.user_plan(id);


--
-- Name: payment_plan payment_plan_payment_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plan
    ADD CONSTRAINT payment_plan_payment_option_id_fkey FOREIGN KEY (payment_option_id) REFERENCES public.payment_option(id) ON DELETE CASCADE;


--
-- Name: platform_invoice_line_item platform_invoice_line_item_platform_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invoice_line_item
    ADD CONSTRAINT platform_invoice_line_item_platform_invoice_id_fkey FOREIGN KEY (platform_invoice_id) REFERENCES public.platform_invoice(id) ON DELETE CASCADE;


--
-- Name: platform_invoice platform_invoice_platform_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invoice
    ADD CONSTRAINT platform_invoice_platform_payment_id_fkey FOREIGN KEY (platform_payment_id) REFERENCES public.platform_payment(id);


--
-- Name: platform_payment_item platform_payment_item_pack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_payment_item
    ADD CONSTRAINT platform_payment_item_pack_id_fkey FOREIGN KEY (pack_id) REFERENCES public.credit_pack(id);


--
-- Name: platform_payment_item platform_payment_item_platform_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_payment_item
    ADD CONSTRAINT platform_payment_item_platform_payment_id_fkey FOREIGN KEY (platform_payment_id) REFERENCES public.platform_payment(id) ON DELETE CASCADE;


--
-- Name: product_page product_page_institute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_page
    ADD CONSTRAINT product_page_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: product_page_invite_mapping product_page_invite_mapping_product_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_page_invite_mapping
    ADD CONSTRAINT product_page_invite_mapping_product_page_id_fkey FOREIGN KEY (product_page_id) REFERENCES public.product_page(id);


--
-- Name: product_page_invite_mapping product_page_invite_mapping_ps_invite_payment_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_page_invite_mapping
    ADD CONSTRAINT product_page_invite_mapping_ps_invite_payment_option_id_fkey FOREIGN KEY (ps_invite_payment_option_id) REFERENCES public.package_session_learner_invitation_to_payment_option(id);


--
-- Name: quiz_slide_question_options quiz_slide_question_options_explanation_text_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question_options
    ADD CONSTRAINT quiz_slide_question_options_explanation_text_id_fkey FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id);


--
-- Name: quiz_slide_question_options quiz_slide_question_options_quiz_slide_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question_options
    ADD CONSTRAINT quiz_slide_question_options_quiz_slide_question_id_fkey FOREIGN KEY (quiz_slide_question_id) REFERENCES public.quiz_slide_question(id);


--
-- Name: quiz_slide_question_options quiz_slide_question_options_text_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question_options
    ADD CONSTRAINT quiz_slide_question_options_text_id_fkey FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id);


--
-- Name: quiz_slide_question quiz_slide_question_quiz_slide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_slide_question
    ADD CONSTRAINT quiz_slide_question_quiz_slide_id_fkey FOREIGN KEY (quiz_slide_id) REFERENCES public.quiz_slide(id);


--
-- Name: session_guest_registrations session_guest_registrations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_guest_registrations
    ADD CONSTRAINT session_guest_registrations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_session(id) ON DELETE CASCADE;


--
-- Name: package_session session_package_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_session
    ADD CONSTRAINT session_package_fk FOREIGN KEY (package_id) REFERENCES public.package(id);


--
-- Name: staff staff_institute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: student_fee_adjustment_history student_fee_adjustment_history_previous_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustment_history
    ADD CONSTRAINT student_fee_adjustment_history_previous_event_id_fkey FOREIGN KEY (previous_event_id) REFERENCES public.student_fee_adjustment_history(id);


--
-- Name: student_fee_adjustment_history student_fee_adjustment_history_student_fee_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustment_history
    ADD CONSTRAINT student_fee_adjustment_history_student_fee_payment_id_fkey FOREIGN KEY (student_fee_payment_id) REFERENCES public.student_fee_payment(id);


--
-- Name: student_fee_payment student_fee_payment_current_adjustment_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_payment
    ADD CONSTRAINT student_fee_payment_current_adjustment_history_id_fkey FOREIGN KEY (current_adjustment_history_id) REFERENCES public.student_fee_adjustment_history(id);


--
-- Name: studio_avatar studio_avatar_institute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_avatar
    ADD CONSTRAINT studio_avatar_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id);


--
-- Name: user_plan user_plan_applied_coupon_discount_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_plan
    ADD CONSTRAINT user_plan_applied_coupon_discount_id_fkey FOREIGN KEY (applied_coupon_discount_id) REFERENCES public.applied_coupon_discount(id);


--
-- Name: video_slide_question_options video_slide_question_options_explanation_text_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question_options
    ADD CONSTRAINT video_slide_question_options_explanation_text_id_fkey FOREIGN KEY (explanation_text_id) REFERENCES public.rich_text_data(id);


--
-- Name: video_slide_question_options video_slide_question_options_text_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question_options
    ADD CONSTRAINT video_slide_question_options_text_id_fkey FOREIGN KEY (text_id) REFERENCES public.rich_text_data(id);


--
-- Name: video_slide_question_options video_slide_question_options_video_slide_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question_options
    ADD CONSTRAINT video_slide_question_options_video_slide_question_id_fkey FOREIGN KEY (video_slide_question_id) REFERENCES public.video_slide_question(id);


--
-- Name: video_slide_question video_slide_question_video_slide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_slide_question
    ADD CONSTRAINT video_slide_question_video_slide_id_fkey FOREIGN KEY (video_slide_id) REFERENCES public.video(id);


--
-- Name: video_tracked video_tracked_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_tracked
    ADD CONSTRAINT video_tracked_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity_log(id);


--
-- Name: workflow_execution_state workflow_execution_state_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_execution_state
    ADD CONSTRAINT workflow_execution_state_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workflow_execution(id) ON DELETE CASCADE;


--
-- Name: workflow_node_mapping workflow_node_mapping_node_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_node_mapping
    ADD CONSTRAINT workflow_node_mapping_node_template_id_fkey FOREIGN KEY (node_template_id) REFERENCES public.node_template(id);


--
-- Name: workflow_node_mapping workflow_node_mapping_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_node_mapping
    ADD CONSTRAINT workflow_node_mapping_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE;


--
-- Name: workflow_schedule_run workflow_schedule_run_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedule_run
    ADD CONSTRAINT workflow_schedule_run_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedule(id) ON DELETE CASCADE;


--
-- Name: workflow_schedule_run workflow_schedule_run_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedule_run
    ADD CONSTRAINT workflow_schedule_run_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE;


--
-- Name: workflow_schedule workflow_schedule_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedule
    ADD CONSTRAINT workflow_schedule_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE;


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
1	1	<< Flyway Baseline >>	BASELINE	<< Flyway Baseline >>	\N	postgres	2025-08-21 11:05:20.058833	0	t
2	3	Create tag system	SQL	V3__Create_tag_system.sql	1625983821	postgres	2025-08-29 22:08:21.768889	1277	t
50	50	Add institute id to teacher planning logs	SQL	V50__Add_institute_id_to_teacher_planning_logs.sql	1699651116	postgres	2025-11-24 18:43:11.47698	212	t
4	5	Create routing updates	SQL	V5__Create_routing_updates.sql	1860494182	postgres	2025-09-09 05:50:18.285841	484	t
5	4	Create referrals	SQL	V4__Create_referrals.sql	-1091221131	postgres	2025-09-09 06:53:36.113033	708	t
6	6	Add auth flags to domain routing	SQL	V6__Add_auth_flags_to_domain_routing.sql	210567591	postgres	2025-09-09 08:51:24.719295	509	t
7	7	Add column status Custom Fields	SQL	V7__Add_column_status_Custom_Fields.sql	153618791	postgres	2025-09-11 12:00:23.811918	749	t
8	8	Alter referral option add setting	SQL	V8__Alter_referral_option_add_setting.sql	1765393778	postgres	2025-09-12 12:53:33.239341	335	t
9	9	Create Templates Table	SQL	V9__Create_Templates_Table.sql	1827343330	postgres	2025-09-12 17:07:34.896646	1943	t
10	10	Add WhatsApp Parameters Column	SQL	V10__Add_WhatsApp_Parameters_Column.sql	-1691759710	postgres	2025-09-16 11:36:51.389435	180	t
11	11	Add unit column to payment option	SQL	V11__Add_unit_column_to_payment_option.sql	939845828	postgres	2025-09-16 20:07:59.454519	298	t
12	12	alter referral benefit logs	SQL	V12__alter_referral_benefit_logs.sql	820091321	postgres	2025-09-17 12:16:23.76337	144	t
13	13	Add Status And Template Category To Templates	SQL	V13__Add_Status_And_Template_Category_To_Templates.sql	-44768345	postgres	2025-09-19 22:16:48.183652	734	t
14	14	add type fields ssigm	SQL	V14__add_type_fields_ssigm.sql	-950407599	postgres	2025-09-22 18:32:32.093809	235	t
15	15	Add course audit logs to package	SQL	V15__Add_course_audit_logs_to_package.sql	-194402080	postgres	2025-09-22 20:01:32.717581	131	t
16	16	Add is bundled column	SQL	V16__Add_is_bundled_column.sql	-1868600261	postgres	2025-09-23 11:48:20.052933	133	t
17	17	Create notification event config	SQL	V17__Create_notification_event_config.sql	802629352	postgres	2025-09-24 11:45:09.819249	339	t
18	18	Create course catalogue	SQL	V18__Create_course_catalogue.sql	-337330988	postgres	2025-09-29 10:10:42.251369	673	t
19	19	add desired level id to student session institute group mapping	SQL	V19__add_desired_level_id_to_student_session_institute_group_mapping.sql	-784602733	postgres	2025-10-06 15:26:50.896633	135	t
20	20	Add desired Package id	SQL	V20__Add_desired_Package_id.sql	-1464320264	postgres	2025-10-09 15:36:25.801095	143	t
21	21	Add access level in live session	SQL	V21__Add_access_level_in_live_session.sql	-343566503	postgres	2025-10-10 12:13:40.718314	148	t
22	22	Alter cusotm field status	SQL	V22__Alter_cusotm_field_status.sql	-919601927	postgres	2025-10-15 16:24:33.987352	154	t
23	23	add enrollment policy setting	SQL	V23__add_enrollment_policy_setting.sql	-704844273	postgres	2025-10-23 13:59:13.50945	301	t
24	24	Create workflow trigger	SQL	V24__Create_workflow_trigger.sql	306495664	postgres	2025-10-27 16:44:50.461812	655	t
25	25	Alter workflow trigger add created at	SQL	V25__Alter_workflow_trigger_add_created_at.sql	215668669	postgres	2025-10-27 17:28:31.584999	136	t
26	26	Create workflow execution log	SQL	V26__Create_workflow_execution_log.sql	627046820	postgres	2025-10-31 16:25:55.769922	366	t
27	27	Add fk node template to workflow execution log	SQL	V27__Add_fk_node_template_to_workflow_execution_log.sql	-1060101717	postgres	2025-10-31 16:46:04.413846	151	t
28	28	Add col event id in workflow trigger	SQL	V28__Add_col_event_id_in_workflow_trigger.sql	-608450942	postgres	2025-11-01 10:08:28.020695	240	t
29	29	Alter institute custom field set status active	SQL	V29__Alter_institute_custom_field_set_status_active.sql	1358897172	postgres	2025-11-03 14:07:56.010899	143	t
30	30	Refactor workflow execution	SQL	V30__Refactor_workflow_execution.sql	-139956004	postgres	2025-11-06 11:59:27.112308	767	t
31	31	Create audience table	SQL	V31__Create_audience_table.sql	877673566	postgres	2025-11-06 14:46:22.8005	546	t
32	32	Create audience response table	SQL	V32__Create_audience_response_table.sql	-393376015	postgres	2025-11-06 14:54:52.868928	561	t
33	33	announcment constraints	SQL	V33__announcment_constraints.sql	1633766073	postgres	2025-11-10 16:14:03.228291	138	t
34	34	Add sub org detail in ssigm	SQL	V34__Add_sub_org_detail_in_ssigm.sql	-1797114593	postgres	2025-11-11 14:05:31.903777	390	t
35	35	Add is org associated	SQL	V35__Add_is_org_associated.sql	-67292113	postgres	2025-11-11 14:08:48.905504	182	t
36	36	Add idempotency key to schedule notifications	SQL	V36__Add_idempotency_key_to_schedule_notifications.sql	23506051	postgres	2025-11-13 11:51:06.337165	177	t
37	37	Add domain routing routes	SQL	V37__Add_domain_routing_routes.sql	929785181	postgres	2025-11-13 20:50:13.261319	174	t
38	38	Add notification fields to audience	SQL	V38__Add_notification_fields_to_audience.sql	235933433	postgres	2025-11-14 13:38:11.566359	224	t
39	39	Set is org default	SQL	V39__Set_is_org_default.sql	1500768274	postgres	2025-11-15 10:21:31.897367	150	t
40	40	Add timestamps to custom field values	SQL	V40__Add_timestamps_to_custom_field_values.sql	-418064175	postgres	2025-11-15 11:15:23.391705	130	t
41	41	Create system files and entity access tables	SQL	V41__Create_system_files_and_entity_access_tables.sql	-383619627	postgres	2025-11-19 13:20:47.298049	903	t
42	42	Update system files constraints	SQL	V42__Update_system_files_constraints.sql	545495236	postgres	2025-11-19 16:05:30.998691	285	t
43	43	Set default custom field status active	SQL	V43__Set_default_custom_field_status_active.sql	1157318654	postgres	2025-11-20 14:52:41.363262	406	t
44	44	set default status custom fields	SQL	V44__set_default_status_custom_fields.sql	1501598662	postgres	2025-11-20 15:04:08.773426	232	t
45	45	drop lowercase trigger	SQL	V45__drop_lowercase_trigger.sql	1314641918	postgres	2025-11-21 16:37:45.520353	381	t
46	46	Drop lowercase level session package	SQL	V46__Drop_lowercase_level_session_package.sql	385921053	postgres	2025-11-21 17:14:03.391398	238	t
47	47	Add description to system files	SQL	V47__Add_description_to_system_files.sql	680101336	postgres	2025-11-22 06:37:29.941668	80	t
48	48	Add suborg detail in user plan	SQL	V48__Add_suborg_detail_in_user_plan.sql	-1075100552	postgres	2025-11-24 15:13:59.842728	506	t
49	49	Create teacher planning logs	SQL	V49__Create_teacher_planning_logs.sql	1417993080	postgres	2025-11-24 18:28:58.473493	669	t
51	51	Add start end date to user plan	SQL	V51__Add_start_end_date_to_user_plan.sql	-1801668820	postgres	2025-11-28 13:27:50.896847	496	t
52	52	Add is shared with student to teacher planning logs	SQL	V52__Add_is_shared_with_student_to_teacher_planning_logs.sql	-395511673	postgres	2025-12-02 17:18:49.922404	142	t
53	53	Add package type to package	SQL	V53__Add_package_type_to_package.sql	1633091904	postgres	2025-12-06 10:37:15.060422	316	t
54	54	Add content drip columns	SQL	V54__Add_content_drip_columns.sql	1354126394	postgres	2025-12-10 23:28:18.71081	185	t
55	55	Create keap migration staging tables	SQL	V55__Create_keap_migration_staging_tables.sql	590586451	postgres	2025-12-13 11:57:04.743078	274	t
56	56	Alter keap staging tables	SQL	V56__Alter_keap_staging_tables.sql	-52906916	postgres	2025-12-13 11:57:05.461393	226	t
57	57	Create instructor copilot logs	SQL	V57__Create_instructor_copilot_logs.sql	1899511507	postgres	2025-12-13 19:30:18.729459	166	t
58	58	Add package session and subject to instructor copilot logs	SQL	V58__Add_package_session_and_subject_to_instructor_copilot_logs.sql	-943965445	postgres	2025-12-14 16:51:40.77628	34	t
59	59	Add job type to staging users	SQL	V59__Add_job_type_to_staging_users.sql	918207960	postgres	2025-12-15 10:00:58.558701	249	t
60	60	Add practice columns to staging users	SQL	V60__Add_practice_columns_to_staging_users.sql	-1727247483	postgres	2025-12-15 12:39:32.282481	183	t
61	61	Add user plan status to staging users	SQL	V61__Add_user_plan_status_to_staging_users.sql	-1682626979	postgres	2025-12-15 12:39:32.819371	134	t
62	62	Add status and json columns to activity log	SQL	V62__Add_status_and_json_columns_to_activity_log.sql	1151586065	postgres	2025-12-16 17:28:06.000873	179	t
63	63	Add app links to institute domain routing	SQL	V63__Add_app_links_to_institute_domain_routing.sql	-650765563	postgres	2025-12-17 15:45:39.634888	392	t
64	64	Create invoice tables	SQL	V64__Create_invoice_tables.sql	1932958439	postgres	2025-12-17 15:49:51.831915	543	t
65	65	Create ai gen video table	SQL	V65__Create_ai_gen_video_table.sql	-441797657	postgres	2025-12-18 12:24:41.697981	624	t
66	66	Create student analysis tables	SQL	V66__Create_student_analysis_tables.sql	-928157040	postgres	2025-12-18 14:41:31.775834	1111	t
67	67	Add course setting	SQL	V67__Add_course_setting.sql	-1257744647	postgres	2025-12-20 15:31:17.808975	282	t
68	68	Add member count to payment plan	SQL	V68__Add_member_count_to_payment_plan.sql	-1507505857	postgres	2025-12-26 18:25:15.983025	173	t
69	69	Create form webhook connector	SQL	V69__Create_form_webhook_connector.sql	2043673736	postgres	2025-12-29 12:38:02.461519	447	t
70	70	Create ai api keys table	SQL	V70__Create_ai_api_keys_table.sql	-152502419	postgres	2026-01-02 01:08:47.636016	913	t
71	71	Create ai token usage table	SQL	V71__Create_ai_token_usage_table.sql	-762155556	postgres	2026-01-02 01:08:50.059387	1109	t
72	72	Add idempotency generation setting to workflow trigger	SQL	V72__Add_idempotency_generation_setting_to_workflow_trigger.sql	1887359291	postgres	2026-01-02 09:13:36.799065	2050	t
73	73	Add workflow type and idempotency support	SQL	V73__Add_workflow_type_and_idempotency_support.sql	14505441	postgres	2026-01-02 09:27:31.643999	551	t
74	75	expand student varchar 20 to 50	SQL	V75__expand_student_varchar_20_to_50.sql	559375335	postgres	2026-01-02 09:56:59.779003	386	t
75	76	Create html video slide table	SQL	V76__Create_html_video_slide_table.sql	888045383	postgres	2026-01-06 16:03:26.800438	218	t
76	77	Create scorm tables	SQL	V77__Create_scorm_tables.sql	1496474271	postgres	2026-01-06 16:03:27.545986	282	t
77	78	Create chat agent tables	SQL	V78__Create_chat_agent_tables.sql	1560424366	postgres	2026-01-08 15:05:56.589504	1553	t
78	79	Fix chat messages id type	SQL	V79__Fix_chat_messages_id_type.sql	-409904155	postgres	2026-01-08 16:49:20.542393	1099	t
79	80	Add pricing columns to ai token usage	SQL	V80__Add_pricing_columns_to_ai_token_usage.sql	-341531304	postgres	2026-01-09 01:11:04.120108	274	t
80	81	Add available slots to package session	SQL	V81__Add_available_slots_to_package_session.sql	-1878688828	postgres	2026-01-09 18:50:08.131458	201	t
81	82	Make available slots nullable	SQL	V82__Make_available_slots_nullable.sql	460111980	postgres	2026-01-10 14:11:07.61063	134	t
82	83	Add convert username password to lowercase to domain routing	SQL	V83__Add_convert_username_password_to_lowercase_to_domain_routing.sql	-2107334114	postgres	2026-01-13 15:27:10.318387	140	t
83	84	Add package name search index	SQL	V84__Add_package_name_search_index.sql	835108171	postgres	2026-01-13 16:39:37.86727	122	t
84	85	Add session id to audience and fields to response	SQL	V85__Add_session_id_to_audience_and_fields_to_response.sql	814756771	postgres	2026-01-14 16:20:12.114842	740	t
85	86	Add live session performance indexes	SQL	V86__Add_live_session_performance_indexes.sql	-1586652341	postgres	2026-01-14 19:12:10.434647	363	t
86	87	Add setting json to audience	SQL	V87__Add_setting_json_to_audience.sql	1852821224	postgres	2026-01-15 12:59:06.229821	142	t
87	88	audio slide migration	SQL	V88__audio_slide_migration.sql	-145522821	postgres	2026-01-16 22:13:03.495681	492	t
88	89	Create booking system tables	SQL	V89__Create_booking_system_tables.sql	11122582	postgres	2026-01-19 15:37:17.421946	490	t
89	90	Enhance package session inventory	SQL	V90__Enhance_package_session_inventory.sql	-1151785715	postgres	2026-01-20 18:10:42.87438	253	t
90	91	Add school specific fields to institutes	SQL	V91__Add_school_specific_fields_to_institutes.sql	-304593700	postgres	2026-01-22 12:11:37.305868	412	t
91	92	Add paginated batches performance indexes	SQL	V92__Add_paginated_batches_performance_indexes.sql	-229995195	postgres	2026-01-22 12:12:51.984513	192	t
92	93	Add code editor config to html video slide	SQL	V93__Add_code_editor_config_to_html_video_slide.sql	2075679649	postgres	2026-01-22 23:04:34.111125	148	t
93	94	system field custom field mapping	SQL	V94__system_field_custom_field_mapping.sql	-1285650646	postgres	2026-01-24 13:45:08.344665	455	t
94	95	Create applicant and stage tables	SQL	V95__Create_applicant_and_stage_tables.sql	-1640761182	postgres	2026-01-27 10:23:26.658107	847	t
95	96	Add extra student details	SQL	V96__Add_extra_student_details.sql	-1184017664	postgres	2026-01-29 10:55:45.758764	138	t
96	97	Add tracking fields to payment log	SQL	V97__Add_tracking_fields_to_payment_log.sql	1353942215	postgres	2026-01-30 17:36:14.266577	282	t
97	98	Ai video enhancement	SQL	V98__Ai_video_enhancement.sql	544991551	postgres	2026-02-03 08:12:53.61431	237	t
98	99	Add student user id to audience response	SQL	V99__Add_student_user_id_to_audience_response.sql	-1275808970	postgres	2026-02-07 10:46:37.876447	433	t
99	100	Institute credit system	SQL	V100__Institute_credit_system.sql	528907835	akmadmin	2026-02-08 21:31:22.224255	721	t
100	101	AI models registry	SQL	V101__AI_models_registry.sql	-542731892	akmadmin	2026-02-08 21:37:17.905287	573	t
101	102	Expand ai token usage request types	SQL	V102__Expand_ai_token_usage_request_types.sql	-803450634	akmadmin	2026-02-08 21:37:19.107804	287	t
102	103	Add workflow activate day to audience response	SQL	V103__Add_workflow_activate_day_to_audience_response.sql	-705111516	akmadmin	2026-02-09 11:36:12.272052	268	t
103	104	Add status columns to audience response	SQL	V104__Add_status_columns_to_audience_response.sql	1552831072	akmadmin	2026-02-11 11:55:36.009996	212	t
104	105	add short url to invite and referral	SQL	V105__add_short_url_to_invite_and_referral.sql	1962765498	akmadmin	2026-02-12 21:39:02.020626	364	t
105	106	Faculty schema and suborg	SQL	V106__Faculty_schema_and_suborg.sql	-1556265149	akmadmin	2026-02-12 23:58:10.017888	211	t
106	107	add short url to referral mapping	SQL	V107__add_short_url_to_referral_mapping.sql	362741682	akmadmin	2026-02-13 23:57:35.944627	350	t
107	108	add short url to coupon code	SQL	V108__add_short_url_to_coupon_code.sql	-936060800	akmadmin	2026-02-14 00:16:15.705283	313	t
108	109	Fee management schema	SQL	V109__Fee_management_schema.sql	1025795317	akmadmin	2026-02-16 17:37:50.946778	269	t
109	110	Add default link to session schedules	SQL	V110__Add_default_link_to_session_schedules.sql	-1156674662	akmadmin	2026-02-16 21:35:40.784007	251	t
110	111	CPO integration phase 2	SQL	V111__CPO_integration_phase_2.sql	-912514154	akmadmin	2026-02-17 15:58:28.994487	50444	t
111	112	Add default class name to session schedules	SQL	V112__Add_default_class_name_to_session_schedules.sql	277996407	akmadmin	2026-02-18 12:10:39.272735	132	t
112	113	Add admission fields to student	SQL	V113__Add_admission_fields_to_student.sql	761333202	akmadmin	2026-02-18 18:36:13.120221	122	t
113	114	Move default button to live session	SQL	V114__Move_default_button_to_live_session.sql	-1361872409	akmadmin	2026-02-18 23:02:21.924657	269	t
114	115	create learner button	SQL	V115__create_learner_button.sql	-576574898	akmadmin	2026-02-18 23:56:56.944651	241	t
115	116	Add launch url to scorm slide	SQL	V116__Add_launch_url_to_scorm_slide.sql	1076490002	akmadmin	2026-02-19 10:25:48.347018	2033	t
116	117	Add workflow type to stage and applicant	SQL	V117__Add_workflow_type_to_stage_and_applicant.sql	-854906381	akmadmin	2026-02-19 10:52:54.923616	260	t
117	118	Add workflow boundaries	SQL	V118__Add_workflow_boundaries.sql	-2108459601	akmadmin	2026-02-19 12:10:09.916394	198	t
118	119	School fee tracking schema	SQL	V119__School_fee_tracking_schema.sql	1331959427	akmadmin	2026-02-23 16:20:15.855447	422	t
119	120	Add is parent and parent id to package session	SQL	V120__Add_is_parent_and_parent_id_to_package_session.sql	1648975291	akmadmin	2026-02-23 18:16:31.879571	159	t
120	121	add allow phone auth	SQL	V121__add_allow_phone_auth.sql	-833319853	akmadmin	2026-02-26 04:44:47.903709	121	t
121	122	Add updated at to fee allocation ledger	SQL	V122__Add_updated_at_to_fee_allocation_ledger.sql	785549975	akmadmin	2026-02-26 11:40:46.188372	124	t
122	123	Add name to package session	SQL	V123__Add_name_to_package_session.sql	-556086725	akmadmin	2026-02-26 13:49:08.552173	150	t
123	124	Add is skippable and fee type id to student fee payment	SQL	V124__Add_is_skippable_and_fee_type_id_to_student_fee_payment.sql	-783057090	akmadmin	2026-02-28 12:49:37.783107	614	t
124	125	Add live session provider integration	SQL	V125__Add_live_session_provider_integration.sql	-752840352	akmadmin	2026-03-03 15:59:19.456472	454	t
125	126	Add allowCombineOffers field to referral options table	SQL	V126__Add_allowCombineOffers_field_to_referral_options_table.sql	-1006753175	akmadmin	2026-03-06 14:18:09.15417	151	t
126	127	Create timeline event table	SQL	V127__Create_timeline_event_table.sql	76594688	akmadmin	2026-03-07 11:25:18.654343	512	t
127	128	Create hr department and designation tables	SQL	V128__Create_hr_department_and_designation_tables.sql	700609103	akmadmin	2026-03-10 14:01:41.176962	97	t
128	129	Create hr employee profile table	SQL	V129__Create_hr_employee_profile_table.sql	-1432466024	akmadmin	2026-03-10 14:01:41.574766	34	t
129	130	Create hr employee bank and document tables	SQL	V130__Create_hr_employee_bank_and_document_tables.sql	944442396	akmadmin	2026-03-10 14:01:41.663818	44	t
130	131	Create hr attendance config and shift tables	SQL	V131__Create_hr_attendance_config_and_shift_tables.sql	1318011328	akmadmin	2026-03-10 14:01:41.730526	23	t
131	132	Create hr employee shift mapping table	SQL	V132__Create_hr_employee_shift_mapping_table.sql	2013767920	akmadmin	2026-03-10 14:01:41.775535	20	t
132	133	Create hr attendance record table	SQL	V133__Create_hr_attendance_record_table.sql	-708343790	akmadmin	2026-03-10 14:01:41.827242	24	t
133	134	Create hr attendance regularization table	SQL	V134__Create_hr_attendance_regularization_table.sql	-1182387996	akmadmin	2026-03-10 14:01:41.876847	41	t
134	135	Create hr holiday table	SQL	V135__Create_hr_holiday_table.sql	1684181674	akmadmin	2026-03-10 14:01:41.939543	15	t
135	136	Create hr leave type and policy tables	SQL	V136__Create_hr_leave_type_and_policy_tables.sql	-70306954	akmadmin	2026-03-10 14:01:41.983768	39	t
136	137	Create hr leave balance and application tables	SQL	V137__Create_hr_leave_balance_and_application_tables.sql	-1742159405	akmadmin	2026-03-10 14:01:42.072759	39	t
137	138	Create hr comp off table	SQL	V138__Create_hr_comp_off_table.sql	-482451421	akmadmin	2026-03-10 14:01:42.130984	21	t
138	139	Create hr salary component table	SQL	V139__Create_hr_salary_component_table.sql	-1981719798	akmadmin	2026-03-10 14:01:42.17167	46	t
139	140	Create hr salary template tables	SQL	V140__Create_hr_salary_template_tables.sql	-1317623268	akmadmin	2026-03-10 14:01:42.235579	27	t
140	141	Create hr employee salary structure tables	SQL	V141__Create_hr_employee_salary_structure_tables.sql	813870243	akmadmin	2026-03-10 14:01:42.284876	23	t
141	142	Create hr salary revision table	SQL	V142__Create_hr_salary_revision_table.sql	-151094936	akmadmin	2026-03-10 14:01:42.352246	13	t
142	143	Create hr payroll run table	SQL	V143__Create_hr_payroll_run_table.sql	2028236966	akmadmin	2026-03-10 14:01:42.384332	15	t
143	144	Create hr payroll entry tables	SQL	V144__Create_hr_payroll_entry_tables.sql	-1603986438	akmadmin	2026-03-10 14:01:42.441121	38	t
144	145	Create hr loan tables	SQL	V145__Create_hr_loan_tables.sql	-677134955	akmadmin	2026-03-10 14:01:42.517263	21	t
145	146	Create hr reimbursement table	SQL	V146__Create_hr_reimbursement_table.sql	-1291935469	akmadmin	2026-03-10 14:01:42.553179	17	t
146	147	Create hr tax tables	SQL	V147__Create_hr_tax_tables.sql	802930359	akmadmin	2026-03-10 14:01:42.584206	31	t
147	148	Create hr payslip and bank export tables	SQL	V148__Create_hr_payslip_and_bank_export_tables.sql	777664726	akmadmin	2026-03-10 14:01:42.663247	25	t
148	149	Create hr approval tables	SQL	V149__Create_hr_approval_tables.sql	2116482378	akmadmin	2026-03-10 14:01:42.72192	28	t
149	150	Create platform institute	SQL	V150__Create_platform_institute.sql	-1065111847	akmadmin	2026-03-11 17:17:31.325229	13	t
150	151	Add lead tag to institutes	SQL	V151__Add_lead_tag_to_institutes.sql	-440134907	akmadmin	2026-03-12 04:40:49.665838	32	t
151	152	Add discount to afv and audit to cpo	SQL	V152__Add_discount_to_afv_and_audit_to_cpo.sql	1259138424	akmadmin	2026-03-12 14:30:43.864176	176	t
152	153	Create institute fee type priority	SQL	V153__Create_institute_fee_type_priority.sql	-473034873	akmadmin	2026-03-12 15:00:04.591254	174	t
153	154	Create admission pipeline table	SQL	V154__Create_admission_pipeline_table.sql	-1685420806	akmadmin	2026-03-12 18:36:27.86053	273	t
154	155	Add unallocated amount to payment log	SQL	V155__Add_unallocated_amount_to_payment_log.sql	412017398	akmadmin	2026-03-12 19:05:15.206106	161	t
155	156	Add start and end date to aft installments	SQL	V156__Add_start_and_end_date_to_aft_installments.sql	1345288396	akmadmin	2026-03-13 11:54:01.316716	139	t
156	157	Add quiz timing and marks	SQL	V157__Add_quiz_timing_and_marks.sql	1116697820	akmadmin	2026-03-13 13:02:11.31125	160	t
157	158	Fix quiz slide null marks	SQL	V158__Fix_quiz_slide_null_marks.sql	2135332025	akmadmin	2026-03-13 09:18:04.749568	75	t
158	159	Add bbb meeting provider	SQL	V159__Add_bbb_meeting_provider.sql	1006822370	akmadmin	2026-03-14 23:41:16.872453	1715	t
159	160	Add bbb config json to live session	SQL	V160__Add_bbb_config_json_to_live_session.sql	318306159	akmadmin	2026-03-14 18:32:15.957441	59	t
160	161	Add sub org subscription support	SQL	V161__Add_sub_org_subscription_support.sql	1124865450	akmadmin	2026-03-16 09:17:55.583068	268	t
163	164	Add vendor user id to live session provider	SQL	V164__Add_vendor_user_id_to_live_session_provider.sql	-1154694448	akmadmin	2026-03-16 08:30:57.933996	77	t
164	162	Fee reminder no op	SQL	V162__Fee_reminder_no_op.sql	1385091918	akmadmin	2026-03-16 14:04:41.93155	131	t
165	163	Add institute id to student fee payment	SQL	V163__Add_institute_id_to_student_fee_payment.sql	-728560895	akmadmin	2026-03-16 14:04:42.719918	161	t
166	165	Add pass percentage to quiz slide	SQL	V165__Add_pass_percentage_to_quiz_slide.sql	-2139726472	akmadmin	2026-03-17 07:55:26.531728	17	t
167	166	Add re attempt count to quiz slide	SQL	V166__Add_re_attempt_count_to_quiz_slide.sql	291006789	akmadmin	2026-03-17 19:03:00.165346	9	t
168	167	Add learning analytics	SQL	V167__Add_learning_analytics.sql	0	akmadmin	2026-03-18 23:00:16.029449	105	t
169	168	Add pgvector	SQL	V168__Add_pgvector.sql	-1529280354	akmadmin	2026-03-18 23:00:16.590614	271	t
170	169	Added Learning Analytics	SQL	V169__Added_Learning_Analytics.sql	324683759	akmadmin	2026-03-18 23:02:48.623658	219	t
171	170	Add Knowledge Base Items	SQL	V170__Add_Knowledge_Base_Items.sql	-1357083131	akmadmin	2026-03-21 03:12:19.390226	26	t
172	171	Add Session Mode	SQL	V171__Add_Session_Mode.sql	1478089880	akmadmin	2026-03-21 06:56:46.785164	37	t
173	172	Enhance attendance tracking	SQL	V172__Enhance_attendance_tracking.sql	-517658570	akmadmin	2026-03-22 06:03:05.20757	11	t
174	173	Add student relation with parent to enquiry	SQL	V173__Add_student_relation_with_parent_to_enquiry.sql	2011247715	akmadmin	2026-03-24 10:50:49.79507	142	t
175	174	Add parent relation with child to enquiry	SQL	V174__Add_parent_relation_with_child_to_enquiry.sql	-1817197373	akmadmin	2026-03-24 12:05:36.633068	177	t
176	175	Drop student relation with parent from enquiry	SQL	V175__Drop_student_relation_with_parent_from_enquiry.sql	427923863	akmadmin	2026-03-24 13:45:47.445695	157	t
177	176	Add guardian email to student	SQL	V176__Add_guardian_email_to_student.sql	-830772672	akmadmin	2026-03-24 15:31:08.58118	143	t
178	177	Add live class email templates	SQL	V177__Add_live_class_email_templates.sql	-1589214760	akmadmin	2026-03-26 08:59:13.036763	708	t
179	178	Fix dedupe index and add node retry config	SQL	V178__Fix_dedupe_index_and_add_node_retry_config.sql	-748039884	akmadmin	2026-03-26 15:23:23.316283	173	t
180	179	Create workflow template table	SQL	V179__Create_workflow_template_table.sql	-1993620536	akmadmin	2026-03-26 15:23:23.965342	242	t
181	180	Add workflow execution state table	SQL	V180__Add_workflow_execution_state_table.sql	1660211261	akmadmin	2026-03-26 15:23:24.566562	210	t
182	181	Add rate limiting and webhook support	SQL	V181__Add_rate_limiting_and_webhook_support.sql	859259094	akmadmin	2026-03-26 15:23:25.108365	257	t
183	182	enhance notification channels	SQL	V182__enhance_notification_channels.sql	1994562129	akmadmin	2026-03-26 15:23:25.690325	164	t
184	183	add sub org id to domain routing	SQL	V183__add_sub_org_id_to_domain_routing.sql	-1217484605	akmadmin	2026-03-27 14:33:57.831491	129	t
185	184	Add template name to notification event config	SQL	V184__Add_template_name_to_notification_event_config.sql	-645856976	akmadmin	2026-03-28 15:31:55.029951	17	t
186	185	Create audience communication table	SQL	V185__Create_audience_communication_table.sql	-277125504	akmadmin	2026-03-29 14:21:54.567739	53	t
187	186	Add question type and options to assignment slide question	SQL	V186__Add_question_type_and_options_to_assignment_slide_question.sql	812141476	akmadmin	2026-03-31 10:45:46.052755	33	t
188	187	Add assignment grading columns	SQL	V187__Add_assignment_grading_columns.sql	98877503	akmadmin	2026-03-31 10:45:46.421342	10	t
189	188	Fix audience communication id column type	SQL	V188__Fix_audience_communication_id_column_type.sql	-136533306	akmadmin	2026-03-31 21:27:15.213137	151	t
190	189	Credit system improvements	SQL	V189__Credit_system_improvements.sql	1725481699	akmadmin	2026-04-03 00:50:19.865418	113	t
191	190	Update credit pricing scale	SQL	V190__Update_credit_pricing_scale.sql	1027703932	akmadmin	2026-04-03 04:54:13.761405	14	t
192	192	Add bbb server pool	SQL	V192__Add_bbb_server_pool.sql	1597874918	akmadmin	2026-04-05 16:36:37.881828	95	t
193	193	Fix bbb server id type	SQL	V193__Fix_bbb_server_id_type.sql	643286075	akmadmin	2026-04-05 17:51:21.826745	156	t
194	194	Fix bbb pool id type	SQL	V194__Fix_bbb_pool_id_type.sql	882080911	akmadmin	2026-04-05 18:34:14.695427	21	t
195	191	Lead distribution and scoring	SQL	V191__Lead_distribution_and_scoring.sql	1486048942	akmadmin	2026-04-07 13:59:52.35354	470	t
196	195	Create user lead profile	SQL	V195__Create_user_lead_profile.sql	909673988	akmadmin	2026-04-07 13:59:53.30336	224	t
197	196	Create ota bundle version	SQL	V196__Create_ota_bundle_version.sql	-1176660767	akmadmin	2026-04-07 17:01:09.547837	18	t
198	197	add preferred country to domain routing	SQL	V197__add_preferred_country_to_domain_routing.sql	-1414539118	akmadmin	2026-04-10 09:31:22.605643	40	t
199	198	Add student tnc fields	SQL	V198__Add_student_tnc_fields.sql	387404793	akmadmin	2026-04-10 14:13:40.61805	19	t
200	199	add is mandatory to institute custom fields	SQL	V199__add_is_mandatory_to_institute_custom_fields.sql	1601994289	akmadmin	2026-04-13 06:11:12.036699	34	t
201	200	Add counselor to user lead profile	SQL	V200__Add_counselor_to_user_lead_profile.sql	887176549	akmadmin	2026-04-14 09:34:47.964334	46	t
202	201	ad platform integration	SQL	V201__ad_platform_integration.sql	-448301250	akmadmin	2026-04-15 11:03:45.233341	53	t
203	202	oauth state session columns	SQL	V202__oauth_state_session_columns.sql	-1896121319	akmadmin	2026-04-15 11:03:45.728541	7	t
205	204	Rename discount to adjustment add columns	SQL	V204__Rename_discount_to_adjustment_add_columns.sql	-84268292	akmadmin	2026-04-16 17:50:35.561345	290	t
206	203	add default values json to form webhook connector	SQL	V203__add_default_values_json_to_form_webhook_connector.sql	1370163963	akmadmin	2026-04-17 00:49:19.679741	249	t
207	205	fb leads form connectors	SQL	V205__fb_leads_form_connectors.sql	-2079581657	akmadmin	2026-04-17 00:49:20.65485	234	t
208	206	fb leads workflow config	SQL	V206__fb_leads_workflow_config.sql	-1576810110	akmadmin	2026-04-17 01:24:48.950214	271	t
209	207	enrich audience response with center defaults	SQL	V207__enrich_audience_response_with_center_defaults.sql	624088222	akmadmin	2026-04-17 01:45:24.189803	311	t
210	208	switch enrich trigger to immediate	SQL	V208__switch_enrich_trigger_to_immediate.sql	-235917035	akmadmin	2026-04-17 01:51:09.859849	260	t
211	209	Create ai input videos table	SQL	V209__Create_ai_input_videos_table.sql	-433637898	akmadmin	2026-04-17 12:31:21.376832	79	t
212	210	Add event applied type to workflow trigger	SQL	V210__Add_event_applied_type_to_workflow_trigger.sql	335559562	akmadmin	2026-04-18 05:23:37.48539	62	t
213	211	set next run at for fb lead schedules	SQL	V211__set_next_run_at_for_fb_lead_schedules.sql	-116810808	akmadmin	2026-04-19 14:16:34.893306	337	t
214	212	Add student fee adjustment history	SQL	V212__Add_student_fee_adjustment_history.sql	1263057953	akmadmin	2026-04-20 11:08:35.471144	427	t
215	213	Add apply naming setting to institute domain routing	SQL	V213__Add_apply_naming_setting_to_institute_domain_routing.sql	1183517218	akmadmin	2026-04-20 15:25:35.045743	141	t
216	214	Seed Doubt Notification Email Templates	SQL	V214__Seed_Doubt_Notification_Email_Templates.sql	1278147990	akmadmin	2026-04-22 00:08:58.859019	378	t
217	215	Consolidate Doubt Notification Default Templates	SQL	V215__Consolidate_Doubt_Notification_Default_Templates.sql	750515741	akmadmin	2026-04-22 00:50:01.760032	438	t
218	216	Add feedback config to live session	SQL	V216__Add_feedback_config_to_live_session.sql	758775152	akmadmin	2026-04-22 07:38:23.690776	18	t
219	217	Add stock and tts premium to ai token usage request types	SQL	V217__Add_stock_and_tts_premium_to_ai_token_usage_request_types.sql	462605	akmadmin	2026-04-24 05:31:50.667847	86	t
220	218	Create coding submissions	SQL	V218__Create_coding_submissions.sql	870165784	akmadmin	2026-04-24 12:35:44.481001	59	t
221	219	Coding submissions id to varchar	SQL	V219__Coding_submissions_id_to_varchar.sql	-1952620644	akmadmin	2026-04-24 19:41:34.62156	165	t
222	220	Add gemini 3 1 pro preview to ai models	SQL	V220__Add_gemini_3_1_pro_preview_to_ai_models.sql	1963940363	akmadmin	2026-04-25 14:00:24.124074	109	t
223	221	Backfill ai models and image unit price	SQL	V221__Backfill_ai_models_and_image_unit_price.sql	-3686364	akmadmin	2026-04-25 14:00:24.742851	261	t
224	222	Add gemini 3 flash preview to ai models	SQL	V222__Add_gemini_3_flash_preview_to_ai_models.sql	-414904038	akmadmin	2026-04-25 14:02:25.770728	126	t
225	223	Increase custom fields key length	SQL	V223__Increase_custom_fields_key_length.sql	348722787	akmadmin	2026-04-28 13:29:23.977048	39	t
226	224	Add avatar video models	SQL	V224__Add_avatar_video_models.sql	-878576373	akmadmin	2026-05-02 05:45:47.898518	78	t
227	225	Expand ai token usage constraints for host and tts	SQL	V225__Expand_ai_token_usage_constraints_for_host_and_tts.sql	-842918008	akmadmin	2026-05-02 11:45:38.678124	290	t
228	226	Add vimotion fields to institutes	SQL	V226__Add_vimotion_fields_to_institutes.sql	-1757722773	akmadmin	2026-05-03 19:13:27.82893	48	t
229	227	Create vimotion brand kits and avatars	SQL	V227__Create_vimotion_brand_kits_and_avatars.sql	2124678623	akmadmin	2026-05-04 05:59:25.5811	134	t
230	228	Add avatar provider	SQL	V228__Add_avatar_provider.sql	-1407553060	akmadmin	2026-05-04 07:42:45.007988	46	t
231	229	Create assessment slide table	SQL	V229__Create_assessment_slide_table.sql	1718449241	akmadmin	2026-05-04 22:50:03.822794	629	t
232	230	Create assessment slide table	SQL	V230__Create_assessment_slide_table.sql	1718449241	akmadmin	2026-05-05 07:00:56.503056	70	t
233	231	Remove unreachable gemini 2 0 flash lite	SQL	V231__Remove_unreachable_gemini_2_0_flash_lite.sql	-1710127281	akmadmin	2026-05-05 07:22:53.069679	15	t
234	232	Unify CPO into payment option	SQL	V232__Unify_CPO_into_payment_option.sql	-1688441482	akmadmin	2026-05-05 18:03:57.499721	1236	t
235	233	Restore bridge cpo id for rollout compat	SQL	V233__Restore_bridge_cpo_id_for_rollout_compat.sql	544991544	akmadmin	2026-05-05 19:08:57.542117	403	t
236	234	Create vision review cases table	SQL	V234__Create_vision_review_cases_table.sql	2117955405	akmadmin	2026-05-08 04:58:09.761318	105	t
237	235	Create issued certificate table	SQL	V235__Create_issued_certificate_table.sql	1913062780	akmadmin	2026-05-08 14:35:29.372652	243	t
238	236	Index assets	SQL	V236__Index_assets.sql	-1609770405	akmadmin	2026-05-09 04:41:22.662073	127	t
239	237	Add content copy audit columns to package session	SQL	V237__Add_content_copy_audit_columns_to_package_session.sql	1283548783	akmadmin	2026-05-09 11:18:41.120611	184	t
240	238	Credit pack catalog	SQL	V238__Credit_pack_catalog.sql	-650567394	akmadmin	2026-05-09 08:21:19.902792	148	t
241	239	Institute currency and gstin	SQL	V239__Institute_currency_and_gstin.sql	693713453	akmadmin	2026-05-09 08:21:20.443724	16	t
242	240	Platform payment config	SQL	V240__Platform_payment_config.sql	1084366255	akmadmin	2026-05-09 08:21:20.501651	44	t
243	241	Platform payment tables	SQL	V241__Platform_payment_tables.sql	2092440417	akmadmin	2026-05-09 08:21:20.611143	60	t
244	242	Platform invoice tables	SQL	V242__Platform_invoice_tables.sql	1502743606	akmadmin	2026-05-09 08:21:20.722462	73	t
245	243	Credit transactions purchase unique	SQL	V243__Credit_transactions_purchase_unique.sql	661253638	akmadmin	2026-05-09 08:21:20.855377	42	t
246	244	Platform billing uuid to varchar	SQL	V244__Platform_billing_uuid_to_varchar.sql	1744997577	akmadmin	2026-05-09 14:08:30.805596	1037	t
247	245	Create ai reels tables	SQL	V245__Create_ai_reels_tables.sql	-1360987780	akmadmin	2026-05-11 18:11:00.572782	275	t
248	246	CPO per learner overrides and discount	SQL	V246__CPO_per_learner_overrides_and_discount.sql	1762442730	akmadmin	2026-05-12 09:56:19.88335	203	t
249	247	Ai gen video table updates	SQL	V247__Ai_gen_video_table_updates.sql	980390027	akmadmin	2026-05-12 19:53:01.649577	247	t
250	248	New credit pack	SQL	V248__New_credit_pack.sql	942087167	akmadmin	2026-05-13 10:23:44.408576	197	t
251	249	Add hide institute name and logo dims to domain routing	SQL	V249__Add_hide_institute_name_and_logo_dims_to_domain_routing.sql	297504748	akmadmin	2026-05-13 08:05:20.141058	24	t
252	250	Youtube integration tables	SQL	V250__Youtube_integration_tables.sql	-1072616943	akmadmin	2026-05-13 18:19:50.406551	136	t
253	251	Add more avatar video models	SQL	V251__Add_more_avatar_video_models.sql	601311606	akmadmin	2026-05-14 10:06:21.03311	171	t
254	252	Credit rate config	SQL	V252__Credit_rate_config.sql	-489795818	akmadmin	2026-05-14 11:13:35.132928	59	t
255	253	Create ai content source	SQL	V253__Create_ai_content_source.sql	618238076	akmadmin	2026-05-15 14:52:52.647322	257	t
256	254	Create ai content extraction	SQL	V254__Create_ai_content_extraction.sql	-1533516939	akmadmin	2026-05-15 14:52:53.608061	256	t
257	255	Add audit columns to slide	SQL	V255__Add_audit_columns_to_slide.sql	-954103376	akmadmin	2026-05-15 14:52:54.218783	233	t
258	256	Add audit columns to package session level	SQL	V256__Add_audit_columns_to_package_session_level.sql	-1594041648	akmadmin	2026-05-15 14:52:54.779731	556	t
259	257	Create product page	SQL	V257__Create_product_page.sql	-1015288993	akmadmin	2026-05-15 17:41:33.567582	1101	t
260	300	Create ai generated artifact	SQL	V300__Create_ai_generated_artifact.sql	904969721	akmadmin	2026-05-15 18:45:08.465614	240	t
261	258	ai model stage assignments	SQL	V258__ai_model_stage_assignments.sql	-265634914	akmadmin	2026-05-19 11:24:28.055751	137	t
262	301	Add cached transcript text to ai content extraction	SQL	V301__Add_cached_transcript_text_to_ai_content_extraction.sql	408658886	akmadmin	2026-05-20 15:07:52.46421	168	t
263	259	Admin activity log	SQL	V259__Admin_activity_log.sql	-950045240	akmadmin	2026-05-20 17:06:38.873284	309	t
264	260	Add tat reminder dedup to audience response	SQL	V260__Add_tat_reminder_dedup_to_audience_response.sql	-1636170279	akmadmin	2026-05-22 00:40:51.34107	509	t
265	261	Create lead status tables	SQL	V261__Create_lead_status_tables.sql	-1463184744	akmadmin	2026-05-22 00:40:53.435489	606	t
266	262	Create lead sla config tables	SQL	V262__Create_lead_sla_config_tables.sql	-1039642891	akmadmin	2026-05-22 00:40:54.495529	418	t
267	263	Add is system to lead status	SQL	V263__Add_is_system_to_lead_status.sql	1089688723	akmadmin	2026-05-22 00:40:55.400364	259	t
268	264	Seed default lead statuses for all institutes	SQL	V264__Seed_default_lead_statuses_for_all_institutes.sql	-1309188185	akmadmin	2026-05-22 09:00:55.413109	187	t
269	265	Counselor pool and assignment	SQL	V265__Counselor_pool_and_assignment.sql	61957479	akmadmin	2026-05-22 11:40:28.875088	455	t
270	266	Add default initial score to lead config and audience	SQL	V266__Add_default_initial_score_to_lead_config_and_audience.sql	-959327228	akmadmin	2026-05-22 16:06:06.814769	125	t
271	267	Add initial score to audience response	SQL	V267__Add_initial_score_to_audience_response.sql	600498569	akmadmin	2026-05-22 18:02:40.218681	134	t
272	268	Add manual score override to lead score	SQL	V268__Add_manual_score_override_to_lead_score.sql	314051099	akmadmin	2026-05-22 18:02:40.831556	133	t
273	269	Add category to timeline event	SQL	V269__Add_category_to_timeline_event.sql	1015987802	akmadmin	2026-05-22 18:02:41.308688	226	t
274	270	Add schedule pattern to counselor pool	SQL	V270__Add_schedule_pattern_to_counselor_pool.sql	1364039317	akmadmin	2026-05-22 19:05:56.78746	156	t
275	271	Add is manual override to lead score	SQL	V271__Add_is_manual_override_to_lead_score.sql	713440323	akmadmin	2026-05-22 19:09:47.943879	162	t
276	272	Add first response at to user lead profile	SQL	V272__Add_first_response_at_to_user_lead_profile.sql	397208164	akmadmin	2026-05-22 19:44:22.600056	198	t
277	273	Create lead followup table	SQL	V273__Create_lead_followup_table.sql	-52441552	akmadmin	2026-05-22 21:02:57.32066	289	t
278	302	assignment slide window and late flag	SQL	V302__assignment_slide_window_and_late_flag.sql	1950217361	akmadmin	2026-05-23 07:22:06.801704	91	t
279	274	Consolidate to issued certificate and add certificate id	SQL	V274__Consolidate_to_issued_certificate_and_add_certificate_id.sql	138689566	akmadmin	2026-05-24 14:54:57.698151	672	t
\.


--
-- PostgreSQL database dump complete
--


