-- ============================================================
-- seed.sql — Bootstrap data for a fresh installation.
--
-- Contains ONLY system-level reference data that every
-- deployment needs from day one:
--   1. Document types  (global master list)
--   2. Super-admin account
--
-- All scripts are idempotent — safe to re-run.
-- College, course, fee, and student data is entered through
-- the application UI after setup.
-- ============================================================


-- ============================================================
-- 1. DOCUMENT TYPES
-- Idempotent — inserts only rows that do not already exist.
-- ============================================================
INSERT INTO document_types (name, description)
SELECT name, description FROM (VALUES
    ('Aadhaar Card',                'Government issued Aadhaar identity card'),
    ('Passport Photo',              'Recent colour passport-size photograph'),
    ('10th Marksheet',              'Secondary School Certificate (SSC) marksheet'),
    ('12th Marksheet',              'Higher Secondary Certificate (HSC) marksheet'),
    ('FY Marksheet',                'First Year college marksheet'),
    ('SY Marksheet',                'Second Year college marksheet'),
    ('TY Marksheet',                'Third Year college marksheet'),
    ('Leaving Certificate',         'School / College leaving certificate'),
    ('Caste Certificate',           'Caste certificate from competent authority'),
    ('Caste Validity Certificate',  'Caste validity certificate from competent authority'),
    ('Non Creamy Layer Certificate','Non creamy layer certificate from competent authority'),
    ('Income Certificate',          'Family income certificate from competent authority'),
    ('Domicile Certificate',        'Domicile / residence certificate'),
    ('Migration Certificate',       'Migration certificate from previous institution'),
    ('Gap Certificate',             'Affidavit for gap year(s) after last qualification'),
    ('Medical Certificate',         'Fitness certificate from a registered medical officer'),
    ('Bank Passbook',               'First page of bank passbook showing account details')
) AS src(name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM document_types dt WHERE dt.name = src.name
);
GO


-- ============================================================
-- 2. SUPER-ADMIN ACCOUNT
--
-- Change the email and regenerate the password hash before
-- deploying to production:
--
--   node -e "
--     const b = require('bcryptjs');
--     b.hash('YourNewPassword', 10).then(console.log);
--   "
--
-- Default password: Admin@123
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM admins WHERE email = 'admin@vengurlatech.com')
BEGIN
    INSERT INTO admins (name, email, password_hash)
    VALUES (
        'Super Admin',
        'admin@vengurlatech.com',
        '$2a$10$Iu4D3b3U8bFmFNjq3J2fYOv6yYB0J8dT8rO0XJkKjT1TfUvP6mOSO'
        -- bcrypt hash of: Admin@123
        -- REPLACE this hash with a strong password before going live
    );
END
GO
