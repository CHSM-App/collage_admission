-- ============================================================
-- migrate_admission_periods_archive.sql
--
-- Creates [admission_periods$Arc] archive table + AFTER INSERT/UPDATE/DELETE
-- triggers on admission_periods. Idempotent — safe to re-run.
--
-- The application is expected to set these SESSION_CONTEXT keys per request
-- so the trigger can record *who* did what. If unset, the corresponding
-- columns are NULL (so the archive still records *what* changed):
--
--   EXEC sp_set_session_context @key=N'app_user_id',     @value=N'<id-or-name>',  @read_only = 0;
--   EXEC sp_set_session_context @key=N'app_machine_mac', @value=N'<mac-address>', @read_only = 0;
--   EXEC sp_set_session_context @key=N'app_comments',    @value=N'<remark>',      @read_only = 0;
--
-- Triggers wrap the archive INSERT in TRY/CATCH so a logging failure does
-- NOT abort the main DML (soft logging).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Archive table
-- ─────────────────────────────────────────────────────────────
IF OBJECT_ID('[dbo].[admission_periods$Arc]', 'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[admission_periods$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    -- Mirror of admission_periods. No FKs / IDENTITY / NOT NULL — an
    -- archive row is a historical snapshot and must survive any change
    -- to the source row (including referenced rows being deleted).
    id                  INT           NULL,
    college_id          INT           NULL,
    course_id           INT           NULL,
    year_of_study       INT           NULL,
    academic_year       NVARCHAR(10)  NULL,
    start_date          DATE          NULL,
    end_date            DATE          NULL,
    total_seats         INT           NULL,
    filled_seats        INT           NULL,
    is_active           BIT           NULL,
    is_disabled         BIT           NULL,
    created_at          DATETIME2     NULL,
    -- Audit columns
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL,
    archived_date       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

-- ─────────────────────────────────────────────────────────────
-- 2. Indexes (per spec: action_date, action_type, action_by)
-- ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_admission_periods_arc_action_date')
  CREATE INDEX ix_admission_periods_arc_action_date
    ON [dbo].[admission_periods$Arc] (action_date);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_admission_periods_arc_action_type')
  CREATE INDEX ix_admission_periods_arc_action_type
    ON [dbo].[admission_periods$Arc] (action_type);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_admission_periods_arc_action_by')
  CREATE INDEX ix_admission_periods_arc_action_by
    ON [dbo].[admission_periods$Arc] (action_by);
GO

-- ─────────────────────────────────────────────────────────────
-- 3. Triggers
-- ─────────────────────────────────────────────────────────────
IF OBJECT_ID('[dbo].[trg_admission_periods_arc_ins]', 'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_admission_periods_arc_ins];
GO
CREATE TRIGGER [dbo].[trg_admission_periods_arc_ins]
ON [dbo].[admission_periods]
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [dbo].[admission_periods$Arc] (
      id, college_id, course_id, year_of_study, academic_year,
      start_date, end_date, total_seats, filled_seats,
      is_active, is_disabled, created_at,
      action_type, action_by, machine_mac_address, comments
    )
    SELECT
      i.id, i.college_id, i.course_id, i.year_of_study, i.academic_year,
      i.start_date, i.end_date, i.total_seats, i.filled_seats,
      i.is_active, i.is_disabled, i.created_at,
      'INSERT',
      CONVERT(NVARCHAR(150), SESSION_CONTEXT(N'app_user_id')),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY
  BEGIN CATCH
    -- Soft logging: swallow any archive error so the main INSERT succeeds.
  END CATCH
END;
GO

IF OBJECT_ID('[dbo].[trg_admission_periods_arc_upd]', 'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_admission_periods_arc_upd];
GO
CREATE TRIGGER [dbo].[trg_admission_periods_arc_upd]
ON [dbo].[admission_periods]
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    -- Log the post-update row state. Reading from `inserted` gives one
    -- archive row per affected source row — the snapshot at the moment of
    -- the update.
    INSERT INTO [dbo].[admission_periods$Arc] (
      id, college_id, course_id, year_of_study, academic_year,
      start_date, end_date, total_seats, filled_seats,
      is_active, is_disabled, created_at,
      action_type, action_by, machine_mac_address, comments
    )
    SELECT
      i.id, i.college_id, i.course_id, i.year_of_study, i.academic_year,
      i.start_date, i.end_date, i.total_seats, i.filled_seats,
      i.is_active, i.is_disabled, i.created_at,
      'UPDATE',
      CONVERT(NVARCHAR(150), SESSION_CONTEXT(N'app_user_id')),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY
  BEGIN CATCH
  END CATCH
END;
GO

IF OBJECT_ID('[dbo].[trg_admission_periods_arc_del]', 'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_admission_periods_arc_del];
GO
CREATE TRIGGER [dbo].[trg_admission_periods_arc_del]
ON [dbo].[admission_periods]
AFTER DELETE
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [dbo].[admission_periods$Arc] (
      id, college_id, course_id, year_of_study, academic_year,
      start_date, end_date, total_seats, filled_seats,
      is_active, is_disabled, created_at,
      action_type, action_by, machine_mac_address, comments
    )
    SELECT
      d.id, d.college_id, d.course_id, d.year_of_study, d.academic_year,
      d.start_date, d.end_date, d.total_seats, d.filled_seats,
      d.is_active, d.is_disabled, d.created_at,
      'DELETE',
      CONVERT(NVARCHAR(150), SESSION_CONTEXT(N'app_user_id')),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY
  BEGIN CATCH
  END CATCH
END;
GO
