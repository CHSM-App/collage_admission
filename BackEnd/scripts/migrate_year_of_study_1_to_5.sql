-- Migration: relax year_of_study CHECK constraints from (1,2,3) to (1,2,3,4,5)
-- Run once against db_admission_dummy (and any other target databases).
-- Safe to re-run — each block checks for the constraint before dropping it.

-- ── 1. college_required_documents ────────────────────────────────────────────
DECLARE @crd NVARCHAR(256)
SELECT @crd = name
FROM   sys.check_constraints
WHERE  parent_object_id = OBJECT_ID('admission_dummy.college_required_documents')
  AND  definition LIKE '%year_of_study%'
IF @crd IS NOT NULL
    EXEC('ALTER TABLE admission_dummy.college_required_documents DROP CONSTRAINT [' + @crd + ']')
ALTER TABLE admission_dummy.college_required_documents
    ADD CONSTRAINT CK_college_required_documents_year
    CHECK (year_of_study IN (1,2,3,4,5))
GO

-- ── 2. class_master ───────────────────────────────────────────────────────────
DECLARE @cm NVARCHAR(256)
SELECT @cm = name
FROM   sys.check_constraints
WHERE  parent_object_id = OBJECT_ID('admission_dummy.class_master')
  AND  definition LIKE '%year_of_study%'
IF @cm IS NOT NULL
    EXEC('ALTER TABLE admission_dummy.class_master DROP CONSTRAINT [' + @cm + ']')
ALTER TABLE admission_dummy.class_master
    ADD CONSTRAINT CK_class_master_year
    CHECK (year_of_study IN (1,2,3,4,5))
GO

-- ── 3. division_master ────────────────────────────────────────────────────────
-- division_master uses year_level (VARCHAR) not year_of_study — no change needed.

-- ── 4. applications ───────────────────────────────────────────────────────────
DECLARE @ap NVARCHAR(256)
SELECT @ap = name
FROM   sys.check_constraints
WHERE  parent_object_id = OBJECT_ID('admission_dummy.applications')
  AND  definition LIKE '%year_of_study%'
IF @ap IS NOT NULL
    EXEC('ALTER TABLE admission_dummy.applications DROP CONSTRAINT [' + @ap + ']')
ALTER TABLE admission_dummy.applications
    ADD CONSTRAINT CK_applications_year
    CHECK (year_of_study IN (1,2,3,4,5))
GO

-- ── 5. admission_periods ──────────────────────────────────────────────────────
DECLARE @adp NVARCHAR(256)
SELECT @adp = name
FROM   sys.check_constraints
WHERE  parent_object_id = OBJECT_ID('admission_dummy.admission_periods')
  AND  definition LIKE '%year_of_study%'
IF @adp IS NOT NULL
    EXEC('ALTER TABLE admission_dummy.admission_periods DROP CONSTRAINT [' + @adp + ']')
ALTER TABLE admission_dummy.admission_periods
    ADD CONSTRAINT CK_admission_periods_year
    CHECK (year_of_study IN (1,2,3,4,5))
GO

-- ── 6. certificate_bonafide (if applicable) ───────────────────────────────────
DECLARE @cb NVARCHAR(256)
SELECT @cb = name
FROM   sys.check_constraints
WHERE  parent_object_id = OBJECT_ID('admission_dummy.certificate_bonafide')
  AND  definition LIKE '%year_of_study%'
IF @cb IS NOT NULL
    EXEC('ALTER TABLE admission_dummy.certificate_bonafide DROP CONSTRAINT [' + @cb + ']')
GO
