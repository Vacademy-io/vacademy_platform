-- Fix: id column was UUID but entity uses String (@UuidGenerator), causing type mismatch on insert
ALTER TABLE audience_communication ALTER COLUMN id TYPE VARCHAR(255) USING id::VARCHAR(255);
