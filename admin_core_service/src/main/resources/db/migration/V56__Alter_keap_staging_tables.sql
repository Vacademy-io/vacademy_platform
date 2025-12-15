-- Add columns to migration_staging_keap_users
ALTER TABLE migration_staging_keap_users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(255),
ADD COLUMN IF NOT EXISTS address VARCHAR(255),
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS state VARCHAR(255),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(255),
ADD COLUMN IF NOT EXISTS country VARCHAR(255),
ADD COLUMN IF NOT EXISTS product_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS next_bill_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS eway_token VARCHAR(255);

-- Add unique constraint to keap_contact_id in users table
ALTER TABLE migration_staging_keap_users
ADD CONSTRAINT uc_keap_contact_id UNIQUE (keap_contact_id);

-- Add columns to migration_staging_keap_payments
ALTER TABLE migration_staging_keap_payments
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS status VARCHAR(255);

-- Add Foreign Key constraint to payments table
ALTER TABLE migration_staging_keap_payments
ADD CONSTRAINT fk_keap_payment_user
FOREIGN KEY (keap_contact_id)
REFERENCES migration_staging_keap_users(keap_contact_id);
