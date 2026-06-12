-- Migration 017: Add academic_year to fees_master and classwise_fees
-- Each fee head and each classwise override now belongs to a specific academic year.
-- Existing rows are backfilled to '2026-27'.

-- ── 1. fees_master ────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='fees_master' AND COLUMN_NAME='academic_year'
)
BEGIN
    ALTER TABLE fees_master ADD academic_year NVARCHAR(10) NOT NULL DEFAULT '2026-27'
    PRINT 'fees_master.academic_year added'
END
ELSE
    PRINT 'fees_master.academic_year already exists'
GO

-- ── 2. classwise_fees ─────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='classwise_fees' AND COLUMN_NAME='academic_year'
)
BEGIN
    ALTER TABLE classwise_fees ADD academic_year NVARCHAR(10) NOT NULL DEFAULT '2026-27'
    PRINT 'classwise_fees.academic_year added'
END
ELSE
    PRINT 'classwise_fees.academic_year already exists'
GO

-- ── 3. Drop old unique constraint on classwise_fees and add new one ──
IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'uq_classwise_fees' AND type = 'UQ'
)
BEGIN
    ALTER TABLE classwise_fees DROP CONSTRAINT uq_classwise_fees
    PRINT 'Old uq_classwise_fees constraint dropped'
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'uq_classwise_fees_ay' AND type = 'UQ'
)
BEGIN
    ALTER TABLE classwise_fees ADD CONSTRAINT uq_classwise_fees_ay
        UNIQUE (college_id, faculty_master_id, year_level, fees_code, student_type, academic_year)
    PRINT 'New uq_classwise_fees_ay constraint added'
END
GO
