-- Migration: Add otp_store and whatsapp_message_log tables
-- Run once against db_admission_dummy (and any other target databases).
-- Safe to re-run — each block checks for table existence first.

-- ── 1. otp_store ──────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'otp_store' AND type = 'U'
      AND schema_id = SCHEMA_ID('admission_dummy')
)
BEGIN
    CREATE TABLE admission_dummy.otp_store (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        phone       NVARCHAR(20)  NOT NULL,
        otp_hash    NVARCHAR(255) NOT NULL,          -- bcrypt hash of the OTP
        purpose     NVARCHAR(30)  NOT NULL            -- 'registration' | 'password_reset'
                    CHECK (purpose IN ('registration', 'password_reset')),
        pending_data NVARCHAR(MAX) NULL,              -- JSON: registration fields (only for registration purpose)
        expires_at  DATETIME2     NOT NULL,
        used        BIT           NOT NULL DEFAULT 0,
        created_at  DATETIME2     DEFAULT GETDATE()
    )
    CREATE INDEX IX_otp_store_phone_purpose ON admission_dummy.otp_store (phone, purpose)
    PRINT 'Created otp_store'
END
ELSE
    PRINT 'otp_store already exists — skipped'
GO

-- ── 2. whatsapp_message_log ────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'whatsapp_message_log' AND type = 'U'
      AND schema_id = SCHEMA_ID('admission_dummy')
)
BEGIN
    CREATE TABLE admission_dummy.whatsapp_message_log (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        phone           NVARCHAR(20)   NOT NULL,          -- normalised recipient number
        campaign_name   NVARCHAR(100)  NOT NULL,          -- e.g. 'correction_requested'
        template_id     NVARCHAR(50)   NULL,
        sample          NVARCHAR(500)  NULL,              -- comma-separated variable values sent
        status          NVARCHAR(20)   NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent', 'failed', 'skipped')),
        campaign_id     NVARCHAR(50)   NULL,              -- ReturnData from SMSala (WhatsappCampaignId)
        error_detail    NVARCHAR(500)  NULL,              -- error message if status = 'failed'
        application_id  INT            NULL REFERENCES admission_dummy.applications(id),
        created_at      DATETIME2      DEFAULT GETDATE()
    )
    CREATE INDEX IX_wamsglog_phone       ON admission_dummy.whatsapp_message_log (phone)
    CREATE INDEX IX_wamsglog_app        ON admission_dummy.whatsapp_message_log (application_id)
    CREATE INDEX IX_wamsglog_created_at ON admission_dummy.whatsapp_message_log (created_at)
    PRINT 'Created whatsapp_message_log'
END
ELSE
    PRINT 'whatsapp_message_log already exists — skipped'
GO
