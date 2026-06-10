-- ============================================================
-- Migration 016: Fee Installment Plan
-- Stores the installment schedule set by the college per application.
-- installment_no: 1-4
-- amount: fixed amount for this instalment
-- due_date: optional due date
-- is_fixed: 1 = student must pay exactly this amount before proceeding;
--           0 = free payment (last row or trailing rows)
-- ============================================================
IF OBJECT_ID('fee_installments', 'U') IS NULL
CREATE TABLE fee_installments (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    application_id   INT            NOT NULL REFERENCES applications(id),
    installment_no   TINYINT        NOT NULL CHECK (installment_no BETWEEN 1 AND 4),
    due_date         DATE           NULL,
    amount           DECIMAL(12,2)  NOT NULL,
    created_by       NVARCHAR(150)  NULL,
    updated_by       NVARCHAR(150)  NULL,
    CONSTRAINT uq_fee_installments UNIQUE (application_id, installment_no)
);
GO
