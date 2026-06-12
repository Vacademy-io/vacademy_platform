-- ============================================================================
--  Fix the doubt-notification email CTA buttons.
--
--  The V215-seeded DEFAULT templates hardcoded href="#" on the "Open doubt" /
--  "See the reply" buttons, so recipients got an email whose CTA went nowhere —
--  even though DoubtNotificationService.lookupDoubtUrl already computes a real
--  {{doubt_url}} and binds it into the placeholder map. Point the buttons at
--  {{doubt_url}}. Also swap the raw {{batch_id}} display for the friendlier
--  {{batch_name}} (provided by the same map, falling back to the id when blank).
--
--  Only the untouched system DEFAULT rows are updated (created_by/updated_by =
--  'system'), matching V215's guard so any admin-edited template is preserved.
--  Idempotent: re-running finds no remaining href="#" and is a no-op.
-- ============================================================================

-- Doubt Raised - Teacher Notification: fix CTA link + batch label.
UPDATE templates
SET content = replace(
        replace(content, 'href="#"', 'href="{{doubt_url}}"'),
        '{{batch_id}}', '{{batch_name}}'
    )
WHERE institute_id = 'DEFAULT'
  AND type = 'EMAIL'
  AND name = 'Doubt Raised - Teacher Notification'
  AND created_by = 'system'
  AND updated_by = 'system';

-- Doubt Resolved - Learner Notification: fix CTA link.
UPDATE templates
SET content = replace(content, 'href="#"', 'href="{{doubt_url}}"')
WHERE institute_id = 'DEFAULT'
  AND type = 'EMAIL'
  AND name = 'Doubt Resolved - Learner Notification'
  AND created_by = 'system'
  AND updated_by = 'system';
