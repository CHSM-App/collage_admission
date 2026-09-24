-- Migration 053: India location master (State → District → Taluka)
-- Date: 2026-09-24
--
-- Source: Local Government Directory (LGD), Govt. of India — lgdirectory.gov.in,
-- dataset from data.gov.in "LGD - Sub-Districts".
-- The primary keys ARE the LGD codes (not IDENTITY), so the same IDs work in
-- any other application that uses LGD, and a re-import never renumbers rows.
-- LGD "sub-district" = taluka / tehsil / mandal.
--
-- Data is loaded by: node scripts/seed_locations.js (idempotent upsert).

IF OBJECT_ID('state_master', 'U') IS NULL
CREATE TABLE state_master (
    id           INT            NOT NULL PRIMARY KEY,   -- LGD state code
    name         NVARCHAR(100)  NOT NULL,
    name_local   NVARCHAR(100)  NULL,
    census_code  VARCHAR(10)    NULL,                   -- Census 2011
    is_active    BIT            NOT NULL DEFAULT 1
);
GO

IF OBJECT_ID('district_master', 'U') IS NULL
CREATE TABLE district_master (
    id           INT            NOT NULL PRIMARY KEY,   -- LGD district code
    state_id     INT            NOT NULL REFERENCES state_master(id),
    name         NVARCHAR(100)  NOT NULL,
    name_local   NVARCHAR(100)  NULL,
    census_code  VARCHAR(10)    NULL,
    is_active    BIT            NOT NULL DEFAULT 1
);
GO

IF OBJECT_ID('taluka_master', 'U') IS NULL
CREATE TABLE taluka_master (
    id           INT            NOT NULL PRIMARY KEY,   -- LGD sub-district code
    district_id  INT            NOT NULL REFERENCES district_master(id),
    name         NVARCHAR(100)  NOT NULL,
    name_local   NVARCHAR(100)  NULL,
    census_code  VARCHAR(10)    NULL,
    is_active    BIT            NOT NULL DEFAULT 1
);
GO

-- The two lookup paths the API uses: children by parent, ordered by name.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_district_master_state')
    CREATE INDEX IX_district_master_state ON district_master (state_id, name) INCLUDE (is_active);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_taluka_master_district')
    CREATE INDEX IX_taluka_master_district ON taluka_master (district_id, name) INCLUDE (is_active);
GO
