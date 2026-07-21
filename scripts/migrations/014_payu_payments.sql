-- ============================================================
-- 014_payu_payments.sql
-- Adds gateway-agnostic columns to the payments table so both
-- Razorpay and PayU records can coexist in the same table.
-- Idempotent — safe to re-run.
-- ============================================================

-- gateway: 'razorpay' | 'payu' | 'cash'
IF COL_LENGTH('payments','gateway') IS NULL
    ALTER TABLE payments ADD gateway NVARCHAR(20) NULL;
GO

-- gateway_txnid: our own unique transaction id sent to the gateway
IF COL_LENGTH('payments','gateway_txnid') IS NULL
    ALTER TABLE payments ADD gateway_txnid NVARCHAR(100) NULL;
GO

-- gateway_payment_id: the id the gateway assigns on success
--   Razorpay: razorpay_payment_id  (already in razorpay_payment_id column)
--   PayU:     mihpayid
IF COL_LENGTH('payments','gateway_payment_id') IS NULL
    ALTER TABLE payments ADD gateway_payment_id NVARCHAR(150) NULL;
GO

-- Back-fill existing Razorpay rows
UPDATE payments
SET gateway = 'razorpay',
    gateway_txnid      = razorpay_order_id,
    gateway_payment_id = razorpay_payment_id
WHERE gateway IS NULL AND razorpay_order_id IS NOT NULL;
GO

-- Back-fill cash rows
UPDATE payments
SET gateway = 'cash'
WHERE gateway IS NULL
  AND razorpay_order_id IS NULL
  AND razorpay_payment_id IS NULL;
GO
