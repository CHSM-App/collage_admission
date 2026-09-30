-- ============================================================
-- 018_arc_academic_year.sql
-- Add academic_year column to fees_master$Arc and
-- classwise_fees$Arc to match the 017_academic_year_fees.sql
-- changes to the source tables.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[dbo].[fees_master$Arc]')
      AND name = 'academic_year'
)
    ALTER TABLE [dbo].[fees_master$Arc]
        ADD academic_year NVARCHAR(10) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[dbo].[classwise_fees$Arc]')
      AND name = 'academic_year'
)
    ALTER TABLE [dbo].[classwise_fees$Arc]
        ADD academic_year NVARCHAR(10) NULL;
GO
