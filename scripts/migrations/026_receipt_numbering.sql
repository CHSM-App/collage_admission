-- Migration 026: Receipt numbering
-- Adds receipt_no to payments and a receipt_counters table
-- that maintains one sequential counter per (college_id, series, academic_year).
--
-- Series keys:
--   G      → College Fee, Granted division
--   NG     → College Fee, NonGranted division
--   AF     → Application Fee
--   MISC   → Misc Fee
--   EXAM   → Exam Fee
--
-- Format: {SERIES}-{0001}  e.g. G-0001, NG-0042, AF-0007
-- Counter resets each academic year (new row per academic_year).
-- Academic year follows a 1-June cutover:
--   June 1 – May 31  →  "YYYY-YY"  e.g. "2026-27"

-- ── 1. receipt_counters ───────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'receipt_counters'
)
BEGIN
  CREATE TABLE receipt_counters (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    college_id   INT           NOT NULL REFERENCES colleges(id),
    series       NVARCHAR(10)  NOT NULL,   -- 'G','NG','AF','MISC','EXAM'
    academic_year NVARCHAR(10) NOT NULL,   -- e.g. '2026-27'
    last_seq     INT           NOT NULL DEFAULT 0,
    CONSTRAINT uq_receipt_counters UNIQUE (college_id, series, academic_year)
  );
END
GO

-- ── 2. receipt_no column on payments ─────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('payments') AND name = 'receipt_no'
)
BEGIN
  ALTER TABLE payments ADD receipt_no NVARCHAR(20) NULL;
END
GO
