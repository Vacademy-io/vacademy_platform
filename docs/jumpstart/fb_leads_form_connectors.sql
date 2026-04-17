-- ============================================================================
-- Facebook Lead Ads — Form Webhook Connector Entries (11 Centers)
-- ============================================================================
-- Each center has its own Facebook Lead form. All entries point to the single
-- "Facebook Leads New" audience (61b4cd61-a0aa-4b93-9af6-b717a951c5f5).
--
-- vendor_id values are PLACEHOLDERS (fb_form_*) — update with actual Facebook
-- form IDs after connecting your Facebook Lead Ads.
--
-- default_values_json injects center-specific constants automatically when a
-- Facebook lead webhook arrives. These values are merged into custom_field_value
-- records and used by the workflow templates.
--
-- sample_map_json maps Facebook form field names to custom field names.
-- UPDATE the left-side keys if your Facebook form uses different field names.
-- ============================================================================

INSERT INTO form_webhook_connector (
    id, vendor_id, vendor, institute_id, audience_id,
    sample_map_json, default_values_json, is_active,
    produces_source_type, created_at, updated_at
) VALUES

-- 1. Karve Road
(
    gen_random_uuid(),
    'fb_form_karve_road',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Karve Road", "Schedule Link": "https://cal.com/jumpstart-karve-road-qw8jeu/30min", "Location Link": "https://g.page/jumpstartkarveroad?share", "School Phone": "9881110011", "FB Name": "Devaki"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 2. Nyati County
(
    gen_random_uuid(),
    'fb_form_nyati_county',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Nyati County", "Schedule Link": "https://cal.com/neha-tathed-fhqblq/30min", "Location Link": "https://g.page/jumpstartnyaticounty?share", "School Phone": "7410040485", "FB Name": "Yashna"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 3. Magarpatta
(
    gen_random_uuid(),
    'fb_form_magarpatta',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Magarpatta", "Schedule Link": "https://cal.com/jumpstart-magarpatta-uddmcj/30min", "Location Link": "https://goo.gl/maps/Vxc3kcE2has6r26K7", "School Phone": "9881118800", "FB Name": "Sneha"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 4. Koramangala
(
    gen_random_uuid(),
    'fb_form_koramangala',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Koramangala", "Schedule Link": "https://cal.com/jumpstart-koramangala-yhafsd/30min", "Location Link": "https://goo.gl/maps/zafzUCUjd2V79FNX8", "School Phone": "8376001010", "FB Name": "Jyoti"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 5. Pimple Saudagar
(
    gen_random_uuid(),
    'fb_form_pimple_saudagar',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Pimple Saudagar", "Schedule Link": "https://cal.com/jumpstart-pimple-saudagar-agx1lv/30min", "Location Link": "https://goo.gl/maps/tabxfjjNRSaTbQM79", "School Phone": "9881110066", "FB Name": "Sneha"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 6. Baner
(
    gen_random_uuid(),
    'fb_form_baner',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Baner", "Schedule Link": "https://cal.com/jumpstart-international-preschool-baner-uvkztf/30min", "Location Link": "https://maps.app.goo.gl/7YJjWJGNmEw5BVWU7", "School Phone": "8530553999", "FB Name": "Seema"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 7. Bibwewadi
(
    gen_random_uuid(),
    'fb_form_bibwewadi',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Bibwewadi", "Schedule Link": "https://cal.com/jumpstart-bibwewadi-xggcn0/30min", "Location Link": "https://maps.app.goo.gl/hCJf5fAmRoq8fGUo7", "School Phone": "8530606999", "FB Name": "Ishpreet"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 8. Viman Nagar
(
    gen_random_uuid(),
    'fb_form_viman_nagar',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Viman Nagar", "Schedule Link": "https://cal.com/jumpstart-viman-nagar-jrl8ks/30min", "Location Link": "https://g.co/kgs/PD8jP2x", "School Phone": "8530883999", "FB Name": "Pallavi"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 9. Wakad
(
    gen_random_uuid(),
    'fb_form_wakad',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Wakad", "Schedule Link": "https://cal.com/jumpstart-wakad/30min", "Location Link": "https://maps.app.goo.gl/oaeCD3j3pHUcUGnF8?g_st=iw", "School Phone": "9665573999", "FB Name": "Rupali"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 10. Hinjewadi
(
    gen_random_uuid(),
    'fb_form_hinjewadi',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Hinjewadi", "Schedule Link": "https://cal.com/jumpstart-hinjewadi-qzsldm/30min", "Location Link": "https://maps.app.goo.gl/YRxg4Jgevj2LaPCh6", "School Phone": "8530506999", "FB Name": "Anupama"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
),

-- 11. Kharadi
(
    gen_random_uuid(),
    'fb_form_kharadi',
    'GENERIC',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '61b4cd61-a0aa-4b93-9af6-b717a951c5f5',
    '{"full_name": "Full Name", "email": "Email", "phone_number": "Phone Number"}',
    '{"center name": "Kharadi", "Schedule Link": "https://cal.com/jumpstart-kharadi/30min", "Location Link": "https://maps.app.goo.gl/HQyxGWRRFhCVdh5r7", "School Phone": "8530169111", "FB Name": "Neha"}',
    true,
    'FACEBOOK_ADS',
    NOW(), NOW()
);

-- ============================================================================
-- NOTES:
-- 1. Replace vendor_id values (fb_form_*) with actual Facebook form IDs
-- 2. sample_map_json left-side keys (full_name, email, phone_number) should
--    match the field names in your Facebook Lead Ads form
-- 3. default_values_json right-side keys MUST match the custom field names
--    defined in the "Facebook Leads New" audience exactly (case-sensitive)
-- 4. To add a new center, copy any entry and update:
--    vendor_id, center name, Schedule Link, Location Link, School Phone, FB Name
-- ============================================================================
