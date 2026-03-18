-- Live session persistence: store session, participant, and response data in DB
-- so that session history survives server restarts and the 24-hour in-memory cleanup.

CREATE TABLE IF NOT EXISTS public.live_session (
    id                              VARCHAR(255) PRIMARY KEY,
    presentation_id                 VARCHAR(255),
    presentation_title              VARCHAR(500),
    invite_code                     VARCHAR(20),
    status                          VARCHAR(20)  NOT NULL DEFAULT 'INIT',
    can_join_in_between             BOOLEAN      DEFAULT TRUE,
    show_results_at_last_slide      BOOLEAN      DEFAULT TRUE,
    default_seconds_for_question    INT          DEFAULT 60,
    student_attempts                INT          DEFAULT 1,
    points_per_correct_answer       INT          DEFAULT 10,
    negative_marking_enabled        BOOLEAN      DEFAULT FALSE,
    negative_marks_per_wrong_answer DECIMAL(10,2) DEFAULT 0.0,
    total_mcq_slides                INT          DEFAULT 0,
    created_at                      TIMESTAMP,
    started_at                      TIMESTAMP,
    ended_at                        TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.live_session_participant (
    id          VARCHAR(255) PRIMARY KEY,
    session_id  VARCHAR(255) NOT NULL REFERENCES public.live_session(id) ON DELETE CASCADE,
    username    VARCHAR(255) NOT NULL,
    user_id     VARCHAR(255),
    name        VARCHAR(500),
    email       VARCHAR(500),
    joined_at   TIMESTAMP,
    UNIQUE (session_id, username)
);

-- One row per submitted response (multiple rows allowed per slide per user when student_attempts > 1)
CREATE TABLE IF NOT EXISTS public.live_session_response (
    id                       VARCHAR(255) PRIMARY KEY,
    session_id               VARCHAR(255) NOT NULL REFERENCES public.live_session(id) ON DELETE CASCADE,
    slide_id                 VARCHAR(255) NOT NULL,
    username                 VARCHAR(255) NOT NULL,
    response_type            VARCHAR(50),
    selected_option_ids      TEXT,   -- JSON array e.g. ["uuid1","uuid2"]
    text_answer              TEXT,
    is_correct               BOOLEAN,
    time_to_response_millis  BIGINT,
    submitted_at             TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_live_session_response_session_slide
    ON public.live_session_response (session_id, slide_id);

CREATE INDEX IF NOT EXISTS idx_live_session_participant_session
    ON public.live_session_participant (session_id);

CREATE INDEX IF NOT EXISTS idx_live_session_presentation
    ON public.live_session (presentation_id);
