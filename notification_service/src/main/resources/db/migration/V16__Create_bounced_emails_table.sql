-- Create bounced_emails table for storing email addresses that have bounced
-- These emails will be blocked from receiving any future emails from our application

CREATE TABLE public.bounced_emails (
    id varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    bounce_type varchar(50) NOT NULL,
    bounce_sub_type varchar(100),
    bounce_reason text,
    ses_message_id varchar(255),
    original_notification_log_id varchar(255),
    is_active bool DEFAULT true NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bounced_emails_pkey PRIMARY KEY (id),
    CONSTRAINT bounced_emails_email_unique UNIQUE (email)
);

-- Index for fast lookup by email address (most common operation)
CREATE INDEX idx_bounced_emails_email ON public.bounced_emails USING btree (email);

-- Index for filtering active bounced emails
CREATE INDEX idx_bounced_emails_is_active ON public.bounced_emails USING btree (is_active);

-- Index for filtering by bounce type
CREATE INDEX idx_bounced_emails_bounce_type ON public.bounced_emails USING btree (bounce_type);

-- Composite index for the most common query pattern: checking if an active bounce exists for an email
CREATE INDEX idx_bounced_emails_email_active ON public.bounced_emails USING btree (email, is_active);

-- Comments for documentation
COMMENT ON TABLE public.bounced_emails IS 'Stores email addresses that have bounced. These emails are blocked from receiving future emails.';
COMMENT ON COLUMN public.bounced_emails.email IS 'The email address that bounced (normalized to lowercase)';
COMMENT ON COLUMN public.bounced_emails.bounce_type IS 'SES bounce type: Permanent, Transient, Undetermined';
COMMENT ON COLUMN public.bounced_emails.bounce_sub_type IS 'SES bounce sub-type: General, NoEmail, Suppressed, OnAccountSuppressionList, MailboxFull, etc.';
COMMENT ON COLUMN public.bounced_emails.bounce_reason IS 'Diagnostic information from the bounce event';
COMMENT ON COLUMN public.bounced_emails.ses_message_id IS 'The SES message ID of the email that bounced';
COMMENT ON COLUMN public.bounced_emails.original_notification_log_id IS 'Reference to the original notification_log entry';
COMMENT ON COLUMN public.bounced_emails.is_active IS 'Whether this bounce block is active. Set to false to unblock an email.';

