-- Migration 027: Clear all test application & student data
-- Keeps: colleges, courses, divisions, fees, admins, document_types, all config

-- ── Disable audit triggers temporarily ───────────────────────────────────────
DISABLE TRIGGER ALL ON application_activity_log;
DISABLE TRIGGER ALL ON application_documents;
DISABLE TRIGGER ALL ON application_previous_exam;
DISABLE TRIGGER ALL ON payment_link_tokens;
DISABLE TRIGGER ALL ON fee_installments;
DISABLE TRIGGER ALL ON payments;
DISABLE TRIGGER ALL ON whatsapp_message_log;
DISABLE TRIGGER ALL ON applications;
DISABLE TRIGGER ALL ON student_documents;
DISABLE TRIGGER ALL ON students;
DISABLE TRIGGER ALL ON receipt_counters;
DISABLE TRIGGER ALL ON otp_store;
DISABLE TRIGGER ALL ON chatbot_logs;
GO

-- ── 1. Application-dependent tables ──────────────────────────────────────────
DELETE FROM application_activity_log;
DELETE FROM application_documents;
DELETE FROM application_previous_exam;
DELETE FROM payment_link_tokens;
DELETE FROM fee_installments;
DELETE FROM payments;
DELETE FROM whatsapp_message_log;
DELETE FROM applications;
GO

-- ── 2. Student-dependent tables ───────────────────────────────────────────────
DELETE FROM student_documents;
DELETE FROM students;
GO

-- ── 3. Receipt counters (reset sequences) ─────────────────────────────────────
DELETE FROM receipt_counters;
GO

-- ── 4. Misc logs ──────────────────────────────────────────────────────────────
DELETE FROM otp_store;
DELETE FROM chatbot_logs;
GO

-- ── 5. Re-enable audit triggers ───────────────────────────────────────────────
ENABLE TRIGGER ALL ON application_activity_log;
ENABLE TRIGGER ALL ON application_documents;
ENABLE TRIGGER ALL ON application_previous_exam;
ENABLE TRIGGER ALL ON payment_link_tokens;
ENABLE TRIGGER ALL ON fee_installments;
ENABLE TRIGGER ALL ON payments;
ENABLE TRIGGER ALL ON whatsapp_message_log;
ENABLE TRIGGER ALL ON applications;
ENABLE TRIGGER ALL ON student_documents;
ENABLE TRIGGER ALL ON students;
ENABLE TRIGGER ALL ON receipt_counters;
ENABLE TRIGGER ALL ON otp_store;
ENABLE TRIGGER ALL ON chatbot_logs;
GO

-- ── 6. Reset identity seeds ───────────────────────────────────────────────────
DBCC CHECKIDENT ('applications',             RESEED, 0);
DBCC CHECKIDENT ('students',                 RESEED, 0);
DBCC CHECKIDENT ('payments',                 RESEED, 0);
DBCC CHECKIDENT ('receipt_counters',         RESEED, 0);
DBCC CHECKIDENT ('application_activity_log', RESEED, 0);
DBCC CHECKIDENT ('application_documents',    RESEED, 0);
DBCC CHECKIDENT ('student_documents',        RESEED, 0);
DBCC CHECKIDENT ('payment_link_tokens',      RESEED, 0);
DBCC CHECKIDENT ('fee_installments',         RESEED, 0);
DBCC CHECKIDENT ('otp_store',                RESEED, 0);
GO
