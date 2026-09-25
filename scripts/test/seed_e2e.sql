-- ============================================================
-- seed_e2e.sql — Test data for E2E (Playwright) tests.
--
-- Creates a complete, self-contained dataset:
--   1.  Super admin account
--   2.  Test college + college admin login
--   3.  College master data (program, bank, division, course, fees, documents)
--   4.  Admission period (open, with seats)
--   5.  Test student account
--   6.  One application per status (draft, submitted, confirmed, rejected)
--   7.  Payment records matching the submitted/confirmed applications
--
-- ALL scripts are idempotent — safe to re-run at any time.
-- Running this again will NOT create duplicates.
--
-- Passwords used (bcrypt hash of the literal value shown):
--   Super Admin  : Admin@1234
--   College Admin: Admin@1234
--   Student      : Test@1234
--
-- Regenerate hashes if needed:
--   node -e "require('bcryptjs').hash('Admin@1234',10).then(console.log)"
-- ============================================================


-- ============================================================
-- 1. SUPER ADMIN
-- email    : vtadmin@test.com
-- password : Admin@1234
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM admins WHERE email = 'vtadmin@test.com')
    INSERT INTO admins (name, email, password_hash)
    VALUES (
        'E2E Super Admin',
        'vtadmin@test.com',
        '$2a$10$EGr5K78oBpWTx7XanyflRe0UwMLihgKBlB1Y1JAe37/yTPRthmGq.'
        -- bcrypt hash of: Admin@1234
    );
GO


-- ============================================================
-- 2. TEST COLLEGE
-- admin_email   : admin@testcollege.edu
-- admin_password: Admin@1234
-- college_code  : TC001
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM colleges WHERE admin_email = 'admin@testcollege.edu')
    INSERT INTO colleges (
        name,
        address,
        city,
        phone,
        email,
        admin_email,
        admin_password_hash,
        college_code,
        application_fee,
        bank_account_name,
        bank_account_number,
        bank_ifsc,
        bank_upi_id,
        is_enabled
    )
    VALUES (
        'Test College of Commerce',
        'At Post Vengurla, Tal Vengurla',
        'Vengurla',
        '9876500000',
        'info@testcollege.edu',
        'admin@testcollege.edu',
        '$2a$10$EGr5K78oBpWTx7XanyflRe0UwMLihgKBlB1Y1JAe37/yTPRthmGq.',
        -- bcrypt hash of: Admin@1234
        'TC001',
        500.00,
        'Test College of Commerce',
        '1234567890',
        'SBIN0001234',
        'testcollege@upi',
        1
    );
GO

-- Capture the college ID for use in subsequent inserts
DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');


-- ============================================================
-- 3. COLLEGE MASTER DATA
-- ============================================================

-- ── 3a. Bank Master ──────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM bank_master
    WHERE college_id = @college_id AND bank_account_number = '1234567890'
)
    INSERT INTO bank_master (college_id, bank_account_number, bank_name, branch, ifsc_code, account_type, is_active)
    VALUES (@college_id, '1234567890', 'State Bank of India', 'Vengurla', 'SBIN0001234', 'Savings', 1);
GO

-- ── 3b. Faculty Master (Programs) ────────────────────────────
DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');

IF NOT EXISTS (
    SELECT 1 FROM faculty_master
    WHERE college_id = @college_id AND degree_course_code = 'BCOM'
)
    INSERT INTO faculty_master (
        college_id, degree_course_code, degree_course_name,
        duration_years, is_active, created_by
    )
    VALUES (
        @college_id, 'BCOM', 'Bachelor of Commerce',
        3, 1, 'e2e_seed'
    );
GO

DECLARE @college_id INT    = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @faculty_id INT    = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @bank_id    INT    = (SELECT ledger_code FROM bank_master WHERE college_id = @college_id AND bank_account_number = '1234567890');

-- ── 3c. Division Master ───────────────────────────────────────
-- FY Division A (Granted) — students in this division get government fee concessions
IF NOT EXISTS (
    SELECT 1 FROM division_master
    WHERE college_id = @college_id AND faculty_master_id = @faculty_id
      AND year_level = 'FY' AND division_letter = 'A'
)
    INSERT INTO division_master (
        college_id, faculty_master_id, year_level, division_letter, funding_type, is_active
    )
    VALUES (@college_id, @faculty_id, 'FY', 'A', 'Granted', 1);
GO

-- ── 3d. Fees Master ───────────────────────────────────────────
DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @bank_id    INT = (SELECT ledger_code FROM bank_master WHERE college_id = @college_id AND bank_account_number = '1234567890');

-- Tuition Fee
IF NOT EXISTS (
    SELECT 1 FROM fees_master
    WHERE college_id = @college_id AND fees_head = 'Tuition Fee'
)
    INSERT INTO fees_master (
        college_id, fees_type, is_other_misc, fees_head, short_name,
        sequence_auto_fees, credit_to_bank_ledger, is_refundable,
        fees_cat1_amount, fees_cat2_amount, fees_cat3_amount, fees_cat4_amount,
        is_active
    )
    VALUES (
        @college_id, 'Tuition', 0, 'Tuition Fee', 'TF',
        1, @bank_id, 1,
        -- Cat1=Open/General, Cat2=EBC/STC, Cat3=SC/ST/OBC, Cat4=PH/FF
        15000.00, 12000.00, 0.00, 5000.00,
        1
    );
GO

DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @bank_id    INT = (SELECT ledger_code FROM bank_master WHERE college_id = @college_id AND bank_account_number = '1234567890');

-- Exam Fee
IF NOT EXISTS (
    SELECT 1 FROM fees_master
    WHERE college_id = @college_id AND fees_head = 'Exam Fee'
)
    INSERT INTO fees_master (
        college_id, fees_type, is_other_misc, fees_head, short_name,
        sequence_auto_fees, credit_to_bank_ledger, is_refundable,
        fees_cat1_amount, fees_cat2_amount, fees_cat3_amount, fees_cat4_amount,
        is_active
    )
    VALUES (
        @college_id, 'Exam', 0, 'Exam Fee', 'EF',
        2, @bank_id, 0,
        3000.00, 3000.00, 3000.00, 3000.00,
        1
    );
GO

DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @bank_id    INT = (SELECT ledger_code FROM bank_master WHERE college_id = @college_id AND bank_account_number = '1234567890');

-- Library Fee
IF NOT EXISTS (
    SELECT 1 FROM fees_master
    WHERE college_id = @college_id AND fees_head = 'Library Fee'
)
    INSERT INTO fees_master (
        college_id, fees_type, is_other_misc, fees_head, short_name,
        sequence_auto_fees, credit_to_bank_ledger, is_refundable,
        fees_cat1_amount, fees_cat2_amount, fees_cat3_amount, fees_cat4_amount,
        is_active
    )
    VALUES (
        @college_id, 'Library', 0, 'Library Fee', 'LF',
        3, @bank_id, 0,
        500.00, 500.00, 500.00, 500.00,
        1
    );
GO

-- ── 3e. Course Master (Subjects) ─────────────────────────────
DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @faculty_id INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');

IF NOT EXISTS (
    SELECT 1 FROM course_master
    WHERE college_id = @college_id AND faculty_master_id = @faculty_id
      AND semester = 1 AND course_code = 'BCM101'
)
    INSERT INTO course_master (
        college_id, faculty_master_id, semester,
        course_code, course_title, credits,
        max_internal, min_internal, max_sem_end, min_sem_end, max_total, min_total,
        subject_type, display_order, is_active
    )
    VALUES
    (@college_id, @faculty_id, 1, 'BCM101', 'Financial Accounting', 4, 20, 8, 80, 32, 100, 40, 'core', 1, 1),
    (@college_id, @faculty_id, 1, 'BCM102', 'Business Economics',   4, 20, 8, 80, 32, 100, 40, 'core', 2, 1),
    (@college_id, @faculty_id, 1, 'BCM103', 'Business Mathematics', 4, 20, 8, 80, 32, 100, 40, 'core', 3, 1),
    (@college_id, @faculty_id, 1, 'BCM104', 'Business Communication',3,20, 8, 80, 32, 100, 40, 'core', 4, 1);
GO

-- ── 3f. Required Documents ────────────────────────────────────
DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @faculty_id INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');

-- Mandatory: Aadhaar Card
IF NOT EXISTS (
    SELECT 1 FROM college_required_documents
    WHERE college_id = @college_id AND faculty_master_id = @faculty_id
      AND year_of_study = 1
      AND document_type_id = (SELECT id FROM document_types WHERE name = 'Aadhaar Card')
)
    INSERT INTO college_required_documents (college_id, faculty_master_id, year_of_study, document_type_id, is_mandatory)
    VALUES (
        @college_id, @faculty_id, 1,
        (SELECT id FROM document_types WHERE name = 'Aadhaar Card'), 1
    );
GO

DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @faculty_id INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');

-- Mandatory: Passport Photo
IF NOT EXISTS (
    SELECT 1 FROM college_required_documents
    WHERE college_id = @college_id AND faculty_master_id = @faculty_id
      AND year_of_study = 1
      AND document_type_id = (SELECT id FROM document_types WHERE name = 'Passport Photo')
)
    INSERT INTO college_required_documents (college_id, faculty_master_id, year_of_study, document_type_id, is_mandatory)
    VALUES (
        @college_id, @faculty_id, 1,
        (SELECT id FROM document_types WHERE name = 'Passport Photo'), 1
    );
GO

DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @faculty_id INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');

-- Mandatory: 12th Marksheet
IF NOT EXISTS (
    SELECT 1 FROM college_required_documents
    WHERE college_id = @college_id AND faculty_master_id = @faculty_id
      AND year_of_study = 1
      AND document_type_id = (SELECT id FROM document_types WHERE name = '12th Marksheet')
)
    INSERT INTO college_required_documents (college_id, faculty_master_id, year_of_study, document_type_id, is_mandatory)
    VALUES (
        @college_id, @faculty_id, 1,
        (SELECT id FROM document_types WHERE name = '12th Marksheet'), 1
    );
GO

DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @faculty_id INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');

-- Optional: Caste Certificate
IF NOT EXISTS (
    SELECT 1 FROM college_required_documents
    WHERE college_id = @college_id AND faculty_master_id = @faculty_id
      AND year_of_study = 1
      AND document_type_id = (SELECT id FROM document_types WHERE name = 'Caste Certificate')
)
    INSERT INTO college_required_documents (college_id, faculty_master_id, year_of_study, document_type_id, is_mandatory)
    VALUES (
        @college_id, @faculty_id, 1,
        (SELECT id FROM document_types WHERE name = 'Caste Certificate'), 0
    );
GO


-- ============================================================
-- 4. ADMISSION PERIOD (open, 50 seats available)
-- ============================================================
DECLARE @college_id INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @faculty_id INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');

IF NOT EXISTS (
    SELECT 1 FROM admission_periods
    WHERE college_id = @college_id AND course_id = @faculty_id
      AND year_of_study = 1 AND academic_year = '2025-26'
)
    INSERT INTO admission_periods (
        college_id, course_id, year_of_study, academic_year,
        start_date, end_date, total_seats, filled_seats,
        is_active, is_disabled
    )
    VALUES (
        @college_id, @faculty_id, 1, '2025-26',
        '2025-06-01', '2027-03-31', 50, 0,
        1, 0
    );
GO


-- ============================================================
-- 5. TEST STUDENT ACCOUNT
-- phone   : 9000000001
-- password: Test@1234
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM students WHERE phone = '9000000001')
    INSERT INTO students (full_name, email, password_hash, phone, dob, gender, city, category)
    VALUES (
        'Test Student One',
        'teststudent001@example.com',
        '$2a$10$luUDTGoZHOtUPUQEuH7o7.aeS72Z/LYpjS127MgYvKGJebKM01Xaa',
        -- bcrypt hash of: Test@1234
        '9000000001',
        '2001-06-15',
        'Male',
        'Vengurla',
        'OBC'
    );
GO


-- ============================================================
-- 6. SAMPLE APPLICATIONS (one per key status)
-- These let E2E tests verify status-based UI without
-- having to run the full workflow each time.
-- ============================================================

DECLARE @college_id  INT = (SELECT id FROM colleges  WHERE admin_email = 'admin@testcollege.edu');
DECLARE @student_id  INT = (SELECT id FROM students  WHERE phone = '9000000001');
DECLARE @faculty_id  INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @period_id   INT = (SELECT id FROM admission_periods WHERE college_id = @college_id AND course_id = @faculty_id AND academic_year = '2025-26');


-- ── 6a. Draft (form started, not yet paid) ───────────────────
IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = @student_id AND college_id = @college_id
      AND status = 'draft' AND academic_year = '2025-26'
)
    INSERT INTO applications (
        student_id, college_id, course_id, year_of_study, academic_year, admission_period_id,
        status, current_step,
        app_surname, app_first_name, app_middle_name, app_sex,
        app_mobile, app_email,
        app_address, app_taluka, app_district, app_state,
        app_category, app_division, app_degree_course_code
    )
    VALUES (
        @student_id, @college_id, @faculty_id, 1, '2025-26', @period_id,
        'draft', 1,
        'Student', 'Test', 'One', 'Male',
        '9000000001', 'teststudent001@example.com',
        'At Post Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'OBC', 'A', 'BCOM'
    );
ELSE
    -- Reset draft to step 1 so wizard tests always start at the beginning
    UPDATE applications
    SET current_step = 1
    WHERE student_id = @student_id AND college_id = @college_id
      AND status = 'draft' AND academic_year = '2025-26';
GO


-- ── 6b. Submitted (platform fee paid, awaiting college review) ─
DECLARE @college_id  INT = (SELECT id FROM colleges  WHERE admin_email = 'admin@testcollege.edu');
DECLARE @student_id  INT = (SELECT id FROM students  WHERE phone = '9000000001');
DECLARE @faculty_id  INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @period_id   INT = (SELECT id FROM admission_periods WHERE college_id = @college_id AND course_id = @faculty_id AND academic_year = '2025-26');

IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = @student_id AND college_id = @college_id
      AND status = 'submitted' AND academic_year = '2025-26'
)
BEGIN
    INSERT INTO applications (
        registration_number,
        student_id, college_id, course_id, year_of_study, academic_year, admission_period_id,
        status, current_step,
        application_fee_paid,
        submitted_at,
        -- Personal details (Step 1)
        app_surname, app_first_name, app_middle_name, app_mother_name, app_sex,
        app_mobile, app_email,
        app_address, app_taluka, app_district, app_state,
        app_category, fees_category, app_division, app_degree_course_code,
        -- Other details (Step 2)
        app_birth_date, app_birth_place, app_birth_taluka, app_birth_district, app_birth_state,
        app_nationality, app_religion, app_caste, app_marital_status, app_mother_tongue,
        app_father_full_name, app_father_occupation, app_annual_income,
        app_aadhaar,
        app_bank_account, app_bank_ifsc, app_bank_name, app_bank_branch,
        -- Declaration
        declaration_accepted_at
    )
    VALUES (
        'REG-2025-0001',
        @student_id, @college_id, @faculty_id, 1, '2025-26', @period_id,
        'submitted', 6,
        1,
        GETDATE(),
        'Student', 'Test', 'One', 'Sunita Student', 'Male',
        '9000000001', 'teststudent001@example.com',
        'At Post Vengurla, Tal Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'OBC', 'Cat-3', 'A', 'BCOM',
        '2001-06-15', 'Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'Indian', 'Hindu', 'Kunbi', 'Single', 'Marathi',
        'Rajesh Student', 'Farmer', 80000.00,
        '123456789012',
        '9876543210', 'SBIN0001234', 'State Bank of India', 'Vengurla',
        GETDATE()
    );

    -- Log the submission activity
    DECLARE @app_id INT = SCOPE_IDENTITY();
    INSERT INTO application_activity_log (application_id, action, actor_role, note)
    VALUES (@app_id, 'submitted', 'student', 'Application submitted after platform fee payment.');
END
GO


-- ── 6c. Confirmed (college confirmed, fee set, awaiting student payment) ─
DECLARE @college_id  INT = (SELECT id FROM colleges  WHERE admin_email = 'admin@testcollege.edu');
DECLARE @student_id  INT = (SELECT id FROM students  WHERE phone = '9000000001');
DECLARE @faculty_id  INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @period_id   INT = (SELECT id FROM admission_periods WHERE college_id = @college_id AND course_id = @faculty_id AND academic_year = '2025-26');

IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = @student_id AND college_id = @college_id
      AND status = 'confirmed' AND academic_year = '2025-26'
)
BEGIN
    INSERT INTO applications (
        registration_number,
        student_id, college_id, course_id, year_of_study, academic_year, admission_period_id,
        status, current_step,
        application_fee_paid,
        fee_total_amount, fee_pay_now_amount,
        submitted_at, approved_at, confirmed_at,
        app_surname, app_first_name, app_middle_name, app_mother_name, app_sex,
        app_mobile, app_email,
        app_address, app_taluka, app_district, app_state,
        app_category, fees_category, app_division, app_degree_course_code,
        app_birth_date, app_nationality, app_religion, app_caste, app_marital_status,
        app_father_full_name, app_aadhaar, app_bank_account, app_bank_ifsc, app_bank_name,
        declaration_accepted_at
    )
    VALUES (
        'REG-2025-0002',
        @student_id, @college_id, @faculty_id, 1, '2025-26', @period_id,
        'confirmed', 6,
        1,
        18500.00, 18500.00,
        DATEADD(DAY, -5, GETDATE()), DATEADD(DAY, -3, GETDATE()), DATEADD(DAY, -1, GETDATE()),
        'Student', 'Test', 'One', 'Sunita Student', 'Male',
        '9000000001', 'teststudent001@example.com',
        'At Post Vengurla, Tal Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'OBC', 'Cat-3', 'A', 'BCOM',
        '2001-06-15', 'Indian', 'Hindu', 'Kunbi', 'Single',
        'Rajesh Student', '123456789012', '9876543210', 'SBIN0001234', 'State Bank of India',
        DATEADD(DAY, -5, GETDATE())
    );

    DECLARE @conf_app_id INT = SCOPE_IDENTITY();
    INSERT INTO application_activity_log (application_id, action, actor_role, note)
    VALUES
        (@conf_app_id, 'submitted',         'student', 'Application submitted.'),
        (@conf_app_id, 'under_review',       'college', 'Application opened for review.'),
        (@conf_app_id, 'scrutiny_accepted',  'college', 'Scrutiny accepted.'),
        (@conf_app_id, 'doc_verified',       'college', 'Documents verified.'),
        (@conf_app_id, 'confirmed',          'college', 'Admission confirmed. Fee set to ₹18,500.');

    -- Platform fee payment record
    INSERT INTO payments (
        application_id, payment_type, amount,
        razorpay_order_id, razorpay_payment_id,
        status, paid_by, paid_by_user_id, completed_at
    )
    VALUES (
        @conf_app_id, 'application_fee', 500.00,
        'order_E2ETEST0002A', 'pay_E2ETEST0002A',
        'success', 'student', @student_id, DATEADD(DAY, -5, GETDATE())
    );
END
GO


-- ── 6d. Rejected (college rejected with reason) ──────────────
DECLARE @college_id  INT = (SELECT id FROM colleges  WHERE admin_email = 'admin@testcollege.edu');
DECLARE @student_id  INT = (SELECT id FROM students  WHERE phone = '9000000001');
DECLARE @faculty_id  INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @period_id   INT = (SELECT id FROM admission_periods WHERE college_id = @college_id AND course_id = @faculty_id AND academic_year = '2025-26');

IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = @student_id AND college_id = @college_id
      AND status = 'rejected' AND academic_year = '2025-26'
)
BEGIN
    INSERT INTO applications (
        registration_number,
        student_id, college_id, course_id, year_of_study, academic_year, admission_period_id,
        status, current_step,
        application_fee_paid,
        rejection_reason,
        submitted_at,
        app_surname, app_first_name, app_sex,
        app_mobile, app_email,
        app_address, app_taluka, app_district, app_state,
        app_category, fees_category, app_division, app_degree_course_code,
        app_birth_date, declaration_accepted_at
    )
    VALUES (
        'REG-2025-0003',
        @student_id, @college_id, @faculty_id, 1, '2025-26', @period_id,
        'rejected', 6,
        1,
        'Seats not available in the OBC category for FY BCom 2025-26.',
        DATEADD(DAY, -10, GETDATE()),
        'Student', 'Test', 'Male',
        '9000000001', 'teststudent001@example.com',
        'At Post Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'OBC', 'Cat-3', 'A', 'BCOM',
        '2001-06-15', DATEADD(DAY, -10, GETDATE())
    );

    DECLARE @rej_app_id INT = SCOPE_IDENTITY();
    INSERT INTO application_activity_log (application_id, action, actor_role, note)
    VALUES
        (@rej_app_id, 'submitted', 'student', 'Application submitted.'),
        (@rej_app_id, 'rejected',  'college', 'Seats not available in OBC category.');

    -- Platform fee payment record for the rejected app
    INSERT INTO payments (
        application_id, payment_type, amount,
        razorpay_order_id, razorpay_payment_id,
        status, paid_by, paid_by_user_id, completed_at
    )
    VALUES (
        @rej_app_id, 'application_fee', 500.00,
        'order_E2ETEST0003A', 'pay_E2ETEST0003A',
        'success', 'student', @student_id, DATEADD(DAY, -10, GETDATE())
    );
END
GO


-- ── 6e. Correction Requested ──────────────────────────────────
DECLARE @college_id  INT = (SELECT id FROM colleges  WHERE admin_email = 'admin@testcollege.edu');
DECLARE @student_id  INT = (SELECT id FROM students  WHERE phone = '9000000001');
DECLARE @faculty_id  INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @period_id   INT = (SELECT id FROM admission_periods WHERE college_id = @college_id AND course_id = @faculty_id AND academic_year = '2025-26');

IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = @student_id AND college_id = @college_id
      AND status = 'correction_requested' AND academic_year = '2025-26'
)
BEGIN
    INSERT INTO applications (
        registration_number,
        student_id, college_id, course_id, year_of_study, academic_year, admission_period_id,
        status, current_step,
        application_fee_paid,
        correction_note,
        submitted_at,
        app_surname, app_first_name, app_sex,
        app_mobile, app_email,
        app_address, app_taluka, app_district, app_state,
        app_category, fees_category, app_division, app_degree_course_code,
        app_birth_date, declaration_accepted_at
    )
    VALUES (
        'REG-2025-0004',
        @student_id, @college_id, @faculty_id, 1, '2025-26', @period_id,
        'correction_requested', 6,
        1,
        'Please upload a clear, readable copy of your 12th marksheet. The uploaded document is blurry and cannot be verified.',
        DATEADD(DAY, -2, GETDATE()),
        'Student', 'Test', 'Male',
        '9000000001', 'teststudent001@example.com',
        'At Post Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'OBC', 'Cat-3', 'A', 'BCOM',
        '2001-06-15', DATEADD(DAY, -2, GETDATE())
    );

    DECLARE @corr_app_id INT = SCOPE_IDENTITY();
    INSERT INTO application_activity_log (application_id, action, actor_role, note)
    VALUES
        (@corr_app_id, 'submitted',            'student', 'Application submitted.'),
        (@corr_app_id, 'under_review',          'college', 'Application opened for review.'),
        (@corr_app_id, 'correction_requested',  'college', 'Correction requested: 12th marksheet is blurry.');

    INSERT INTO payments (
        application_id, payment_type, amount,
        razorpay_order_id, razorpay_payment_id,
        status, paid_by, paid_by_user_id, completed_at
    )
    VALUES (
        @corr_app_id, 'application_fee', 500.00,
        'order_E2ETEST0004A', 'pay_E2ETEST0004A',
        'success', 'student', @student_id, DATEADD(DAY, -2, GETDATE())
    );
END
GO


-- ── 6f. Fees Paid (college fee paid, awaiting roll number) ────
DECLARE @college_id  INT = (SELECT id FROM colleges  WHERE admin_email = 'admin@testcollege.edu');
DECLARE @student_id  INT = (SELECT id FROM students  WHERE phone = '9000000001');
DECLARE @faculty_id  INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @period_id   INT = (SELECT id FROM admission_periods WHERE college_id = @college_id AND course_id = @faculty_id AND academic_year = '2025-26');

IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = @student_id AND college_id = @college_id
      AND status = 'fees_paid' AND academic_year = '2025-26'
)
BEGIN
    INSERT INTO applications (
        registration_number,
        student_id, college_id, course_id, year_of_study, academic_year, admission_period_id,
        status, current_step,
        application_fee_paid, college_fee_paid,
        fee_total_amount, fee_pay_now_amount,
        submitted_at, confirmed_at,
        app_surname, app_first_name, app_sex,
        app_mobile, app_email,
        app_address, app_taluka, app_district, app_state,
        app_category, fees_category, app_division, app_degree_course_code,
        app_birth_date, declaration_accepted_at
    )
    VALUES (
        'REG-2025-0005',
        @student_id, @college_id, @faculty_id, 1, '2025-26', @period_id,
        'fees_paid', 6,
        1, 1,
        18500.00, 18500.00,
        DATEADD(DAY, -15, GETDATE()), DATEADD(DAY, -7, GETDATE()),
        'Student', 'Test', 'Male',
        '9000000001', 'teststudent001@example.com',
        'At Post Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'OBC', 'Cat-3', 'A', 'BCOM',
        '2001-06-15', DATEADD(DAY, -15, GETDATE())
    );

    DECLARE @paid_app_id INT = SCOPE_IDENTITY();
    INSERT INTO application_activity_log (application_id, action, actor_role, note)
    VALUES
        (@paid_app_id, 'submitted',  'student', 'Application submitted.'),
        (@paid_app_id, 'confirmed',  'college', 'Admission confirmed. Fee set to ₹18,500.'),
        (@paid_app_id, 'fees_paid',  'system',  'College fee payment received.');

    -- Platform fee payment
    INSERT INTO payments (
        application_id, payment_type, amount,
        razorpay_order_id, razorpay_payment_id,
        status, paid_by, paid_by_user_id, completed_at
    )
    VALUES (
        @paid_app_id, 'application_fee', 500.00,
        'order_E2ETEST0005A', 'pay_E2ETEST0005A',
        'success', 'student', @student_id, DATEADD(DAY, -15, GETDATE())
    );

    -- College fee payment
    INSERT INTO payments (
        application_id, payment_type, amount,
        razorpay_order_id, razorpay_payment_id,
        status, paid_by, paid_by_user_id, completed_at
    )
    VALUES (
        @paid_app_id, 'college_fee', 18500.00,
        'order_E2ETEST0005B', 'pay_E2ETEST0005B',
        'success', 'student', @student_id, DATEADD(DAY, -7, GETDATE())
    );
END
GO


-- ============================================================
-- 7. SECOND TEST STUDENT (for IDOR tests)
-- Phone   : 9000000002
-- Password: Test@1234
-- E2E security tests verify student 1 cannot access student 2's data
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM students WHERE phone = '9000000002')
    INSERT INTO students (full_name, email, password_hash, phone, dob, gender, city, category)
    VALUES (
        'Test Student Two',
        'teststudent002@example.com',
        '$2a$10$luUDTGoZHOtUPUQEuH7o7.aeS72Z/LYpjS127MgYvKGJebKM01Xaa',
        -- bcrypt hash of: Test@1234
        '9000000002',
        '2002-03-20',
        'Female',
        'Vengurla',
        'General'
    );
GO

-- Application for student 2 (used in IDOR tests — student 1 must NOT be able to access this)
DECLARE @college_id   INT = (SELECT id FROM colleges WHERE admin_email = 'admin@testcollege.edu');
DECLARE @student2_id  INT = (SELECT id FROM students WHERE phone = '9000000002');
DECLARE @faculty_id   INT = (SELECT code_no FROM faculty_master WHERE college_id = @college_id AND degree_course_code = 'BCOM');
DECLARE @period_id    INT = (SELECT id FROM admission_periods WHERE college_id = @college_id AND course_id = @faculty_id AND academic_year = '2025-26');

IF NOT EXISTS (
    SELECT 1 FROM applications
    WHERE student_id = @student2_id AND college_id = @college_id AND academic_year = '2025-26'
)
    INSERT INTO applications (
        registration_number,
        student_id, college_id, course_id, year_of_study, academic_year, admission_period_id,
        status, current_step, application_fee_paid,
        submitted_at,
        app_surname, app_first_name, app_sex,
        app_mobile, app_email,
        app_address, app_taluka, app_district, app_state,
        app_category, fees_category, app_division, app_degree_course_code,
        app_birth_date, declaration_accepted_at
    )
    VALUES (
        'REG-2025-0010',
        @student2_id, @college_id, @faculty_id, 1, '2025-26', @period_id,
        'submitted', 6, 1,
        DATEADD(DAY, -1, GETDATE()),
        'Student', 'Two', 'Female',
        '9000000002', 'teststudent002@example.com',
        'Vengurla', 'Vengurla', 'Sindhudurg', 'Maharashtra',
        'General', 'Cat-1', 'A', 'BCOM',
        '2002-03-20', DATEADD(DAY, -1, GETDATE())
    );
GO


-- ============================================================
-- 8. VERIFICATION QUERIES
-- Run these after seeding to confirm data is correct.
-- ============================================================
/*
SELECT 'admins'              AS tbl, COUNT(*) AS rows FROM admins               WHERE email = 'vtadmin@test.com'        UNION ALL
SELECT 'colleges',                   COUNT(*)         FROM colleges              WHERE admin_email = 'admin@testcollege.edu' UNION ALL
SELECT 'students',                   COUNT(*)         FROM students              WHERE phone IN ('9000000001','9000000002') UNION ALL
SELECT 'faculty_master',             COUNT(*)         FROM faculty_master        WHERE degree_course_code = 'BCOM' UNION ALL
SELECT 'bank_master',                COUNT(*)         FROM bank_master           WHERE bank_account_number = '1234567890' UNION ALL
SELECT 'division_master',            COUNT(*)         FROM division_master       WHERE division_letter = 'A' AND year_level = 'FY' UNION ALL
SELECT 'fees_master',                COUNT(*)         FROM fees_master           WHERE fees_head IN ('Tuition Fee','Exam Fee','Library Fee') UNION ALL
SELECT 'course_master',              COUNT(*)         FROM course_master         WHERE semester = 1 AND course_code LIKE 'BCM1%' UNION ALL
SELECT 'college_required_documents', COUNT(*)         FROM college_required_documents UNION ALL
SELECT 'admission_periods',          COUNT(*)         FROM admission_periods     WHERE academic_year = '2025-26' UNION ALL
SELECT 'applications',               COUNT(*)         FROM applications          WHERE academic_year = '2025-26' UNION ALL
SELECT 'payments',                   COUNT(*)         FROM payments;
*/
