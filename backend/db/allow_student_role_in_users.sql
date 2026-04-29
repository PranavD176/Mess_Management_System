-- Allow student role in users table for student login support.
-- Run once on existing databases created with older schema.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('admin', 'staff', 'student'));
