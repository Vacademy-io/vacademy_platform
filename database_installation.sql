-- ================================================================================================
-- VACADEMY PLATFORM - DATABASE INSTALLATION SCRIPT (FLYWAY COMPATIBLE)
-- ================================================================================================
-- This script creates databases for all microservices before application deployment
-- 
-- DEPLOYMENT FLOW:
-- 1. Run this script to create databases
-- 2. Deploy applications (Flyway will create all tables from V1__Initial_schema.sql and migrations)
-- 3. Run post_installation_data.sql to insert client secret keys
-- 
-- Services: auth_service, admin_core_service, community_service, assessment_service, 
--          media_service, notification_service
-- ================================================================================================

\echo '================================================================================================'
\echo 'VACADEMY PLATFORM - PRE-INSTALLATION DATABASE SETUP'
\echo '================================================================================================'

-- ================================================================================================
-- STEP 1: CREATE DATABASES FOR ALL SERVICES
-- ================================================================================================

\echo '🏗️  Creating service databases...'

-- Create databases if they don't exist
SELECT 'CREATE DATABASE auth_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_service')\gexec

SELECT 'CREATE DATABASE admin_core_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'admin_core_service')\gexec

SELECT 'CREATE DATABASE community_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'community_service')\gexec

SELECT 'CREATE DATABASE assessment_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'assessment_service')\gexec

SELECT 'CREATE DATABASE media_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'media_service')\gexec

SELECT 'CREATE DATABASE notification_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_service')\gexec

-- ================================================================================================
-- STEP 2: CREATE REQUIRED FUNCTIONS FOR FLYWAY MIGRATIONS
-- ================================================================================================

\echo '⚙️  Setting up required functions for Flyway migrations...'

-- Function to update updated_at timestamp (required by auth service triggers)
CREATE OR REPLACE FUNCTION update_updated_on_user_task()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at column (generic version)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Copy these functions to all service databases
\c auth_service;
CREATE OR REPLACE FUNCTION update_updated_on_user_task()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\c admin_core_service;
CREATE OR REPLACE FUNCTION update_updated_on_user_task()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\c notification_service;
CREATE OR REPLACE FUNCTION update_updated_on_user_task()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\c community_service;
CREATE OR REPLACE FUNCTION update_updated_on_user_task()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\c assessment_service;
CREATE OR REPLACE FUNCTION update_updated_on_user_task()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\c media_service;
CREATE OR REPLACE FUNCTION update_updated_on_user_task()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================================
-- INSTALLATION COMPLETION
-- ================================================================================================

\echo '================================================================================================'
\echo '✅ PRE-INSTALLATION DATABASE SETUP COMPLETED SUCCESSFULLY!'
\echo '================================================================================================'
\echo 'Databases Created:'
\echo '  ✅ auth_service'
\echo '  ✅ admin_core_service'
\echo '  ✅ notification_service'
\echo '  ✅ community_service'
\echo '  ✅ assessment_service'
\echo '  ✅ media_service'
\echo ''
\echo 'Functions Created:'
\echo '  ✅ update_updated_on_user_task() - Required for Flyway triggers'
\echo '  ✅ update_updated_at_column() - Required for Flyway triggers'
\echo ''
\echo '📋 NEXT STEPS:'
\echo '  1. Deploy your microservices (Flyway will create all tables)'
\echo '  2. Run post_installation_data.sql to insert client secret keys'
\echo '  3. Verify deployment with your verification scripts'
\echo ''
\echo '⚠️  NOTE: This script only creates databases and prerequisite functions.'
\echo '   All tables will be created by Flyway migrations during application startup.'
\echo '================================================================================================'