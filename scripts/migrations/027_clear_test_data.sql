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
-- ⚠️  Use `DBCC CHECKIDENT (t, RESEED)` (no value), NOT `RESEED, 0`.
--
-- On an EMPTY table, `RESEED, 0` makes the next inserted id **0** — not 1. SQL
-- Server only adds the increment to the seed when rows already exist. An id of 0
-- is a landmine in JS (`0` is falsy), so `if (!student_id)` wrongly reports a
-- supplied id as "missing" — which broke the student application form.
--
-- The no-value form resets the seed to the table's original definition (1), so the
-- next insert correctly gets id 1.
DBCC CHECKIDENT ('applications',             RESEED);
DBCC CHECKIDENT ('students',                 RESEED);
DBCC CHECKIDENT ('payments',                 RESEED);
DBCC CHECKIDENT ('receipt_counters',         RESEED);
DBCC CHECKIDENT ('application_activity_log', RESEED);
DBCC CHECKIDENT ('application_documents',    RESEED);
DBCC CHECKIDENT ('student_documents',        RESEED);
DBCC CHECKIDENT ('payment_link_tokens',      RESEED);
DBCC CHECKIDENT ('fee_installments',         RESEED);
DBCC CHECKIDENT ('otp_store',                RESEED);
GO
