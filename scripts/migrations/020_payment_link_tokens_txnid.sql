-- Migration 020: Add gateway_txnid to payment_link_tokens
-- Stores the PayU txnid generated on first page open so reloads reuse the same pending payment row.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'payment_link_tokens' AND COLUMN_NAME = 'gateway_txnid'
)
ALTER TABLE payment_link_tokens ADD gateway_txnid NVARCHAR(100) NULL;
GO
