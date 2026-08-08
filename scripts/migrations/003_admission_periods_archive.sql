-- ============================================================
-- 003_admission_periods_archive.sql
-- Creates [admission_periods$Arc] audit table + indexes.
-- Triggers are created by the migration runner directly (see
-- migrate.js) to avoid MSSQL parse-time object validation errors.
-- ============================================================

IF OBJECT_ID('[dbo].[admission_periods$Arc]', 'U') IS NULL
CREATE TABLE [dbo].[admission_periods$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
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
    action_type         NVARCHAR(10)  NOT NULL CHECK (action_type IN ('INSERT','UPDATE','DELETE')),
    action_date         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    action_by           NVARCHAR(150) NULL,
    machine_mac_address NVARCHAR(50)  NULL,
    comments            NVARCHAR(500) NULL,
    archived_date       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

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
