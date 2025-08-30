# Fix Flyway Migration Issue

## Problem
The database has a V2 migration applied but the file is missing locally, causing validation to fail.

## Quick Solution

### Option 1: Delete the problematic migration entry (Recommended)
Connect to your PostgreSQL database and run:

```sql
-- Remove the problematic V2 migration entry
DELETE FROM flyway_schema_history WHERE version = '2';
```

### Option 2: Mark as deleted (Alternative)
```sql
-- Mark the migration as unsuccessful/deleted
UPDATE flyway_schema_history 
SET success = false, 
    description = 'Add Persistent Guest Tokens (DELETED - file missing)'
WHERE version = '2';
```

## Steps to Execute

1. **Connect to your database:**
   ```bash
   psql -h YOUR_HOST -U YOUR_USERNAME -d YOUR_DATABASE
   ```

2. **Run the fix:**
   ```sql
   DELETE FROM flyway_schema_history WHERE version = '2';
   ```

3. **Verify the change:**
   ```sql
   SELECT installed_rank, version, description, success 
   FROM flyway_schema_history 
   ORDER BY installed_rank;
   ```

4. **Exit and restart your application**

## Expected Result
- Application will start successfully
- V3 migration (tag system) will be applied
- Tag management system will be operational

## Database Connection Info
You'll need your database credentials from environment variables:
- `ADMIN_CORE_SERVICE_DB_URL`
- `DB_USERNAME` 
- `DB_PASSWORD`
