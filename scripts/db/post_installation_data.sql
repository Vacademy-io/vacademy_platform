-- ================================================================================================
-- VACADEMY PLATFORM - POST-INSTALLATION DATA SCRIPT
-- ================================================================================================
-- This script inserts client secret keys after Flyway has created all tables
-- 
-- PREREQUISITE: Applications must be running and Flyway migrations completed
-- 
-- This script inserts HMAC authentication keys required for service-to-service communication
-- ================================================================================================

\echo '================================================================================================'
\echo 'VACADEMY PLATFORM - POST-INSTALLATION DATA SETUP'
\echo '================================================================================================'

-- ================================================================================================
-- INSERT CLIENT SECRET KEYS FOR SERVICE-TO-SERVICE AUTHENTICATION
-- ================================================================================================

\echo '🔐 Inserting client secret keys for service-to-service authentication...'

-- Auth Service
\c auth_service;
\echo '  📝 Setting up auth_service client secrets...'

INSERT INTO public.client_secret_key (client_name, secret_key, created_at, updated_at) VALUES
('auth_service', 'uhuh83389nxs9ujssnsjjbnbdjn2828', NOW(), NOW()),
('admin_core_service', '782hbs82nnkmn2882smsjhsjssj882', NOW(), NOW()),
('community_service', 'comm83hs92nnk2882smscomm882', NOW(), NOW()),
('assessment_service', 'assess92hs82nnkmass82smsjass', NOW(), NOW()),
('media_service', '88bsbb992ssm99mm87643u83nsjhu', NOW(), NOW()),
('notification_service', 'dnkdnlkdldmsdlsdlsdkls73samn7334', NOW(), NOW())
ON CONFLICT (client_name) DO UPDATE SET 
    secret_key = EXCLUDED.secret_key,
    updated_at = NOW();

-- Admin Core Service
\c admin_core_service;
\echo '  📝 Setting up admin_core_service client secrets...'

INSERT INTO public.client_secret_key (client_name, secret_key, created_at, updated_at) VALUES
('auth_service', 'uhuh83389nxs9ujssnsjjbnbdjn2828', NOW(), NOW()),
('admin_core_service', '782hbs82nnkmn2882smsjhsjssj882', NOW(), NOW()),
('community_service', 'comm83hs92nnk2882smscomm882', NOW(), NOW()),
('assessment_service', 'assess92hs82nnkmass82smsjass', NOW(), NOW()),
('media_service', '88bsbb992ssm99mm87643u83nsjhu', NOW(), NOW()),
('notification_service', 'dnkdnlkdldmsdlsdlsdkls73samn7334', NOW(), NOW())
ON CONFLICT (client_name) DO UPDATE SET 
    secret_key = EXCLUDED.secret_key,
    updated_at = NOW();

-- Notification Service
\c notification_service;
\echo '  📝 Setting up notification_service client secrets...'

INSERT INTO public.client_secret_key (client_name, secret_key, created_at, updated_at) VALUES
('auth_service', 'uhuh83389nxs9ujssnsjjbnbdjn2828', NOW(), NOW()),
('admin_core_service', '782hbs82nnkmn2882smsjhsjssj882', NOW(), NOW()),
('community_service', 'comm83hs92nnk2882smscomm882', NOW(), NOW()),
('assessment_service', 'assess92hs82nnkmass82smsjass', NOW(), NOW()),
('media_service', '88bsbb992ssm99mm87643u83nsjhu', NOW(), NOW()),
('notification_service', 'dnkdnlkdldmsdlsdlsdkls73samn7334', NOW(), NOW())
ON CONFLICT (client_name) DO UPDATE SET 
    secret_key = EXCLUDED.secret_key,
    updated_at = NOW();

-- Community Service
\c community_service;
\echo '  📝 Setting up community_service client secrets...'

INSERT INTO public.client_secret_key (client_name, secret_key, created_at, updated_at) VALUES
('auth_service', 'uhuh83389nxs9ujssnsjjbnbdjn2828', NOW(), NOW()),
('admin_core_service', '782hbs82nnkmn2882smsjhsjssj882', NOW(), NOW()),
('community_service', 'comm83hs92nnk2882smscomm882', NOW(), NOW()),
('assessment_service', 'assess92hs82nnkmass82smsjass', NOW(), NOW()),
('media_service', '88bsbb992ssm99mm87643u83nsjhu', NOW(), NOW()),
('notification_service', 'dnkdnlkdldmsdlsdlsdkls73samn7334', NOW(), NOW())
ON CONFLICT (client_name) DO UPDATE SET 
    secret_key = EXCLUDED.secret_key,
    updated_at = NOW();

-- Assessment Service
\c assessment_service;
\echo '  📝 Setting up assessment_service client secrets...'

INSERT INTO public.client_secret_key (client_name, secret_key, created_at, updated_at) VALUES
('auth_service', 'uhuh83389nxs9ujssnsjjbnbdjn2828', NOW(), NOW()),
('admin_core_service', '782hbs82nnkmn2882smsjhsjssj882', NOW(), NOW()),
('community_service', 'comm83hs92nnk2882smscomm882', NOW(), NOW()),
('assessment_service', 'assess92hs82nnkmass82smsjass', NOW(), NOW()),
('media_service', '88bsbb992ssm99mm87643u83nsjhu', NOW(), NOW()),
('notification_service', 'dnkdnlkdldmsdlsdlsdkls73samn7334', NOW(), NOW())
ON CONFLICT (client_name) DO UPDATE SET 
    secret_key = EXCLUDED.secret_key,
    updated_at = NOW();

-- Media Service
\c media_service;
\echo '  📝 Setting up media_service client secrets...'

INSERT INTO public.client_secret_key (client_name, secret_key, created_at, updated_at) VALUES
('auth_service', 'uhuh83389nxs9ujssnsjjbnbdjn2828', NOW(), NOW()),
('admin_core_service', '782hbs82nnkmn2882smsjhsjssj882', NOW(), NOW()),
('community_service', 'comm83hs92nnk2882smscomm882', NOW(), NOW()),
('assessment_service', 'assess92hs82nnkmass82smsjass', NOW(), NOW()),
('media_service', '88bsbb992ssm99mm87643u83nsjhu', NOW(), NOW()),
('notification_service', 'dnkdnlkdldmsdlsdlsdkls73samn7334', NOW(), NOW())
ON CONFLICT (client_name) DO UPDATE SET 
    secret_key = EXCLUDED.secret_key,
    updated_at = NOW();

-- ================================================================================================
-- POST-INSTALLATION COMPLETION
-- ================================================================================================

\echo '================================================================================================'
\echo '✅ POST-INSTALLATION DATA SETUP COMPLETED SUCCESSFULLY!'
\echo '================================================================================================'
\echo 'Client Secret Keys Configured:'
\echo '  🔐 auth_service - HMAC authentication keys inserted'
\echo '  🔐 admin_core_service - HMAC authentication keys inserted'
\echo '  🔐 notification_service - HMAC authentication keys inserted'
\echo '  🔐 community_service - HMAC authentication keys inserted'
\echo '  🔐 assessment_service - HMAC authentication keys inserted'
\echo '  🔐 media_service - HMAC authentication keys inserted'
\echo ''
\echo 'Security Keys Configured:'
\echo '  ✅ All services can now authenticate with each other using HMAC'
\echo '  ✅ Service-to-service communication is secured'
\echo '  ✅ Keys match those configured in deploy-local-k8s.sh'
\echo ''
\echo '⚠️  IMPORTANT SECURITY NOTES:'
\echo '  🔒 These are development/staging keys - CHANGE IN PRODUCTION'
\echo '  🔒 Store production keys securely (environment variables, secrets manager)'
\echo '  🔒 Rotate keys regularly in production environments'
\echo ''
\echo '🎉 Your Vacademy Platform is now ready for use!'
\echo '================================================================================================'
