CREATE TABLE vimotion_invite_code (
    id                   varchar(64) PRIMARY KEY,
    code                 varchar(32) NOT NULL UNIQUE,
    kind                 varchar(16) NOT NULL,
    status               varchar(16) NOT NULL DEFAULT 'active',
    locked_email         varchar(255),
    locked_phone_number  varchar(32),
    waitlist_id          varchar(64),
    max_uses             integer,
    used_count           integer NOT NULL DEFAULT 0,
    expires_at           timestamp,
    note                 text,
    created_by           varchar(255),
    created_at           timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vimotion_invite_code_locked_email
    ON vimotion_invite_code (LOWER(locked_email))
    WHERE kind = 'locked';

CREATE INDEX idx_vimotion_invite_code_status
    ON vimotion_invite_code (status);

CREATE TABLE vimotion_invite_redemption (
    id              varchar(64) PRIMARY KEY,
    invite_code_id  varchar(64) NOT NULL REFERENCES vimotion_invite_code(id),
    email           varchar(255) NOT NULL,
    phone_number    varchar(32)  NOT NULL,
    user_id         varchar(255),
    institute_id    varchar(255),
    redeemed_at     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vimotion_invite_redemption_code
    ON vimotion_invite_redemption (invite_code_id);
