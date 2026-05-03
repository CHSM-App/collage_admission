-- College Admission System - Seed Data
-- Dummy data for 3 colleges in Vengurla / Konkan region
-- Passwords are plain-text here for dev; hash them before prod.
-- admin password for all colleges: "Admin@123"
-- Password hash below = bcrypt("Admin@123", 10) - replace with actual hash at runtime

-- ============================================================
-- DOCUMENT TYPES
-- ============================================================
INSERT INTO document_types (name, description) VALUES
('Aadhaar Card',      'Government issued Aadhaar identity card'),
('Passport Photo',    'Recent colour passport-size photograph'),
('10th Marksheet',    'Secondary School Certificate marksheet'),
('12th Marksheet',    'Higher Secondary Certificate marksheet'),
('FY Marksheet',      'First Year college marksheet'),
('SY Marksheet',      'Second Year college marksheet'),
('Leaving Certificate','School / College leaving certificate'),
('Caste Certificate', 'Caste certificate from competent authority'),
('Income Certificate','Family income certificate'),
('Migration Certificate', 'Migration certificate from previous institution');

-- ============================================================
-- COLLEGES  (admin_password_hash is placeholder - update to real bcrypt hash)
-- ============================================================
INSERT INTO colleges (name, address, city, phone, email, admin_email, admin_password_hash, bank_account_name, bank_account_number, bank_ifsc, bank_upi_id) VALUES
(
    'Vengurla Education Society College of Arts & Science',
    'Near Bus Stand, College Road',
    'Vengurla',
    '02366-262101',
    'info@vescas.edu.in',
    'admin@vescas.edu.in',
    '$2b$10$placeholder_hash_vescas',
    'VES College',
    '012345678901',
    'SBIN0001234',
    'vescas@sbi'
),
(
    'Konkan College of Commerce',
    'Kankavli Road, Sawantwadi',
    'Sawantwadi',
    '02363-272500',
    'info@konkancom.edu.in',
    'admin@konkancom.edu.in',
    '$2b$10$placeholder_hash_konkan',
    'Konkan Commerce College',
    '098765432109',
    'HDFC0005678',
    'konkancom@hdfc'
),
(
    'Sindhudurg Institute of Technology & Management',
    'Oros Road',
    'Kudal',
    '02362-220100',
    'info@sitm.edu.in',
    'admin@sitm.edu.in',
    '$2b$10$placeholder_hash_sitm',
    'SITM College',
    '111222333444',
    'ICIC0009012',
    'sitm@icici'
);

-- ============================================================
-- COURSES
-- ============================================================
-- VES College (id=1)
INSERT INTO courses (college_id, name, duration_years, category) VALUES
(1, 'BCA',    3, 'grant'),
(1, 'BCom',   3, 'grant'),
(1, 'BSc-IT', 3, 'non-grant');

-- Konkan Commerce (id=2)
INSERT INTO courses (college_id, name, duration_years, category) VALUES
(2, 'BCom',   3, 'grant'),
(2, 'BBA',    3, 'non-grant');

-- SITM (id=3)
INSERT INTO courses (college_id, name, duration_years, category) VALUES
(3, 'BCA',    3, 'non-grant'),
(3, 'BSc-IT', 3, 'non-grant'),
(3, 'BBA',    3, 'non-grant');

-- ============================================================
-- SUBJECTS  (sample for VES BCA - course_id=1)
-- ============================================================
-- BCA FY (year_of_study=1)
INSERT INTO subjects (course_id, year_of_study, name, subject_type, elective_group) VALUES
(1, 1, 'Fundamentals of Computers',          'core',     NULL),
(1, 1, 'Programming in C',                   'core',     NULL),
(1, 1, 'Mathematics I',                      'core',     NULL),
(1, 1, 'Business Communication',             'core',     NULL),
(1, 1, 'Web Design Basics',                  'elective', 'A'),
(1, 1, 'Digital Electronics',                'elective', 'A'),
(1, 1, 'Soft Skills',                        'elective', 'B'),
(1, 1, 'Environmental Studies',              'elective', 'B');

-- BCA SY (year_of_study=2)
INSERT INTO subjects (course_id, year_of_study, name, subject_type, elective_group) VALUES
(1, 2, 'Data Structures',                    'core',     NULL),
(1, 2, 'Object Oriented Programming (Java)', 'core',     NULL),
(1, 2, 'Database Management Systems',        'core',     NULL),
(1, 2, 'Operating Systems',                  'core',     NULL),
(1, 2, 'Networking Fundamentals',            'elective', 'A'),
(1, 2, 'Graphics & Multimedia',              'elective', 'A'),
(1, 2, 'Numerical Methods',                  'elective', 'B'),
(1, 2, 'Python Programming',                 'elective', 'B');

-- BCA TY (year_of_study=3)
INSERT INTO subjects (course_id, year_of_study, name, subject_type, elective_group) VALUES
(1, 3, 'Software Engineering',               'core',     NULL),
(1, 3, 'Advanced Java',                      'core',     NULL),
(1, 3, 'Cloud Computing',                    'core',     NULL),
(1, 3, 'Project Work',                       'core',     NULL),
(1, 3, 'Artificial Intelligence',            'elective', 'A'),
(1, 3, 'Machine Learning',                   'elective', 'A'),
(1, 3, 'Cyber Security',                     'elective', 'B'),
(1, 3, 'Mobile App Development',             'elective', 'B');

-- BCom FY (course_id=2)
INSERT INTO subjects (course_id, year_of_study, name, subject_type, elective_group) VALUES
(2, 1, 'Financial Accounting',               'core',     NULL),
(2, 1, 'Business Economics',                 'core',     NULL),
(2, 1, 'Business Law',                       'core',     NULL),
(2, 1, 'Mathematics & Statistics',           'core',     NULL),
(2, 1, 'Entrepreneurship',                   'elective', 'A'),
(2, 1, 'Computer Applications',              'elective', 'A');

-- BCom SY (course_id=2)
INSERT INTO subjects (course_id, year_of_study, name, subject_type, elective_group) VALUES
(2, 2, 'Cost Accounting',                    'core',     NULL),
(2, 2, 'Corporate Accounting',               'core',     NULL),
(2, 2, 'Auditing',                           'core',     NULL),
(2, 2, 'Income Tax',                         'elective', 'A'),
(2, 2, 'Banking & Insurance',                'elective', 'A');

-- ============================================================
-- FEE STRUCTURES
-- ============================================================
-- VES BCA (college=1, course=1)
INSERT INTO fee_structures (college_id, course_id, year_of_study, category, tuition_fee, exam_fee, other_fee) VALUES
(1, 1, 1, 'grant',     6000.00,  500.00, 300.00),
(1, 1, 2, 'grant',     6000.00,  500.00, 300.00),
(1, 1, 3, 'grant',     6000.00,  500.00, 300.00),
(1, 1, 1, 'non-grant', 18000.00, 500.00, 500.00),
(1, 1, 2, 'non-grant', 18000.00, 500.00, 500.00),
(1, 1, 3, 'non-grant', 18000.00, 500.00, 500.00);

-- VES BCom (college=1, course=2)
INSERT INTO fee_structures (college_id, course_id, year_of_study, category, tuition_fee, exam_fee, other_fee) VALUES
(1, 2, 1, 'grant',     4500.00,  400.00, 250.00),
(1, 2, 2, 'grant',     4500.00,  400.00, 250.00),
(1, 2, 3, 'grant',     4500.00,  400.00, 250.00);

-- VES BSc-IT (college=1, course=3)
INSERT INTO fee_structures (college_id, course_id, year_of_study, category, tuition_fee, exam_fee, other_fee) VALUES
(1, 3, 1, 'non-grant', 22000.00, 600.00, 600.00),
(1, 3, 2, 'non-grant', 22000.00, 600.00, 600.00),
(1, 3, 3, 'non-grant', 22000.00, 600.00, 600.00);

-- Konkan BCom (college=2, course=4)
INSERT INTO fee_structures (college_id, course_id, year_of_study, category, tuition_fee, exam_fee, other_fee) VALUES
(2, 4, 1, 'grant',     5000.00,  450.00, 300.00),
(2, 4, 2, 'grant',     5000.00,  450.00, 300.00),
(2, 4, 3, 'grant',     5000.00,  450.00, 300.00);

-- Konkan BBA (college=2, course=5)
INSERT INTO fee_structures (college_id, course_id, year_of_study, category, tuition_fee, exam_fee, other_fee) VALUES
(2, 5, 1, 'non-grant', 20000.00, 500.00, 500.00),
(2, 5, 2, 'non-grant', 20000.00, 500.00, 500.00),
(2, 5, 3, 'non-grant', 20000.00, 500.00, 500.00);

-- SITM BCA (college=3, course=6)
INSERT INTO fee_structures (college_id, course_id, year_of_study, category, tuition_fee, exam_fee, other_fee) VALUES
(3, 6, 1, 'non-grant', 25000.00, 700.00, 700.00),
(3, 6, 2, 'non-grant', 25000.00, 700.00, 700.00),
(3, 6, 3, 'non-grant', 25000.00, 700.00, 700.00);

-- ============================================================
-- REQUIRED DOCUMENTS (sample for VES BCA FY)
-- ============================================================
-- doc_type ids: Aadhaar=1, Photo=2, 10th=3, 12th=4, FY=5, SY=6, Leaving=7, Caste=8
INSERT INTO required_documents (college_id, course_id, year_of_study, document_type_id, is_mandatory) VALUES
(1, 1, 1, 1, 1),  -- Aadhaar (mandatory)
(1, 1, 1, 2, 1),  -- Passport Photo (mandatory)
(1, 1, 1, 3, 1),  -- 10th Marksheet (mandatory)
(1, 1, 1, 4, 1),  -- 12th Marksheet (mandatory)
(1, 1, 1, 7, 1),  -- Leaving Certificate (mandatory)
(1, 1, 1, 8, 0),  -- Caste Certificate (optional)
(1, 1, 1, 9, 0),  -- Income Certificate (optional)

-- BCA SY
(1, 1, 2, 1, 1),  -- Aadhaar
(1, 1, 2, 2, 1),  -- Photo
(1, 1, 2, 5, 1),  -- FY Marksheet (mandatory for SY)

-- BCA TY
(1, 1, 3, 1, 1),  -- Aadhaar
(1, 1, 3, 2, 1),  -- Photo
(1, 1, 3, 6, 1);  -- SY Marksheet (mandatory for TY)

-- ============================================================
-- ADMISSION PERIODS (for academic year 2026-27)
-- ============================================================
INSERT INTO admission_periods (college_id, course_id, year_of_study, academic_year, start_date, end_date, total_seats, application_fee, is_active) VALUES
-- VES BCA
(1, 1, 1, '2026-27', '2026-05-01', '2026-06-30', 60, 500.00, 1),
(1, 1, 2, '2026-27', '2026-05-01', '2026-06-30', 55, 500.00, 1),
(1, 1, 3, '2026-27', '2026-05-01', '2026-06-30', 50, 500.00, 1),

-- VES BCom
(1, 2, 1, '2026-27', '2026-05-01', '2026-06-30', 80, 300.00, 1),
(1, 2, 2, '2026-27', '2026-05-01', '2026-06-30', 75, 300.00, 1),
(1, 2, 3, '2026-27', '2026-05-01', '2026-06-30', 70, 300.00, 1),

-- VES BSc-IT
(1, 3, 1, '2026-27', '2026-05-01', '2026-06-30', 40, 600.00, 1),

-- Konkan BCom
(2, 4, 1, '2026-27', '2026-05-05', '2026-07-05', 100, 250.00, 1),
(2, 4, 2, '2026-27', '2026-05-05', '2026-07-05', 90,  250.00, 1),

-- Konkan BBA
(2, 5, 1, '2026-27', '2026-05-05', '2026-07-05', 60, 500.00, 1),

-- SITM BCA
(3, 6, 1, '2026-27', '2026-05-10', '2026-07-10', 50, 600.00, 1),
(3, 6, 2, '2026-27', '2026-05-10', '2026-07-10', 45, 600.00, 1),
(3, 6, 3, '2026-27', '2026-05-10', '2026-07-10', 40, 600.00, 1);

-- ============================================================
-- DEMO STUDENT (for testing)
-- password = "Student@123" (replace with bcrypt hash in seeder.js)
-- ============================================================
INSERT INTO students (full_name, email, password_hash, phone, dob, gender, address, city, category) VALUES
(
    'Aarav Shetty',
    'aarav@example.com',
    '$2b$10$placeholder_hash_student',
    '9876543210',
    '2006-03-15',
    'Male',
    '12, Shiv Nagar, Near Temple',
    'Vengurla',
    'general'
);
