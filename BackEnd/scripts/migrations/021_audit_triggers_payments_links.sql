-- ============================================================
-- Migration 021: Audit triggers for payments, payment_link_tokens,
--                and application_activity_log.
--
-- What this does:
--   1. Recreates [payments$Arc] with PayU columns (gateway, gateway_txnid,
--      gateway_payment_id) replacing legacy razorpay_* columns.
--   2. Drops old payments triggers (they reference razorpay_* columns)
--      and recreates them with the new column list.
--   3. Creates [payment_link_tokens$Arc] + INSERT/UPDATE/DELETE triggers.
--   4. Creates [application_activity_log$Arc] + INSERT-only trigger
--      (activity log is append-only — no updates or deletes expected).
--
-- Safe to re-run — all DROP/CREATE blocks are guarded.
-- ============================================================

USE college_db;
GO

-- ============================================================
-- 1. Recreate payments$Arc with PayU columns
-- ============================================================

-- Drop old payments triggers that reference razorpay_* columns
IF OBJECT_ID('dbo.trg_payments_arc_ins','TR') IS NOT NULL DROP TRIGGER dbo.trg_payments_arc_ins;
GO
IF OBJECT_ID('dbo.trg_payments_arc_upd','TR') IS NOT NULL DROP TRIGGER dbo.trg_payments_arc_upd;
GO
IF OBJECT_ID('dbo.trg_payments_arc_del','TR') IS NOT NULL DROP TRIGGER dbo.trg_payments_arc_del;
GO

-- Recreate payments$Arc with correct PayU columns (add if not exists approach)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'payments$Arc')
BEGIN
  CREATE TABLE [payments$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT,
    application_id      INT,
    payment_type        NVARCHAR(30),
    amount              DECIMAL(10,2),
    gateway             NVARCHAR(30),
    gateway_txnid       NVARCHAR(100),
    gateway_payment_id  NVARCHAR(100),
    status              NVARCHAR(20),
    paid_by             NVARCHAR(10),
    paid_by_user_id     INT,
    attempted_at        DATETIME2,
    completed_at        DATETIME2,
    created_by          NVARCHAR(150),
    updated_by          NVARCHAR(150),
    -- Audit columns
    action_type         NVARCHAR(10)   NOT NULL,  -- INSERT | UPDATE | DELETE
    action_by           NVARCHAR(150),
    action_at           DATETIME2      NOT NULL DEFAULT GETDATE(),
    machine_mac_address NVARCHAR(50),
    comments            NVARCHAR(500)
  );
END
ELSE
BEGIN
  -- Add PayU columns to existing arc table if they were never added
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments$Arc' AND COLUMN_NAME = 'gateway')
    ALTER TABLE [payments$Arc] ADD gateway NVARCHAR(30) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments$Arc' AND COLUMN_NAME = 'gateway_txnid')
    ALTER TABLE [payments$Arc] ADD gateway_txnid NVARCHAR(100) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments$Arc' AND COLUMN_NAME = 'gateway_payment_id')
    ALTER TABLE [payments$Arc] ADD gateway_payment_id NVARCHAR(100) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments$Arc' AND COLUMN_NAME = 'action_at')
    ALTER TABLE [payments$Arc] ADD action_at DATETIME2 NOT NULL DEFAULT GETDATE();
END
GO

-- Recreate payments triggers with PayU column list
CREATE OR ALTER TRIGGER trg_payments_arc_ins ON payments AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [payments$Arc]
      (id, application_id, payment_type, amount, gateway, gateway_txnid, gateway_payment_id,
       status, paid_by, paid_by_user_id, attempted_at, completed_at,
       created_by, updated_by, action_type, action_by, machine_mac_address, comments)
    SELECT
      i.id, i.application_id, i.payment_type, i.amount, i.gateway, i.gateway_txnid, i.gateway_payment_id,
      i.status, i.paid_by, i.paid_by_user_id, i.attempted_at, i.completed_at,
      i.created_by, i.updated_by,
      'INSERT',
      CONVERT(NVARCHAR(150), COALESCE(i.created_by, SESSION_CONTEXT(N'app_user_id'))),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY
  BEGIN CATCH END CATCH
END
GO

CREATE OR ALTER TRIGGER trg_payments_arc_upd ON payments AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [payments$Arc]
      (id, application_id, payment_type, amount, gateway, gateway_txnid, gateway_payment_id,
       status, paid_by, paid_by_user_id, attempted_at, completed_at,
       created_by, updated_by, action_type, action_by, machine_mac_address, comments)
    SELECT
      i.id, i.application_id, i.payment_type, i.amount, i.gateway, i.gateway_txnid, i.gateway_payment_id,
      i.status, i.paid_by, i.paid_by_user_id, i.attempted_at, i.completed_at,
      i.created_by, i.updated_by,
      'UPDATE',
      CONVERT(NVARCHAR(150), COALESCE(i.updated_by, SESSION_CONTEXT(N'app_user_id'))),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY
  BEGIN CATCH END CATCH
END
GO

CREATE OR ALTER TRIGGER trg_payments_arc_del ON payments AFTER DELETE AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [payments$Arc]
      (id, application_id, payment_type, amount, gateway, gateway_txnid, gateway_payment_id,
       status, paid_by, paid_by_user_id, attempted_at, completed_at,
       created_by, updated_by, action_type, action_by, machine_mac_address, comments)
    SELECT
      d.id, d.application_id, d.payment_type, d.amount, d.gateway, d.gateway_txnid, d.gateway_payment_id,
      d.status, d.paid_by, d.paid_by_user_id, d.attempted_at, d.completed_at,
      d.created_by, d.updated_by,
      'DELETE',
      CONVERT(NVARCHAR(150), COALESCE(d.updated_by, SESSION_CONTEXT(N'app_user_id'))),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY
  BEGIN CATCH END CATCH
END
GO

-- ============================================================
-- 2. payment_link_tokens$Arc + triggers
--    Captures every token creation, used-flag update, and deletion.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'payment_link_tokens$Arc')
  CREATE TABLE [payment_link_tokens$Arc] (
    arc_id              INT IDENTITY(1,1) PRIMARY KEY,
    id                  INT,
    token               NVARCHAR(100),
    application_id      INT,
    payment_type        NVARCHAR(30),
    amount              DECIMAL(10,2),
    gateway_txnid       NVARCHAR(100),
    used                BIT,
    expires_at          DATETIME2,
    created_at          DATETIME2,
    created_by          NVARCHAR(150),
    -- Audit columns
    action_type         NVARCHAR(10)  NOT NULL,  -- INSERT | UPDATE | DELETE
    action_by           NVARCHAR(150),
    action_at           DATETIME2     NOT NULL DEFAULT GETDATE(),
    machine_mac_address NVARCHAR(50),
    comments            NVARCHAR(500)
  );
GO

CREATE OR ALTER TRIGGER trg_payment_link_tokens_arc_ins ON payment_link_tokens AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [payment_link_tokens$Arc]
      (id, token, application_id, payment_type, amount, gateway_txnid, used, expires_at, created_at,
       created_by, action_type, action_by, machine_mac_address, comments)
    SELECT
      i.id, i.token, i.application_id, i.payment_type, i.amount, i.gateway_txnid, i.used, i.expires_at, i.created_at,
      i.created_by,
      'INSERT',
      CONVERT(NVARCHAR(150), COALESCE(i.created_by, SESSION_CONTEXT(N'app_user_id'))),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM inserted i;
  END TRY
  BEGIN CATCH END CATCH
END
GO

-- UPDATE trigger fires when:
--   a) gateway_txnid is stored on first page open
--   b) used=1 is set after successful payment
-- Both changes are captured here with the post-update state.
CREATE OR ALTER TRIGGER trg_payment_link_tokens_arc_upd ON payment_link_tokens AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [payment_link_tokens$Arc]
      (id, token, application_id, payment_type, amount, gateway_txnid, used, expires_at, created_at,
       created_by, action_type, action_by, machine_mac_address, comments)
    SELECT
      i.id, i.token, i.application_id, i.payment_type, i.amount, i.gateway_txnid, i.used, i.expires_at, i.created_at,
      i.created_by,
      CASE
        WHEN d.used = 0 AND i.used = 1           THEN 'USED'     -- link consumed after payment
        WHEN d.gateway_txnid IS NULL
         AND i.gateway_txnid IS NOT NULL          THEN 'OPENED'   -- txnid assigned on first open
        ELSE 'UPDATE'
      END,
      CONVERT(NVARCHAR(150), SESSION_CONTEXT(N'app_user_id')),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM inserted i
    JOIN deleted d ON d.id = i.id;
  END TRY
  BEGIN CATCH END CATCH
END
GO

CREATE OR ALTER TRIGGER trg_payment_link_tokens_arc_del ON payment_link_tokens AFTER DELETE AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [payment_link_tokens$Arc]
      (id, token, application_id, payment_type, amount, gateway_txnid, used, expires_at, created_at,
       created_by, action_type, action_by, machine_mac_address, comments)
    SELECT
      d.id, d.token, d.application_id, d.payment_type, d.amount, d.gateway_txnid, d.used, d.expires_at, d.created_at,
      d.created_by,
      'DELETE',
      CONVERT(NVARCHAR(150), SESSION_CONTEXT(N'app_user_id')),
      CONVERT(NVARCHAR(50),  SESSION_CONTEXT(N'app_machine_mac')),
      CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'app_comments'))
    FROM deleted d;
  END TRY
  BEGIN CATCH END CATCH
END
GO

-- ============================================================
-- 3. application_activity_log$Arc + INSERT-only trigger
--    This table is append-only — rows are never updated or deleted.
--    The trigger simply duplicates every insert into the arc table
--    so that even if the source row is ever tampered with or deleted
--    the original record is preserved.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'application_activity_log$Arc')
  CREATE TABLE [application_activity_log$Arc] (
    arc_id         INT IDENTITY(1,1) PRIMARY KEY,
    id             INT,
    application_id INT,
    action         NVARCHAR(60),
    actor_role     NVARCHAR(20),
    note           NVARCHAR(1000),
    created_at     DATETIME2,
    -- Audit columns
    action_type    NVARCHAR(10)  NOT NULL DEFAULT 'INSERT',
    action_at      DATETIME2     NOT NULL DEFAULT GETDATE()
  );
GO

CREATE OR ALTER TRIGGER trg_activity_log_arc_ins ON application_activity_log AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO [application_activity_log$Arc]
      (id, application_id, action, actor_role, note, created_at, action_type)
    SELECT
      i.id, i.application_id, i.action, i.actor_role, i.note, i.created_at,
      'INSERT'
    FROM inserted i;
  END TRY
  BEGIN CATCH END CATCH
END
GO

-- ============================================================
-- Also add a guard trigger: prevent DELETE from activity log
-- (activity log must never be pruned — it is a legal audit trail)
-- ============================================================
CREATE OR ALTER TRIGGER trg_activity_log_no_delete ON application_activity_log INSTEAD OF DELETE AS
BEGIN
  SET NOCOUNT ON;
  RAISERROR('Deleting from application_activity_log is not permitted. This is a permanent audit trail.', 16, 1);
  ROLLBACK;
END
GO

PRINT 'Migration 021: payments$Arc rebuilt, payment_link_tokens$Arc created, application_activity_log$Arc created. All triggers installed.';
GO
