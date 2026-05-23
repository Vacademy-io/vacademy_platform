-- Add institute_id to notification_log so the Hub's Email Inbox / WhatsApp Inbox can scope
-- by institute directly instead of relying on (a) institute.setting.EMAIL_SETTING.data
-- "configured from-addresses" for email or (b) channel_to_institute_mapping for WhatsApp.
--
-- The previous filters silently dropped any row whose sender wasn't in those lists —
-- which is how template / transactional sends went missing from the Hub even though they
-- appear in the per-learner side-view timeline. With institute_id stamped at insert time,
-- the inbox queries become a single WHERE clause and match the side view 1:1.
--
-- TZ invariant: `notification_date` remains TIMESTAMP WITHOUT TIME ZONE. Writers use
-- Instant.now() and Hibernate is pinned to UTC (spring.jpa.properties.hibernate.jdbc.time_zone=UTC
-- + container ENV TZ=UTC), so column values are naive UTC wall-clock. Cursor pagination casts
-- ISO strings via `CAST(:cursor AS TIMESTAMP)` which discards a trailing 'Z' and yields the
-- same naive UTC convention — so cursor comparisons stay correct end-to-end. Do not flip the
-- column type to TIMESTAMPTZ without auditing every CAST in NotificationLogRepository.

ALTER TABLE notification_log
    ADD COLUMN institute_id VARCHAR(255);

-- Hub conversation-list query: per-institute, newest first.
CREATE INDEX idx_notification_log_institute_date
    ON notification_log (institute_id, notification_date DESC);

-- Hub drill-down + per-recipient queries.
CREATE INDEX idx_notification_log_institute_channel
    ON notification_log (institute_id, channel_id, notification_type);

-- Backfill #1: WhatsApp rows. sender_business_channel_id holds the WABA phone-number-id,
-- which is the PK of channel_to_institute_mapping. Direct join.
UPDATE notification_log nl
SET    institute_id = m.institute_id
FROM   channel_to_institute_mapping m
WHERE  nl.sender_business_channel_id = m.channel_id
  AND  nl.institute_id IS NULL;

-- Backfill #2: Email + Push rows sent via the announcement pipeline. The announcements
-- table already carries institute_id; rows in notification_log written by
-- AnnouncementDeliveryService set source='announcement-service' and source_id=<announcement.id>,
-- so a single join resolves their institute_id without touching the institute-service DB.
UPDATE notification_log nl
SET    institute_id = a.institute_id
FROM   announcements a
WHERE  nl.source = 'announcement-service'
  AND  nl.source_id = a.id
  AND  nl.institute_id IS NULL;

-- Backfill #3: EMAIL_EVENT (SES) rows. Each event's `source` column holds the parent
-- EMAIL log id (set by EmailEventService.createEmailEventLog), so we can copy the parent's
-- institute_id forward in one update.
UPDATE notification_log ev
SET    institute_id = parent.institute_id
FROM   notification_log parent
WHERE  ev.notification_type = 'EMAIL_EVENT'
  AND  ev.source = parent.id
  AND  ev.institute_id IS NULL
  AND  parent.institute_id IS NOT NULL;

-- Backfill #4: Best-effort copy from any earlier outbound row to the same recipient that
-- already has institute_id set. Catches OTP / transactional emails where the recipient
-- previously received a campaign email — the institute relationship is implied by the
-- recipient. Limited to EMAIL / INBOUND_EMAIL so a learner's WhatsApp doesn't taint
-- their email rows.
UPDATE notification_log nl
SET    institute_id = src.institute_id
FROM   (
    SELECT DISTINCT ON (channel_id) channel_id, institute_id
    FROM   notification_log
    WHERE  institute_id IS NOT NULL
      AND  notification_type IN ('EMAIL', 'INBOUND_EMAIL')
    ORDER BY channel_id, notification_date DESC
) src
WHERE  nl.channel_id = src.channel_id
  AND  nl.notification_type IN ('EMAIL', 'INBOUND_EMAIL')
  AND  nl.institute_id IS NULL;
