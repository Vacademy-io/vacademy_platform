CREATE SEQUENCE vimotion_waitlist_position_seq START 1;

CREATE TABLE vimotion_waitlist (
    id              varchar(64) PRIMARY KEY,
    full_name       varchar(120) NOT NULL,
    email           varchar(255) NOT NULL,
    phone_number    varchar(32)  NOT NULL,
    status          varchar(32)  NOT NULL DEFAULT 'pending',
    referrer_id     varchar(64)  REFERENCES vimotion_waitlist(id),
    referral_code   varchar(16)  NOT NULL UNIQUE,
    referral_count  integer      NOT NULL DEFAULT 0,
    position        integer      NOT NULL,
    source          varchar(64),
    created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_vimotion_waitlist_email_lower
    ON vimotion_waitlist (LOWER(email));

CREATE INDEX idx_vimotion_waitlist_status
    ON vimotion_waitlist (status);

CREATE INDEX idx_vimotion_waitlist_referral_code
    ON vimotion_waitlist (referral_code);

ALTER TABLE vimotion_invite_code
    ADD CONSTRAINT fk_vimotion_invite_waitlist
    FOREIGN KEY (waitlist_id) REFERENCES vimotion_waitlist(id);
