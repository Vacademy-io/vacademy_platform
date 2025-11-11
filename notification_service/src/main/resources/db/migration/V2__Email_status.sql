-- Create table to track SES email lifecycle per mail_id
CREATE TABLE IF NOT EXISTS email_status (
  mail_id           varchar(255) PRIMARY KEY,
  ses_message_id    varchar(255) UNIQUE,
  from_email        varchar(255) NOT NULL,
  to_email          varchar(255) NOT NULL,
  institute_id      varchar(255),
  status            varchar(32)  NOT NULL,
  last_event_at     timestamptz,
  created_at        timestamptz  DEFAULT now(),
  updated_at        timestamptz  DEFAULT now(),
  CONSTRAINT email_status_status_chk
    CHECK (status IN ('SENT','DELIVERED','BOUNCED','COMPLAINED','OPENED','CLICKED'))
);

CREATE INDEX IF NOT EXISTS idx_email_status_ses_message_id ON email_status (ses_message_id);
CREATE INDEX IF NOT EXISTS idx_email_status_institute_id  ON email_status (institute_id);
-- Optional for queries by state
-- CREATE INDEX IF NOT EXISTS idx_email_status_status        ON email_status (status);

-- Optional: trigger for updated_at (PostgreSQL)
-- CREATE OR REPLACE FUNCTION set_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- DROP TRIGGER IF EXISTS trg_email_status_updated ON email_status;
-- CREATE TRIGGER trg_email_status_updated BEFORE UPDATE ON email_status
-- FOR EACH ROW EXECUTE FUNCTION set_updated_at();
