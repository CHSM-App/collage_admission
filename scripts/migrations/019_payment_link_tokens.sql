-- Migration 019: Payment link tokens for shareable PayU payment links

IF OBJECT_ID('payment_link_tokens', 'U') IS NULL
CREATE TABLE payment_link_tokens (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    token          NVARCHAR(64)  NOT NULL UNIQUE,
    application_id INT           NOT NULL REFERENCES applications(id),
    payment_type   NVARCHAR(30)  NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    created_by     NVARCHAR(150) NULL,
    expires_at     DATETIME2     NOT NULL,
    used           BIT           NOT NULL DEFAULT 0,
    created_at     DATETIME2     DEFAULT GETDATE()
);
GO
