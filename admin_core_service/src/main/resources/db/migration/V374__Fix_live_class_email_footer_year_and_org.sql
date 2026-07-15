-- Fix hardcoded "© 2025 Your Organization" footer in live class email templates seeded by V177.
-- Replaces it with dynamic {{YEAR}} and {{INSTITUTE_NAME}} placeholders, which
-- LiveSessionNotificationProcessor now populates (current year + the institute's actual name).
-- Scoped to the exact known template ids so no other template content is touched.

UPDATE templates
SET content = REPLACE(
        content,
        '© 2025 Your Organization. All rights reserved.',
        '© {{YEAR}} {{INSTITUTE_NAME}}. All rights reserved.'
    ),
    dynamic_parameters = REPLACE(dynamic_parameters, '"TIME"]', '"TIME", "INSTITUTE_NAME", "YEAR"]')
WHERE id IN (
    'default-live-class-on-create-email',
    'default-live-class-before-live-email',
    'default-live-class-on-live-email',
    'default-live-class-delete-email',
    'sn-live-class-on-create-email',
    'sn-live-class-before-live-email',
    'sn-live-class-on-live-email',
    'sn-live-class-delete-email'
)
AND content LIKE '%© 2025 Your Organization%';
