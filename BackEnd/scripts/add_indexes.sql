-- ============================================================
-- Performance Indexes
-- Run once against an existing database.
-- All CREATE INDEX statements are safe to re-run (IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- APPLICATIONS
-- Most-queried table; composite indexes for every major
-- access pattern used by college_admin.js and applications.js
-- ============================================================

-- College inbox: list by college + filter by status / course / year
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_applications_college_status' AND object_id=OBJECT_ID('applications'))
    CREATE INDEX ix_applications_college_status
        ON applications (college_id, status)
        INCLUDE (id, student_id, admission_period_id, course_id, year_of_study,
                 academic_year, registration_number, submitted_at, updated_at,
                 app_surname, app_first_name, app_middle_name, app_mobile, app_email,
                 app_category, fees_category, app_division, roll_number);
GO

-- Student portal: fetch all apps for a student
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_applications_student_id' AND object_id=OBJECT_ID('applications'))
    CREATE INDEX ix_applications_student_id
        ON applications (student_id)
        INCLUDE (id, college_id, course_id, year_of_study, academic_year,
                 status, application_fee_paid, registration_number, submitted_at);
GO

-- Duplicate-check on apply: (college_id, course_id, year_of_study, academic_year)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_applications_college_course_year' AND object_id=OBJECT_ID('applications'))
    CREATE INDEX ix_applications_college_course_year
        ON applications (college_id, course_id, year_of_study, academic_year)
        INCLUDE (student_id, status);
GO

-- FK lookups on admission_period_id (seat-count updates)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_applications_period_id' AND object_id=OBJECT_ID('applications'))
    CREATE INDEX ix_applications_period_id
        ON applications (admission_period_id)
        INCLUDE (id, status);
GO

-- Roll-number generation: college + status = 'fees_paid'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_applications_college_rollgen' AND object_id=OBJECT_ID('applications'))
    CREATE INDEX ix_applications_college_rollgen
        ON applications (college_id, status, roll_number)
        INCLUDE (id, academic_year, year_of_study, course_id, status_updated_at);
GO

-- ============================================================
-- PAYMENTS
-- payments has no college_id — looked up only by application_id
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_payments_application_id' AND object_id=OBJECT_ID('payments'))
    CREATE INDEX ix_payments_application_id
        ON payments (application_id, payment_type, status)
        INCLUDE (id, amount, razorpay_order_id, razorpay_payment_id, completed_at);
GO

-- Unique index on razorpay_payment_id to prevent duplicate capture
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='uix_payments_razorpay_payment_id' AND object_id=OBJECT_ID('payments'))
    CREATE UNIQUE INDEX uix_payments_razorpay_payment_id
        ON payments (razorpay_payment_id)
        WHERE razorpay_payment_id IS NOT NULL;
GO

-- ============================================================
-- ADMISSION PERIODS
-- Queried by college + active/open status on every apply page
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_admission_periods_college_active' AND object_id=OBJECT_ID('admission_periods'))
    CREATE INDEX ix_admission_periods_college_active
        ON admission_periods (college_id, is_active, is_disabled, end_date)
        INCLUDE (id, course_id, year_of_study, academic_year,
                 total_seats, filled_seats, start_date);
GO

-- ============================================================
-- FACULTY MASTER (programs)
-- Filtered by college + active on every master-data load
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_faculty_master_college_active' AND object_id=OBJECT_ID('faculty_master'))
    CREATE INDEX ix_faculty_master_college_active
        ON faculty_master (college_id, is_active)
        INCLUDE (code_no, degree_course_code, degree_course_name, duration_years);
GO

-- ============================================================
-- COURSE MASTER
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_course_master_college' AND object_id=OBJECT_ID('course_master'))
    CREATE INDEX ix_course_master_college
        ON course_master (college_id)
        INCLUDE (course_code, course_title, faculty_master_id, is_active);
GO

-- ============================================================
-- GROUP MASTER & GROUP COURSES
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_group_master_college' AND object_id=OBJECT_ID('group_master'))
    CREATE INDEX ix_group_master_college
        ON group_master (college_id)
        INCLUDE (group_code, group_description, faculty_master_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_group_courses_group_id' AND object_id=OBJECT_ID('group_courses'))
    CREATE INDEX ix_group_courses_group_id
        ON group_courses (group_id)
        INCLUDE (course_code, course_title, course_position);
GO

-- ============================================================
-- DIVISION MASTER
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_division_master_college' AND object_id=OBJECT_ID('division_master'))
    CREATE INDEX ix_division_master_college
        ON division_master (college_id)
        INCLUDE (id, name, is_active);
GO

-- ============================================================
-- CLASS MASTER
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_class_master_college' AND object_id=OBJECT_ID('class_master'))
    CREATE INDEX ix_class_master_college
        ON class_master (college_id)
        INCLUDE (id, name, is_active);
GO

-- ============================================================
-- FEES MASTER & CLASSWISE FEES
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_fees_master_college' AND object_id=OBJECT_ID('fees_master'))
    CREATE INDEX ix_fees_master_college
        ON fees_master (college_id)
        INCLUDE (id, academic_year, year_of_study, is_active);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_classwise_fees_college_year' AND object_id=OBJECT_ID('classwise_fees'))
    CREATE INDEX ix_classwise_fees_college_year
        ON classwise_fees (college_id, academic_year, year_of_study)
        INCLUDE (id, category, fees_category, total_fees, pay_now);
GO

-- ============================================================
-- COLLEGE REQUIRED DOCUMENTS
-- Looked up by college on every application form load
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_college_required_docs_college' AND object_id=OBJECT_ID('college_required_documents'))
    CREATE INDEX ix_college_required_docs_college
        ON college_required_documents (college_id)
        INCLUDE (id, document_type_id, is_required, is_active);
GO

-- ============================================================
-- APPLICATION DOCUMENTS
-- Queried by application_id on every review / confirm page
-- Note: file_path lives on student_documents, not here
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_application_documents_app_id' AND object_id=OBJECT_ID('application_documents'))
    CREATE INDEX ix_application_documents_app_id
        ON application_documents (application_id)
        INCLUDE (id, student_document_id, document_type_id, is_verified, verified_at);
GO

-- ============================================================
-- APPLICATION PREVIOUS EXAM
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_app_prev_exam_app_id' AND object_id=OBJECT_ID('application_previous_exam'))
    CREATE INDEX ix_app_prev_exam_app_id
        ON application_previous_exam (application_id);
GO

-- FK column is application_previous_exam_id (not exam_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_app_prev_exam_subjects_exam_id' AND object_id=OBJECT_ID('application_previous_exam_subjects'))
    CREATE INDEX ix_app_prev_exam_subjects_exam_id
        ON application_previous_exam_subjects (application_previous_exam_id);
GO

-- ============================================================
-- APPLICATION ACTIVITY LOG
-- Ordered by application_id + created_at for timeline view
-- Note: no actor_id column — only actor_role
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_app_activity_log_app_id' AND object_id=OBJECT_ID('application_activity_log'))
    CREATE INDEX ix_app_activity_log_app_id
        ON application_activity_log (application_id, created_at)
        INCLUDE (id, action, actor_role, note);
GO

-- ============================================================
-- APPLICATION SUBJECTS
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_application_subjects_app_id' AND object_id=OBJECT_ID('application_subjects'))
    CREATE INDEX ix_application_subjects_app_id
        ON application_subjects (application_id, semester)
        INCLUDE (id, subject_code, subject_title, display_order);
GO

-- ============================================================
-- COLLEGE ROLES & USERS
-- Note: college_users has full_name (not name)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_college_role_permissions_role_id' AND object_id=OBJECT_ID('college_role_permissions'))
    CREATE INDEX ix_college_role_permissions_role_id
        ON college_role_permissions (role_id)
        INCLUDE (permission, can_write);

        
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_college_users_college_id' AND object_id=OBJECT_ID('college_users'))
    CREATE INDEX ix_college_users_college_id
        ON college_users (college_id, is_active)
        INCLUDE (id, role_id, full_name, email);
GO

-- ============================================================
-- STUDENT DOCUMENTS
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_student_documents_student_id' AND object_id=OBJECT_ID('student_documents'))
    CREATE INDEX ix_student_documents_student_id
        ON student_documents (student_id)
        INCLUDE (id, document_type_id, file_path, uploaded_at);
GO

-- ============================================================
-- BANK MASTER
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_bank_master_college' AND object_id=OBJECT_ID('bank_master'))
    CREATE INDEX ix_bank_master_college
        ON bank_master (college_id)
        INCLUDE (id, bank_name, account_number, ifsc_code, is_active);
GO

-- ============================================================
-- OTP STORE
-- Looked up by phone + purpose on every OTP verify
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_otp_store_phone_purpose' AND object_id=OBJECT_ID('otp_store'))
    CREATE INDEX IX_otp_store_phone_purpose
        ON otp_store (phone, purpose)
        INCLUDE (id, otp_hash, pending_data, expires_at, used);
GO

-- ============================================================
-- WHATSAPP MESSAGE LOG
-- Queried by phone, application_id, and date range
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_wamsglog_phone' AND object_id=OBJECT_ID('whatsapp_message_log'))
    CREATE INDEX IX_wamsglog_phone
        ON whatsapp_message_log (phone)
        INCLUDE (id, campaign_name, status, created_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_wamsglog_app' AND object_id=OBJECT_ID('whatsapp_message_log'))
    CREATE INDEX IX_wamsglog_app
        ON whatsapp_message_log (application_id)
        INCLUDE (id, phone, campaign_name, status, created_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_wamsglog_created_at' AND object_id=OBJECT_ID('whatsapp_message_log'))
    CREATE INDEX IX_wamsglog_created_at
        ON whatsapp_message_log (created_at)
        INCLUDE (id, phone, campaign_name, status);
GO
