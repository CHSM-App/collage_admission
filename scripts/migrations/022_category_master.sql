-- 022_category_master.sql
-- Dynamic Category Master: castes, special statuses, fees categories
-- Run once per environment. All statements are idempotent via IF NOT EXISTS / IF COL_LENGTH.

-- 1. Castes master
IF OBJECT_ID('category_castes', 'U') IS NULL
CREATE TABLE category_castes (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  college_id    INT NOT NULL REFERENCES colleges(id),
  caste_name    NVARCHAR(50) NOT NULL,
  is_gen_type   BIT NOT NULL DEFAULT 0,   -- marks the "General" caste (special status only applies here)
  display_order INT NOT NULL DEFAULT 1,
  is_active     BIT NOT NULL DEFAULT 1,
  created_at    DATETIME2 DEFAULT GETUTCDATE(),
  CONSTRAINT uq_college_caste UNIQUE (college_id, caste_name)
)
GO

-- 2. Special statuses master
IF OBJECT_ID('category_special_statuses', 'U') IS NULL
CREATE TABLE category_special_statuses (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  college_id    INT NOT NULL REFERENCES colleges(id),
  status_name   NVARCHAR(50) NOT NULL,
  display_order INT NOT NULL DEFAULT 1,
  is_active     BIT NOT NULL DEFAULT 1,
  created_at    DATETIME2 DEFAULT GETUTCDATE(),
  CONSTRAINT uq_college_status UNIQUE (college_id, status_name)
)
GO

-- 3. Fees categories master
IF OBJECT_ID('fees_categories', 'U') IS NULL
CREATE TABLE fees_categories (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  college_id     INT NOT NULL REFERENCES colleges(id),
  category_name  NVARCHAR(50) NOT NULL,
  slab_index     INT NOT NULL CHECK (slab_index BETWEEN 1 AND 8),  -- maps to fees_cat{n}_amount
  is_bcc_type    BIT NOT NULL DEFAULT 0,    -- government reimbursable
  is_paying_type BIT NOT NULL DEFAULT 0,    -- full paying, no concession
  display_order  INT NOT NULL DEFAULT 1,
  is_active      BIT NOT NULL DEFAULT 1,
  created_at     DATETIME2 DEFAULT GETUTCDATE(),
  CONSTRAINT uq_college_fees_cat UNIQUE (college_id, category_name),
  CONSTRAINT uq_college_slab     UNIQUE (college_id, slab_index)
)
GO

-- 4. Castes -> fees category mapping
IF OBJECT_ID('fees_category_castes', 'U') IS NULL
CREATE TABLE fees_category_castes (
  fees_category_id INT NOT NULL REFERENCES fees_categories(id) ON DELETE CASCADE,
  caste_id         INT NOT NULL REFERENCES category_castes(id) ON DELETE CASCADE,
  PRIMARY KEY (fees_category_id, caste_id)
)
GO

-- 5. Special statuses -> fees category mapping
IF OBJECT_ID('fees_category_special_statuses', 'U') IS NULL
CREATE TABLE fees_category_special_statuses (
  fees_category_id  INT NOT NULL REFERENCES fees_categories(id) ON DELETE CASCADE,
  special_status_id INT NOT NULL REFERENCES category_special_statuses(id) ON DELETE CASCADE,
  PRIMARY KEY (fees_category_id, special_status_id)
)
GO

-- 6. Extend fees_master with cat5–cat8
IF COL_LENGTH('fees_master', 'fees_cat5_amount') IS NULL
  ALTER TABLE fees_master ADD
    fees_cat5_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    fees_cat6_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    fees_cat7_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    fees_cat8_amount DECIMAL(12,2) NOT NULL DEFAULT 0
GO

-- 7. Extend classwise_fees with cat5–cat8
IF COL_LENGTH('classwise_fees', 'cat5_amount') IS NULL
  ALTER TABLE classwise_fees ADD
    cat5_amount DECIMAL(12,2) NULL,
    cat6_amount DECIMAL(12,2) NULL,
    cat7_amount DECIMAL(12,2) NULL,
    cat8_amount DECIMAL(12,2) NULL
GO
