-- Vacademy Voice (Plivo) P2: multi-level IVR menus. An institute authors a tree of
-- nodes (play prompt, gather a digit, dial numbers, voicemail, hangup); an inbound
-- call to a DID resolves its menu and walks the tree per the caller's key presses.
-- Provider-neutral by design (Plivo renders it as Answer-XML), but only Plivo uses
-- it today.

CREATE TABLE ivr_menu (
    id            VARCHAR(36)  PRIMARY KEY,
    institute_id  VARCHAR(36)  NOT NULL,
    name          VARCHAR(128) NOT NULL,
    -- The DID this IVR answers. NULL = the institute's default menu (used when no
    -- DID-specific menu matches the dialled number).
    dialed_number VARCHAR(20),
    -- Entry node of the tree (FK-soft to ivr_node.id; set after nodes are created).
    root_node_id  VARCHAR(36),
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ivr_menu_institute ON ivr_menu (institute_id, enabled);
CREATE INDEX idx_ivr_menu_dialed    ON ivr_menu (dialed_number) WHERE dialed_number IS NOT NULL;

CREATE TABLE ivr_node (
    id              VARCHAR(36)  PRIMARY KEY,
    menu_id         VARCHAR(36)  NOT NULL,
    node_type       VARCHAR(24)  NOT NULL,   -- PLAY | GATHER | DIAL | VOICEMAIL | HANGUP
    label           VARCHAR(128),            -- admin-facing label
    prompt_text     TEXT,                    -- TTS prompt spoken to the caller
    prompt_audio_id VARCHAR(64),             -- optional recorded prompt (media_service file id)
    -- GATHER: JSON map of pressed digit -> next node id, e.g. {"1":"<id>","2":"<id>"}.
    digit_map       TEXT,
    -- DIAL: JSON array of E.164 numbers to ring, e.g. ["+9198...","+9199..."].
    dial_targets    TEXT,
    -- PLAY: the node to continue to after the prompt.
    next_node_id    VARCHAR(36),
    timeout_seconds INTEGER      NOT NULL DEFAULT 6,
    max_retries     INTEGER      NOT NULL DEFAULT 2,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ivr_node_menu FOREIGN KEY (menu_id) REFERENCES ivr_menu (id)
);
CREATE INDEX idx_ivr_node_menu ON ivr_node (menu_id);
