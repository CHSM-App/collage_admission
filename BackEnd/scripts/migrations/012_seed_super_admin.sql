-- ============================================================
-- 012_seed_super_admin.sql
-- Seeds the default super-admin account.
-- Idempotent — skips if the email already exists.
--
-- Default password: Admin@123
-- IMPORTANT: Change the email and regenerate the hash before
-- deploying to production:
--
--   node -e "
--     const b = require('bcryptjs');
--     b.hash('YourNewPassword', 10).then(console.log);
--   "
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM admins WHERE email = 'admin@vengurlatech.com')
    INSERT INTO admins (name, email, password_hash)
    VALUES (
        'Super Admin',
        'admin@vengurlatech.com',
        '$2a$10$Iu4D3b3U8bFmFNjq3J2fYOv6yYB0J8dT8rO0XJkKjT1TfUvP6mOSO'
        -- bcrypt hash of: Admin@123
        -- REPLACE this hash with a strong password before going live
    );
GO
