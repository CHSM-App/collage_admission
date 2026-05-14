-- ============================================================
-- 005_seed_document_types.sql
-- Inserts the global document type master list.
-- Idempotent — skips any type that already exists by name.
-- ============================================================

INSERT INTO document_types (name, description)
SELECT name, description FROM (VALUES
    ('Aadhaar Card',           'Government issued Aadhaar identity card'),
    ('Passport Photo',         'Recent colour passport-size photograph'),
    ('10th Marksheet',         'Secondary School Certificate (SSC) marksheet'),
    ('12th Marksheet',         'Higher Secondary Certificate (HSC) marksheet'),
    ('FY Marksheet',           'First Year college marksheet'),
    ('SY Marksheet',           'Second Year college marksheet'),
    ('TY Marksheet',           'Third Year college marksheet'),
    ('Leaving Certificate',    'School / College leaving certificate'),
    ('Caste Certificate',      'Caste certificate from competent authority'),
    ('Income Certificate',     'Family income certificate from competent authority'),
    ('Migration Certificate',  'Migration certificate from previous institution'),
    ('Domicile Certificate',   'Domicile / residence certificate'),
    ('Gap Certificate',        'Affidavit for gap year(s) after last qualification'),
    ('Medical Certificate',    'Fitness certificate from registered medical officer'),
    ('Caste Validity Certificate',    'Caste validity certificate from competent authority'),
    ('Non creamy Layer Certificate',    'Non creamy layer certificate from competent authority'),
    ('Bank Passbook',          'First page of bank passbook showing account details')
) AS src(name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM document_types dt WHERE dt.name = src.name
);
GO









