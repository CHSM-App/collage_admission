/**
 * Run once: node scripts/create_college_users.js
 *
 * Creates:
 *   college_roles          — named roles per college (e.g. "Admission Clerk")
 *   college_role_permissions — which permissions each role has (write=1, read-only=0)
 *   college_users          — staff accounts linked to a college + role
 *
 * Permissions (all map to a sidebar section):
 *   submit_application      — Add Application / submit new form
 *   review_application      — Application Inbox / review filled forms
 *   upload_documents        — Upload docs for applicant
 *   review_documents        — Review / verify existing documents
 *   assign_subjects         — Assign subjects / roll numbers
 *   collect_fees            — Fee payment + receipt
 *   masters                 — Faculty / Bank / Course / Group / Division / Fees masters
 */

const db = require('../routes/db');

async function run() {
  await db.connect?.();

  await db.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'college_roles')
    BEGIN
      CREATE TABLE college_roles (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        college_id   INT          NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
        role_name    NVARCHAR(80) NOT NULL,
        created_at   DATETIME     DEFAULT GETDATE(),
        CONSTRAINT uix_college_role_name UNIQUE (college_id, role_name)
      )
    END
  `);
  console.log('✓ college_roles ready');

  await db.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'college_role_permissions')
    BEGIN
      CREATE TABLE college_role_permissions (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        role_id       INT          NOT NULL REFERENCES college_roles(id) ON DELETE CASCADE,
        permission    NVARCHAR(50) NOT NULL,   -- e.g. 'submit_application'
        can_write     BIT          NOT NULL DEFAULT 0,
        CONSTRAINT uix_role_permission UNIQUE (role_id, permission)
      )
    END
  `);
  console.log('✓ college_role_permissions ready');

  await db.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'college_users')
    BEGIN
      CREATE TABLE college_users (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        college_id    INT           NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
        role_id       INT           NOT NULL REFERENCES college_roles(id),
        full_name     NVARCHAR(120) NOT NULL,
        email         NVARCHAR(150) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        is_active     BIT           NOT NULL DEFAULT 1,
        created_at    DATETIME      DEFAULT GETDATE()
      )
    END
  `);
  console.log('✓ college_users ready');

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
