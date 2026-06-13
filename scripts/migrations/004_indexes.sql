-- ============================================================
-- 004_indexes.sql
-- All performance indexes for the application.
-- Every statement is idempotent (IF NOT EXISTS guard).
-- ============================================================

-- ── APPLICATIONS ─────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_college_status' AND object_id = OBJECT_ID('applications'))
    CREATE INDEX ix_applications_college_status
        ON applications (college_id, status)
        INCLUDE (id, student_id, admission_period_id, course_id, year_of_study,
                 academic_year, registration_number, submitted_at, updated_at,
                 app_surname, app_first_name, app_middle_name, app_mobile, app_email,
                 app_category, fees_category, app_division, roll_number);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_student_id' AND object_id = OBJECT_ID('applications'))
    CREATE INDEX ix_applications_student_id
        ON applications (student_id)
        INCLUDE (id, college_id, course_id, year_of_study, academic_year,
                 status, application_fee_paid, registration_number, submitted_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_college_course_year' AND object_id = OBJECT_ID('applications'))
    CREATE INDEX ix_applications_college_course_year
        ON applications (college_id, course_id, year_of_study, academic_year)
        INCLUDE (student_id, status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_period_id' AND object_id = OBJECT_ID('applications'))
    CREATE INDEX ix_applications_period_id
        ON applications (admission_period_id)
        INCLUDE (id, status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_applications_college_rollgen' AND object_id = OBJECT_ID('applications'))
    CREATE INDEX ix_applications_college_rollgen
        ON applications (college_id, status, roll_number)
        INCLUDE (id, academic_year, year_of_study, course_id, status_updated_at);
GO

-- ── PAYMENTS ─────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_payments_application_id' AND object_id = OBJECT_ID('payments'))
    CREATE INDEX ix_payments_application_id
        ON payments (application_id, payment_type, status)
        INCLUDE (id, amount, razorpay_order_id, razorpay_payment_id, completed_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uix_payments_razorpay_payment_id' AND object_id = OBJECT_ID('payments'))
    CREATE UNIQUE INDEX uix_payments_razorpay_payment_id
        ON payments (razorpay_payment_id)
        WHERE razorpay_payment_id IS NOT NULL;
GO

-- ── ADMISSION PERIODS ─────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_admission_periods_college_active' AND object_id = OBJECT_ID('admission_periods'))
    CREATE INDEX ix_admission_periods_college_active
        ON admission_periods (college_id, is_active, is_disabled, end_date)
        INCLUDE (id, course_id, year_of_study, academic_year,
                 total_seats, filled_seats, start_date);
GO

-- ── FACULTY MASTER ────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_faculty_master_college_active' AND object_id = OBJECT_ID('faculty_master'))
    CREATE INDEX ix_faculty_master_college_active
        ON faculty_master (college_id, is_active)
        INCLUDE (code_no, degree_course_code, degree_course_name, duration_years);
GO

-- ── COURSE MASTER ─────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_course_master_college' AND object_id = OBJECT_ID('course_master'))
    CREATE INDEX ix_course_master_college
        ON course_master (college_id)
        INCLUDE (course_code, course_title, faculty_master_id, is_active);
GO

-- ── GROUP MASTER & GROUP COURSES ──────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_group_master_college' AND object_id = OBJECT_ID('group_master'))
    CREATE INDEX ix_group_master_college
        ON group_master (college_id)
        INCLUDE (group_code, group_description, faculty_master_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_group_courses_group_id' AND object_id = OBJECT_ID('group_courses'))
    CREATE INDEX ix_group_courses_group_id
        ON group_courses (group_id)
        INCLUDE (course_code, course_title, course_position);
GO

-- ── COLLEGE REQUIRED DOCUMENTS ────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_college_required_docs_college' AND object_id = OBJECT_ID('college_required_documents'))
    CREATE INDEX ix_college_required_docs_college
        ON college_required_documents (college_id)
        INCLUDE (id, document_type_id, is_mandatory);
GO

-- ── APPLICATION DOCUMENTS ─────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_application_documents_app_id' AND object_id = OBJECT_ID('application_documents'))
    CREATE INDEX ix_application_documents_app_id
        ON application_documents (application_id)
        INCLUDE (id, student_document_id, document_type_id, is_verified, verified_at);
GO

-- ── APPLICATION PREVIOUS EXAM ─────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_app_prev_exam_app_id' AND object_id = OBJECT_ID('application_previous_exam'))
    CREATE INDEX ix_app_prev_exam_app_id
        ON application_previous_exam (application_id);
GO

-- ── APPLICATION ACTIVITY LOG ──────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_app_activity_log_app_id' AND object_id = OBJECT_ID('application_activity_log'))
    CREATE INDEX ix_app_activity_log_app_id
        ON application_activity_log (application_id, created_at)
        INCLUDE (id, action, actor_role, note);
GO

-- ── APPLICATION SUBJECTS ──────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_application_subjects_app_id' AND object_id = OBJECT_ID('application_subjects'))
    CREATE INDEX ix_application_subjects_app_id
        ON application_subjects (application_id, semester)
        INCLUDE (id, subject_code, subject_title, display_order);
GO

-- ── COLLEGE ROLES & USERS ─────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_college_role_permissions_role_id' AND object_id = OBJECT_ID('college_role_permissions'))
    CREATE INDEX ix_college_role_permissions_role_id
        ON college_role_permissions (role_id)
        INCLUDE (permission, can_write);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_college_users_college_id' AND object_id = OBJECT_ID('college_users'))
    CREATE INDEX ix_college_users_college_id
        ON college_users (college_id, is_active)
        INCLUDE (id, role_id, full_name, email);
GO

-- ── STUDENT DOCUMENTS ─────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_student_documents_student_id' AND object_id = OBJECT_ID('student_documents'))
    CREATE INDEX ix_student_documents_student_id
        ON student_documents (student_id)
        INCLUDE (id, document_type_id, file_path, uploaded_at);
GO

-- ── OTP STORE ─────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_otp_store_phone_purpose' AND object_id = OBJECT_ID('otp_store'))
    CREATE INDEX IX_otp_store_phone_purpose
        ON otp_store (phone, purpose)
        INCLUDE (id, otp_hash, pending_data, expires_at, used);
GO

-- ── WHATSAPP MESSAGE LOG ──────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wamsglog_phone' AND object_id = OBJECT_ID('whatsapp_message_log'))
    CREATE INDEX IX_wamsglog_phone
        ON whatsapp_message_log (phone)
        INCLUDE (id, campaign_name, status, created_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wamsglog_app' AND object_id = OBJECT_ID('whatsapp_message_log'))
    CREATE INDEX IX_wamsglog_app
        ON whatsapp_message_log (application_id)
        INCLUDE (id, phone, campaign_name, status, created_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wamsglog_created_at' AND object_id = OBJECT_ID('whatsapp_message_log'))
    CREATE INDEX IX_wamsglog_created_at
        ON whatsapp_message_log (created_at)
        INCLUDE (id, phone, campaign_name, status);
GO

-- ── CERTIFICATES ──────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_bonafide_reg_no' AND object_id = OBJECT_ID('certificate_bonafide'))
    CREATE INDEX ix_cert_bonafide_reg_no
        ON certificate_bonafide (college_id, reg_no);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_character_reg_no' AND object_id = OBJECT_ID('certificate_character'))
    CREATE INDEX ix_cert_character_reg_no
        ON certificate_character (college_id, reg_no);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_noc_reg_no' AND object_id = OBJECT_ID('certificate_noc'))
    CREATE INDEX ix_cert_noc_reg_no
        ON certificate_noc (college_id, reg_no);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cert_noc_prn_no' AND object_id = OBJECT_ID('certificate_noc'))
    CREATE INDEX ix_cert_noc_prn_no
        ON certificate_noc (college_id, prn_no);
GO
