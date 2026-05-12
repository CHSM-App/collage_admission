-- Migration: allow multiple student_document rows per (student_id, document_type_id)
-- so each application can have its own version of each document.

ALTER TABLE student_documents DROP CONSTRAINT uq_student_doc;
