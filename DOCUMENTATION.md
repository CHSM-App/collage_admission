# College Admission Portal — Full Developer Documentation

> **Handover guide** for any developer taking over this project. Written to be read top-to-bottom without needing to run the code first.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
1a. [How It Works — Operation Flows](#1a-how-it-works--operation-flows)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Getting Started (Local Setup)](#4-getting-started-local-setup)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema (All Tables)](#6-databaese-schema-all-tables)
7. [Database Migrations](#7-database-migrations)
8. [Backend Architecture](#8-backend-architecture)
9. [All API Routes](#9-all-api-routes)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Frontend Architecture](#11-frontend-architecture)
12. [All Frontend Routes & Pages](#12-all-frontend-routes--pages)
12a. [College Types & Features Config](#12a-college-types--features-config)
13. [Application State Machine (Status Flow)](#13-application-state-machine-status-flow)
14. [Fee Determination System](#14-fee-determination-system)
15. [Payment Flow (PayU)](#15-payment-flow-payu)
15a. [WhatsApp Payment Links](#15a-whatsapp-payment-links)
16. [Document Upload System](#16-document-upload-system)
17. [WhatsApp Notifications (SMSala)](#17-whatsapp-notifications-smsala)
18. [AI Chatbot (Gemini)](#18-ai-chatbot-gemini)
19. [Certificate System](#19-certificate-system)
20. [Master Data Management](#20-master-data-management)
21. [Role & Permission System](#21-role--permission-system)
22. [Background Jobs](#22-background-jobs)
23. [Security Implementation](#23-security-implementation)
24. [Testing](#24-testing)
25. [Deployment Notes](#25-deployment-notes)
26. [Key Business Rules](#26-key-business-rules)

---

## 1. Project Overview

This is a **multi-tenant, multi-role web application** for managing college admissions in India. It allows:

- **Students** to register, browse colleges, apply online, pay fees, and track their admission status.
- **College Admins** to manage their admission process end-to-end: receive applications, review, confirm, assign roll numbers, and issue certificates.
- **Super Admins** to onboard colleges, manage college accounts, and control platform-level settings.

The platform supports the full admission lifecycle from a student first registering, all the way through document verification, fee payment, roll number assignment, subject selection, and finally enrollment.

### The three types of users (in plain words)

| User | Logs in at | What they do |
|---|---|---|
| **Student** | `/login/student` | Registers, finds a college by its code, fills the admission form, uploads documents, pays fees, and tracks status. |
| **College staff** | `/login/college` | Runs their whole admission process: receives applications, reviews them, requests corrections, verifies documents, sets fees, collects payment, assigns roll numbers, prints certificates. Can also fill an application *on behalf of* a walk-in student. |
| **Super Admin** | `/login/vtadmin` | Onboards new colleges, sets each college's "type" (which decides the form fields), enables/disables colleges, and manages staff roles. |

---

## 1a. How It Works — Operation Flows

This section explains every major operation as a simple numbered story. Read this first to understand the "big picture" before diving into code. Each flow lists the **screens**, the **API calls**, and the **status changes** involved.

> **Key idea:** every application has a **status** (like `draft`, `submitted`, `confirmed`). Almost every action moves the application from one status to the next. The full list of statuses is in [Section 13](#13-application-state-machine-status-flow).

### Flow A — Student applies online (self-service)

1. **Register / Log in.** Student registers at `/register/student` (or is auto-created by a college) and logs in at `/login/student`.
2. **Find the college.** Student enters the college code on the dashboard. This shows the college's open admission periods (course + year + academic year).
3. **Start the form.** Picking a period creates a **draft** application (`status = draft`).
4. **Fill the multi-step form** (`/apply/:applicationId`):
   - Step 1 — Confirm course/year context
   - Step 2 — Personal details (name, contact, category, address)
   - Step 3 — Other details (birth, parents, Aadhaar, PRN, ABC ID, bank)
   - Step 4 — Previous exam marks (SSC, HSC, earlier semesters)
   - Step 5 — Upload documents
   - Step 6 — Review everything and accept the declaration
   Each step saves to its own API endpoint (see [Section 9](#9-all-api-routes)).
5. **Pay the application fee** (only if the college charges one — see `platform_fee` in [Section 12a](#12a-college-types--features-config)). Payment goes through PayU. On success, the application becomes **`submitted`**.
   - If the college has **no** application fee, the app is submitted directly.
6. **Wait for the college.** The student now tracks status on their dashboard. The college takes over (Flow C).

### Flow B — College fills an application for a walk-in student

Used when a student comes to the college counter and staff enter the form for them.

1. Staff open **Add Application** (`/college/apply/new`).
2. **Find or register the student** — search by name/email/phone, or register a brand-new student on the spot.
   - If the student is already **confirmed at another college**, an OTP is sent to their WhatsApp to authorise the transfer.
3. **Pick the admission course** (period). Courses the student has *already applied to* at this college are greyed out.
4. Staff fill the same multi-step form (Flow A, steps 4–6).
5. **Submit + collect application fee.** Staff either mark cash as collected, take an online payment, or send a WhatsApp payment link.
   - Collecting the application fee moves the app straight to **`confirmed`** (the college is doing the review inline — no separate approval needed).
6. **Set college fee and confirm.** On the "Division & Fees" step, staff review the fee breakdown, optionally set an installment plan, pick a division, and click **Confirm & Collect Fee**. The application stays **`confirmed`** with the fee details recorded, then staff collect the college fee.

### Flow C — College reviews a student-submitted application

This is the review pipeline for applications that arrived via Flow A.

1. Application lands in the college **inbox** as **`submitted`**.
2. Staff open it. They can:
   - **Request a correction** → `correction_requested` (student edits and resubmits → `correction_done`).
   - **Accept / verify documents** → the app advances toward `doc_verified`.
   - **Reject** → `rejected` (final).
3. **Confirm admission.** Staff verify documents, set the total college fee (and optional installments), pick a division, and confirm → **`confirmed`**.
4. **Student pays the college fee** (PayU or a WhatsApp link) → **`fees_paid`**.
5. **Assign roll number** → **`roll_assigned`**.
6. **Subject selection** (student picks subjects) → **`enrolled`** (final).

### Flow D — Super Admin onboards a college

1. Admin logs in at `/login/vtadmin` and opens **Create College**.
2. Fills college info + admin login + **College Type** (General or Agriculture — see [Section 12a](#12a-college-types--features-config)).
3. On save, the backend creates the college and writes its **features config** from the chosen type's preset. This decides which form fields and fee options that college uses.
4. Later, the admin can change a college's type from the **Features** tab; changing the type re-applies that type's full field set.

### Flow E — Fee payment (both application fee and college fee)

1. Student clicks **Pay**. The backend creates a pending payment row and returns a PayU form.
2. The browser auto-submits the form to PayU; the student pays on PayU's page.
3. PayU redirects back to `/payment-result`. The backend verifies the response hash and marks the payment **success/failed**.
4. On success, the relevant flag is set (`application_fee_paid` or `college_fee_paid`) and the application status advances.
   - **WhatsApp links:** instead of paying in-app, the college can send a payment link over WhatsApp; the student opens it and pays the same way.

### Flow F — Forgot password

Two separate flows, because students and colleges are identified differently:

**Student** (`/forgot-password`) — identified by **phone**:
1. Enter the registered phone number → OTP sent to their WhatsApp.
2. Enter the OTP, set a new password.

**College admin or staff** (`/college/forgot-password`) — identified by **email**:
1. Enter the **login email**. The backend resolves it to a college admin (`colleges.admin_email`) or a staff member (`college_users.email`).
2. An OTP is sent to the phone on file — the **college's** phone for an admin, the **staff member's own** phone for staff.
3. Enter the OTP, set a new password. The matching account's password is updated.
   - Unknown emails get a generic reply (no account enumeration).
   - An account with no phone on file is told to contact its college admin (staff phones are set in the staff form).

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend Runtime | Node.js + Express | Express ~4.16 |
| Database | Microsoft SQL Server (MSSQL) | mssql ^12.5 |
| Frontend | React + Vite | React ^19.2 |
| CSS Framework | Tailwind CSS | ^3.4 |
| Authentication | JWT via httpOnly cookies | jsonwebtoken |
| Payment Gateway | PayU (form-based redirect) | (REST via https) |
| AI / Chatbot | Google Gemini 2.5 Flash | @google/genai ^2.4 |
| WhatsApp Notifications | SMSala API | (REST via https) |
| File Uploads | Multer | ^2.1 |
| PDF Generation | jsPDF | ^4.2 (frontend) |
| Excel Export | xlsx | ^0.18 (frontend) |
| HTTP Client (FE) | Axios | ^1.15 |
| Routing (FE) | React Router DOM | ^7.14 |
| Logging (BE) | Pino | ^10.3 |
| Input Validation (BE) | express-validator | ^7.3 |
| Rate Limiting (BE) | express-rate-limit + express-slow-down | ^8.x |
| File Type Detection (BE) | file-type (magic bytes) | ^22 (ESM, dynamic import) |
| Security Headers (BE) | Helmet | ^8.1 |
| Testing (FE) | Vitest + React Testing Library | ^4.1 |

---

## 3. Repository Structure

```
collage_admission/
│
├── BackEnd/                          ← Node.js / Express API server
│   ├── bin/
│   │   └── www                       ← Server entry point (starts Express + HTTP server)
│   ├── config/
│   │   ├── env.js                    ← Validates required env vars at startup
│   │   └── logger.js                 ← Pino logger setup (pretty in dev, JSON in prod)
│   ├── routes/
│   │   ├── db.js                     ← MSSQL connection pool singleton
│   │   ├── auth.js                   ← Login, register, OTP, password reset
│   │   ├── application_form.js       ← Multi-step application form save/load
│   │   ├── applications.js           ← Student application list, subject selection
│   │   ├── colleges.js               ← Public college listing/browsing
│   │   ├── college_admin.js          ← College admin operations (review, approve, etc.)
│   │   ├── payments.js               ← PayU payment initiation, payu-return, payu-webhook, payment links
│   │   ├── documents.js              ← Document upload/delete
│   │   ├── masters.js                ← Master data CRUD (fees, courses, divisions, etc.)
│   │   ├── certificates.js           ← Certificate generation and listing
│   │   ├── notifications.js          ← In-app notification endpoints
│   │   ├── chat.js                   ← AI chatbot endpoints
│   │   ├── college_users.js          ← College staff user management (admin-only)
│   │   └── index.js                  ← Health check / root
│   ├── middleware/
│   │   ├── auth.js                   ← JWT verification + role/permission guards
│   │   ├── auditLog.js               ← Logs sensitive operations to DB
│   │   └── paginate.js               ← Pagination helper for list endpoints
│   ├── services/
│   │   ├── FeeDeterminationService.js ← Core fee calculation logic
│   │   ├── aiService.js              ← Gemini AI wrapper for chatbot
│   │   └── whatsapp.js               ← SMSala WhatsApp notification service
│   ├── jobs/
│   │   └── otpCleanup.js             ← node-cron job: deletes expired OTPs every 5 min
│   ├── scripts/
│   │   ├── migrate.js                ← Migration runner (idempotent, .sql only)
│   │   ├── run_sql.js                ← Paste-and-run arbitrary SQL (dev tool)
│   │   ├── fix_identity_seeds.js     ← Wipes students/applications, reseeds ids to start at 1
│   │   ├── seed.sql                  ← Seed data for dev/staging
│   │   ├── create_admin.sql          ← SQL to create the first super admin account
│   │   └── migrations/
│   │       ├── 001_base_schema.sql   ← All core tables
│   │       ├── 002_applications_app_fields.sql  ← Multi-step form snapshot columns
│   │       ├── 003_admission_periods_archive.sql ← Audit table + triggers
│   │       ├── 004_indexes.sql       ← Performance indexes
│   │       ├── 005_seed_document_types.sql ← Document type master data
│   │       ├── 006_prev_exam_columns.sql   ← Previous exam schema fix
│   │       ├── 007_applications_missing_columns.sql ← Application column fixes
│   │       ├── 008_chatbot.sql       ← Chatbot knowledge + log tables
│   │       ├── 009_college_enabled.sql ← College is_enabled column
│   │       ├── 010_payu_payments.sql ← Migrate payments table from Razorpay to PayU columns
│   │       ├── 011_payment_link_tokens.sql ← WhatsApp payment link token table
│   │       ├── 012_notifications.sql ← In-app notification table
│   │       ├── 013_college_users.sql ← College staff accounts
│   │       ├── 014_certificates.sql  ← Certificate tables (bonafide, character, NOC)
│   │       ├── 015_classwise_fees.sql ← Per-class fee override table
│   │       ├── 016_reports.sql       ← Report/analytics views
│   │       ├── 017_application_activity_log.sql ← Activity audit trail
│   │       ├── 018_college_fee_instalments.sql ← Multi-instalment tracking
│   │       ├── 019_misc_fixes.sql    ← Minor column additions and fixes
│   │       └── 020_payment_link_tokens_txnid.sql ← Adds gateway_txnid to payment_link_tokens
│   ├── uploads/                      ← Uploaded documents (OUTSIDE web root; served via authenticated route)
│   ├── public/                       ← Static assets (NOT uploads)
│   ├── app.js                        ← Express app configuration, route mounting
│   ├── package.json
│   ├── .env.example                  ← Template for required env variables
│   └── web.config                    ← IIS deployment config
│
├── FrontEnd/                         ← React + Vite SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx               ← Root component (wraps providers + routes)
│   │   │   ├── routes.jsx            ← All route definitions (lazy-loaded)
│   │   │   ├── routePaths.js         ← Route path string constants
│   │   │   └── providers.jsx         ← All context providers composed here
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       ← Auth state (user, role, login/logout)
│   │   │   └── ToastContext.jsx      ← Toast notification state
│   │   ├── features/
│   │   │   ├── auth/                 ← Login, Register, ForgotPassword pages + hooks
│   │   │   ├── student/              ← All student-facing pages + hooks
│   │   │   ├── college/              ← All college admin pages + hooks
│   │   │   └── admin/                ← Super admin pages + components
│   │   ├── services/                 ← Axios API call functions (one file per domain)
│   │   ├── shared/
│   │   │   ├── components/           ← Reusable UI components (ProtectedRoute, ErrorBoundary, etc.)
│   │   │   └── hooks/                ← Shared utility hooks
│   │   ├── layouts/
│   │   │   ├── AuthLayout.jsx        ← Centered card layout for login/register pages
│   │   │   └── DashboardLayout.jsx   ← Sidebar + header layout for all dashboard pages
│   │   ├── components/
│   │   │   └── ChatBot.jsx           ← Floating chatbot widget
│   │   └── test/                     ← Vitest unit tests for hooks
│   ├── public/
│   │   └── icons.svg                 ← SVG sprite
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env.example
│
└── load-tests/                       ← Load testing scripts (k6 or similar)
```

---

## 4. Getting Started (Local Setup)

### Prerequisites
- Node.js 18+
- Microsoft SQL Server (any edition, including Express)
- Git

### Step 1 — Clone & install dependencies

```bash
# Backend
cd BackEnd
npm install

# Frontend
cd ../FrontEnd
npm install
```

### Step 2 — Configure environment variables

```bash
# Backend
cp BackEnd/.env.example BackEnd/.env
# Edit BackEnd/.env with your DB credentials, JWT secret, PayU keys, etc.

# Frontend
cp FrontEnd/.env.example FrontEnd/.env
# Set VITE_API_URL=http://localhost:8000/
```

### Step 3 — Create the database and run migrations

```sql
-- In SQL Server Management Studio (SSMS), create a new database:
CREATE DATABASE college_admission;
```

```bash
# Then run migrations (idempotent, safe to re-run)
cd BackEnd
npm run migrate
```

### Step 4 — Create the first super admin

```bash
# Edit BackEnd/scripts/create_admin.sql — replace placeholder email/password hash
# Then run in SSMS or sqlcmd
```

### Step 5 — Start the servers

```bash
# Terminal 1 — Backend (runs on port 8000)
cd BackEnd
npm run dev

# Terminal 2 — Frontend (runs on port 5173)
cd FrontEnd
npm run dev
```

---

## 5. Environment Variables

### Backend (`BackEnd/.env`)

| Variable | Required | Description |
|---|---|---|
| `DB_NAME` | Yes | SQL Server database name |
| `DB_USER` | Yes | SQL Server login username |
| `DB_PASSWORD` | Yes | SQL Server login password |
| `DB_SERVER` | Yes | SQL Server host (e.g. `localhost` or IP) |
| `DB_PORT` | Yes | SQL Server port, default `1433` |
| `JWT_SECRET` | Yes | 64-byte hex string for signing JWTs. Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `SESSION_EXPIRY_HOUR` | No | Hour of day (`0`–`23`, local time) at which **all sessions expire** — everyone is logged out daily. Currently **`3`** (3 AM). Default `0` (midnight). See [Session Expiry](#session-expiry-daily-logout). |
| `RL_*` (rate limits) | No | Optional overrides for every rate-limit threshold — e.g. `RL_AUTH_MAX_IP`, `RL_AUTH_MAX_ACCOUNT`, `RL_PUBLIC_MAX`, `RL_AUTHED_MAX`, `RL_AUTH_WINDOW_MIN`. All have sensible defaults; see [middleware/rateLimits.js](BackEnd/middleware/rateLimits.js) and [Section 23](#23-security-implementation). |
| `CORS_ORIGIN` | Yes | Comma-separated frontend origins allowed (e.g. `http://localhost:5173,https://yourdomain.com`) |
| `NODE_ENV` | Yes | `development` or `production` |
| `PAYU_KEY` | Yes | PayU merchant key |
| `PAYU_SALT` | Yes | PayU merchant salt (used for hash signing) |
| `PAYU_BASE_URL` | Yes | PayU checkout base URL. Use `https://secure.payu.in/_payment` for production, `https://sandboxsecure.payu.in/_payment` for sandbox |
| `PAYU_SUCCESS_URL` | Yes | Absolute URL of `/payments/payu-return` on your backend (PayU redirects here after success) |
| `PAYU_FAILURE_URL` | Yes | Same as above (PayU also POSTs here on failure) |
| `PAYU_WEBHOOK_URL` | Optional | Absolute backend URL for async PayU webhook (backup confirmation) |
| `PAYMENT_LINK_BASE_URL` | Yes | Base URL of your frontend, used to construct payment link URLs (e.g. `https://yourdomain.com`) |
| `GEMINI_API_KEY` | Yes | Google AI Studio API key for chatbot |
| `WHATSAPP_API_TOKEN` | Optional | SMSala API token |
| `WHATSAPP_ENABLED` | Optional | `true` or `false`. Defaults to false if not set |
| `WHATSAPP_TPL_OTP` | Optional | SMSala template ID for OTP messages |
| `WHATSAPP_TPL_CORRECTION_REQUESTED` | Optional | Template ID for correction request notification |
| `WHATSAPP_TPL_APPLICATION_ACCEPTED` | Optional | Template ID for scrutiny accepted notification |
| `WHATSAPP_TPL_APPLICATION_REJECTED` | Optional | Template ID for rejection notification |
| `WHATSAPP_TPL_ADMISSION_CONFIRMED` | Optional | Template ID for admission confirmation |
| `WHATSAPP_TPL_FEES_PAID` | Optional | Template ID for fee payment confirmation |
| `WHATSAPP_TPL_ROLL_ASSIGNED` | Optional | Template ID for roll number assignment |
| `WHATSAPP_TPL_PAYMENT_LINK` | Optional | Template ID (590) for WhatsApp payment link messages |

### Frontend (`FrontEnd/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Full URL of the backend API, with trailing slash. E.g. `http://localhost:8000/` |

---

## 6. Database Schema (All Tables)

All tables are in the default schema (`dbo`). The database is **MSSQL Server**.

---

### Users & Authentication

#### `students`
Student login accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `full_name` | NVARCHAR(200) NOT NULL | |
| `email` | NVARCHAR(150) NOT NULL | Informational. **Not unique** — duplicate student emails are allowed (migration 037). Students do **not** log in by email. |
| `password_hash` | NVARCHAR(255) NOT NULL | bcrypt hash |
| `phone` | NVARCHAR(20) UNIQUE | **The student identifier** — used for login, OTP, and password reset. Must be unique. |
| `dob` | DATE | |
| `gender` | NVARCHAR(10) | |
| `address` | NVARCHAR(500) | |
| `city` | NVARCHAR(100) | |
| `aadhaar_number` | NVARCHAR(20) | |
| `category` | NVARCHAR(30) | Caste/category |
| `prn` | NVARCHAR(50) | Permanent Registration Number |
| `created_at` | DATETIME2 | |

#### `admins`
Super admin accounts. Only platform administrators.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `name` | NVARCHAR(200) | |
| `email` | NVARCHAR(150) UNIQUE NOT NULL | |
| `password_hash` | NVARCHAR(255) NOT NULL | |
| `created_at` | DATETIME2 | |

#### `colleges`
One row per college. Stores the main admin login credentials too.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `name` | NVARCHAR(200) NOT NULL | |
| `address` | NVARCHAR(500) | |
| `city` | NVARCHAR(100) | |
| `phone` | NVARCHAR(20) | |
| `email` | NVARCHAR(150) UNIQUE NOT NULL | College public email |
| `admin_email` | NVARCHAR(150) UNIQUE NOT NULL | Used for college admin login |
| `admin_password_hash` | NVARCHAR(255) NOT NULL | bcrypt hash |
| `college_code` | NVARCHAR(20) UNIQUE | Short code for the college |
| `application_fee` | DECIMAL(12,2) | Platform application fee amount |
| `bank_account_name` | NVARCHAR(200) | |
| `bank_account_number` | NVARCHAR(50) | |
| `bank_ifsc` | NVARCHAR(20) | |
| `bank_upi_id` | NVARCHAR(100) | |
| `is_enabled` | BIT | Added in migration 009. If 0, college is disabled |
| `college_type` | NVARCHAR(20) | Added in migration 031. `'general'` or `'agriculture'`. Drives `features_config`. See [12a](#12a-college-types--features-config). |
| `features_config` | NVARCHAR(MAX) | Added in migration 029. JSON blob controlling which form fields/fees this college uses. Source of truth for the form. |
| `created_at` | DATETIME2 | |

#### `college_users`
College staff accounts (not the main admin, but additional staff).

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK → colleges.id | |
| `role_id` | INT FK → college_roles.id | |
| `full_name` | NVARCHAR(200) | |
| `email` | NVARCHAR(150) UNIQUE | Used for login |
| `phone` | NVARCHAR(20) | Added in migration 038. Nullable. Used to send the staff member's password-reset OTP. |
| `password_hash` | NVARCHAR(255) | |
| `is_active` | BIT DEFAULT 1 | |
| `created_at` | DATETIME2 | |

#### `college_roles`
Role definitions per college (e.g. "Clerk", "Principal").

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK → colleges.id | |
| `role_name` | NVARCHAR(100) | |
| `created_at` | DATETIME2 | |
| *(UNIQUE)* | (college_id, role_name) | |

#### `college_role_permissions`
Maps which permissions a role has.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `role_id` | INT FK → college_roles.id CASCADE DELETE | |
| `permission` | NVARCHAR(100) | Identifier string e.g. `applications`, `masters` |
| `can_write` | BIT DEFAULT 0 | If 0 = read only, if 1 = can mutate |

#### `otp_store`
Stores OTP records for registration and password reset.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `phone` | NVARCHAR(20) | |
| `otp_hash` | NVARCHAR(255) | bcrypt hash of the OTP code |
| `purpose` | NVARCHAR(30) | `'registration'` or `'password_reset'` |
| `pending_data` | NVARCHAR(MAX) | JSON blob of registration data pending OTP verification |
| `expires_at` | DATETIME2 | 10 minutes from creation |
| `used` | BIT DEFAULT 0 | |
| `created_at` | DATETIME2 | |

---

### Academic Master Data

#### `faculty_master`
Degree programs offered per college (e.g. BCA, BCom, BSc).

| Column | Type | Notes |
|---|---|---|
| `code_no` | INT IDENTITY PK | |
| `college_id` | INT FK → colleges.id | |
| `degree_course_code` | NVARCHAR(20) | Short code (e.g. `BCA`) |
| `degree_course_name` | NVARCHAR(200) | Full name |
| `duration_years` | INT DEFAULT 3 | |
| `unique_code_sem1..10` | NVARCHAR(20) | University exam seat codes per semester |
| `exam_seat_code_year1..5` | NVARCHAR(20) | Exam seat codes per year |
| `is_active` | BIT DEFAULT 1 | |
| `created_by`, `modified_by`, `modified_on` | | Audit fields |

#### `course_master`
Individual subjects per program per semester.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `faculty_master_id` | INT FK → faculty_master.code_no | |
| `semester` | INT | Semester number (1, 2, 3…) |
| `course_code` | NVARCHAR(30) | Subject code |
| `course_title` | NVARCHAR(200) | Subject name |
| `credits` | DECIMAL(4,2) | |
| `max_internal`, `min_internal` | INT | Internal marks range |
| `max_sem_end`, `min_sem_end` | INT | Semester-end marks range |
| `max_total`, `min_total` | INT | Total marks range |
| `subject_type` | NVARCHAR(30) | e.g. `'core'`, `'elective'` |
| `display_order` | INT | Sort order |
| `is_active` | BIT | |

#### `group_master`
Elective group definitions (a student picks one subject from a group).

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `faculty_master_id` | INT FK | |
| `semester` | INT | Which semester this group applies to |
| `group_code` | NVARCHAR(20) | Short code |
| `group_description` | NVARCHAR(300) | |
| `is_active` | BIT | |

#### `group_courses`
The subjects within each elective group.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `group_id` | INT FK → group_master.id CASCADE DELETE | |
| `course_position` | INT | Sort order |
| `course_code` | NVARCHAR(30) | |
| `course_title` | NVARCHAR(200) | |

#### `division_master`
Class divisions per program per year (e.g. BCA First Year Division A).

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `faculty_master_id` | INT FK | |
| `year_level` | NVARCHAR(10) | e.g. `'FY'`, `'SY'`, `'TY'` |
| `class_year_code` | NVARCHAR(20) | |
| `division_letter` | CHAR(1) | `'A'`, `'B'`, `'C'` |
| `funding_type` | NVARCHAR(30) | `'Granted'` or `'NonGranted'` — CRITICAL for fee calculation |
| `is_active` | BIT | |

#### `class_master`
Year-of-study definitions per program.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `faculty_master_id` | INT FK | |
| `year_of_study` | TINYINT | Must be 1–5 |
| `label` | NVARCHAR(50) | e.g. `'First Year'` |

---

### Financial Tables

#### `fees_master`
Fee components and amounts by category. One row per fee head per college.

| Column | Type | Notes |
|---|---|---|
| `fees_code` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `fees_type` | NVARCHAR(50) | |
| `is_other_misc` | BIT | If 1, this is a miscellaneous fee |
| `fees_head` | NVARCHAR(200) | Full name of fee (e.g. "Tuition Fee") |
| `short_name` | NVARCHAR(50) | |
| `sequence_auto_fees` | INT | Display order |
| `credit_to_bank_ledger` | INT FK → bank_master | Which bank account this fee goes to |
| `is_refundable` | BIT | For BCC students, refundable fees are reimbursed by government |
| `fees_cat1_amount` | DECIMAL(10,2) | Amount for General/Open students |
| `fees_cat2_amount` | DECIMAL(10,2) | Amount for EBC/PTC/STC/Ex-Service |
| `fees_cat3_amount` | DECIMAL(10,2) | Amount for SC/ST/OBC/DT-VJ etc. |
| `fees_cat4_amount` | DECIMAL(10,2) | Amount for FF/PH/Widows/Govt.Wards |
| `cat4_description` | NVARCHAR(200) | Notes for Cat-4 fee |
| `is_active` | BIT | |

#### `classwise_fees`
Class-level overrides for fees_master amounts. If a row exists here for a specific class, it takes priority over fees_master amounts.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `faculty_master_id` | INT FK | |
| `year_level` | NVARCHAR(10) | FY / SY / TY |
| `fees_code` | INT FK → fees_master | |
| `cat1_amount` … `cat4_amount` | DECIMAL(10,2) | NULL means use the master fee amount |

#### `bank_master`
Bank accounts registered by the college.

| Column | Type | Notes |
|---|---|---|
| `ledger_code` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `bank_account_number` | NVARCHAR(50) | |
| `bank_name` | NVARCHAR(200) | |
| `branch` | NVARCHAR(200) | |
| `ifsc_code` | NVARCHAR(20) | |
| `account_type` | NVARCHAR(50) | e.g. "Savings", "Current" |
| `is_active` | BIT | |

#### `payments`
All payment transactions.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `application_id` | INT FK → applications.id | |
| `payment_type` | NVARCHAR(30) | `'application_fee'`, `'college_fee'`, `'college_fee_installment'` |
| `amount` | DECIMAL(10,2) | Amount in INR |
| `gateway` | NVARCHAR(30) | `'payu'`, `'cash'` |
| `gateway_txnid` | NVARCHAR(100) | Transaction ID generated by backend, sent to PayU as `txnid` |
| `gateway_payment_id` | NVARCHAR(100) | Payment ID returned by PayU after success |
| `status` | NVARCHAR(20) | `'pending'`, `'success'`, `'failed'`, `'cancelled'` |
| `paid_by` | NVARCHAR(10) | `'student'` or `'college'` |
| `paid_by_user_id` | INT | ID of the user who paid |
| `attempted_at` | DATETIME2 | |
| `completed_at` | DATETIME2 | Set on success |

#### `payment_link_tokens`
Single-use tokens for WhatsApp payment links. Allows college to send a payment link to a student's WhatsApp without the student needing to log in.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `token` | NVARCHAR(100) UNIQUE | Random UUID used in the link URL |
| `application_id` | INT FK → applications.id | |
| `college_id` | INT FK → colleges.id | |
| `payment_type` | NVARCHAR(30) | `'application_fee'` or `'college_fee'` |
| `amount` | DECIMAL(10,2) | Fixed amount for this link (optional override) |
| `gateway_txnid` | NVARCHAR(100) | PayU txnid assigned on first page open; reused on reload (idempotency) |
| `used` | BIT DEFAULT 0 | Set to 1 after payment commits. Link becomes invalid |
| `expires_at` | DATETIME2 | 24 hours from creation |
| `created_at` | DATETIME2 | |

---

### Admission Tables

#### `admission_periods`
Defines the window during which students can apply for a specific course.

| Column | Type | Notes |
|---|---|---|
| `id` | INT IDENTITY PK | |
| `college_id` | INT FK | |
| `course_id` | INT FK → faculty_master | |
| `year_of_study` | INT 1-5 | |
| `academic_year` | NVARCHAR(10) | e.g. `'2024-25'` |
| `start_date` | DATE | Applications open from |
| `end_date` | DATE | Applications close on |
| `total_seats` | INT | |
| `filled_seats` | INT DEFAULT 0 | **Unused.** Filled seats are derived from application status at read time — see [Rule 6](#26-key-business-rules). The column is retained only because the audit triggers and `$Arc` archive reference it. |
| `is_active` | BIT DEFAULT 1 | |
| `is_disabled` | BIT DEFAULT 0 | Admin can disable without deleting |
| `created_at` | DATETIME2 | |

#### `applications`
The central table. One row per student application. Contains both status-machine fields and a full snapshot of the multi-step form data.

**Status/Control Fields:**

| Column | Notes |
|---|---|
| `id` INT PK | |
| `registration_number` | Assigned at submission/confirmation via an atomic per-scope counter. Format depends on `college_type` — see [Section 13a](#13a-registration--roll-numbers). |
| `student_id` FK | |
| `college_id` FK | |
| `course_id` FK | |
| `year_of_study` | 1–5 |
| `academic_year` | e.g. `'2024-25'` |
| `admission_period_id` FK | |
| `status` | See [Status Machine](#13-application-state-machine-status-flow) |
| `created_by_role` | `'student'` or `'college'` — who filled the form in. Stamped at creation, never changed. Decides whether the application walks the scrutiny pipeline or is directly approved. See [Section 13](#13-application-state-machine-status-flow). |
| `correction_note` | Message from college requesting correction |
| `rejection_reason` | Reason if rejected |
| `cancellation_reason` | |
| `fee_total_amount` | Set by college at confirmation step |
| `fee_pay_now_amount` | Partial amount student must pay now |
| `roll_number` | **General:** sequential integer assigned by the college's Roll Numbers batch after fees are paid. **Agriculture:** set equal to `registration_number` automatically at confirmation (no separate step). See [Section 13a](#13a-registration--roll-numbers). |
| `application_fee_paid` BIT | |
| `college_fee_paid` BIT | |
| `current_step` INT | Which step the wizard is on (1–6) |

**Step 1 — Personal Details (`app_` prefix):**
`app_surname`, `app_first_name`, `app_middle_name`, `app_mother_name`, `app_sex`, `app_mobile`, `app_email`, `app_address`, `app_taluka`, `app_district`, `app_state`, `app_category`, `app_special_status`, `fees_category`, `fees_category_override`, `fees_category_override_remark`, `app_division`, `app_degree_course_code`

**Step 2 — Other Details:**
`app_birth_date`, `app_birth_place`, `app_birth_taluka`, `app_birth_district`, `app_birth_state`, `app_nationality`, `app_marital_status`, `app_religion`, `app_caste`, `app_mother_tongue`, `app_height_cm`, `app_weight_kg`, `app_blood_group`, `app_father_full_name`, `app_son_daughter_no`, `app_father_occupation`, `app_annual_income`, `app_aadhaar`, `app_prn`, `app_abc_id`, `app_university_app_no`, `app_bank_account`, `app_bank_ifsc`, `app_bank_name`, `app_bank_branch`

**Feature-gated fields** (shown only when the college's `features_config` enables them — see [12a](#12a-college-types--features-config)):
- Added in migration 030: `app_hsc_maths`, `app_hsc_biology`, `app_hostel_facility`, `app_admitted_category`, `app_other_category`, `app_admission_quota`, and the parent-name split (`app_father_surname/first_name/middle_name`, `app_mother_surname/first_name/middle_name`).
- Added in migration 033 (agriculture): `app_date_of_admission`, `app_is_diploma_direct_sy`, `app_name_as_on_aadhaar`, `app_son_of`.
- Added in migration 034 (always shown): `app_native_address`, `app_native_taluka`, `app_native_district`, `app_parent_mobile`, `app_land_line`, `app_guardian_relation`.
- Added in migration 036 (agriculture): `app_semester` (INT 1–8).

**Timestamps:** `declaration_accepted_at`, `submitted_at`, `approved_at`, `confirmed_at`, `enrolled_at`, `status_updated_at`, `created_at`, `updated_at`

#### `application_activity_log`
Audit trail for every status change on an application.

| Column | Notes |
|---|---|
| `id` INT PK | |
| `application_id` FK | |
| `action` NVARCHAR(60) | e.g. `'submitted'`, `'rejected'`, `'roll_assigned'` |
| `actor_role` NVARCHAR(20) | `'student'`, `'college'`, `'system'` |
| `note` NVARCHAR(1000) | Optional message/reason |
| `created_at` DATETIME2 | |

#### `application_documents`
Links a student document upload to a specific application.

| Column | Notes |
|---|---|
| `id` INT PK | |
| `application_id` FK | |
| `student_document_id` FK → student_documents | |
| `document_type_id` FK | |
| `is_verified` BIT | Set by college after doc review |
| `verified_at` DATETIME2 | |

#### `application_previous_exam`
Previous exam records submitted by the student (SSC, HSC, etc.).

| Column | Notes |
|---|---|
| `exam_type` | `'SSC'`, `'HSC'`, etc. |
| `board_or_college_name` | |
| `school_or_college_address` | |
| `seat_number` | |
| `month_year_passing` | |
| `total_marks_obtained`, `total_marks_max`, `percentage` | |
| `class_grade` | e.g. `'First Class'` |
| `remark` | |

#### `application_subjects`
Subjects selected by the student (after roll number assignment).

| Column | Notes |
|---|---|
| `application_id` FK | |
| `semester` INT | |
| `subject_code` NVARCHAR(30) | |
| `subject_title` NVARCHAR(200) | |
| `display_order` INT | |

---

### Document Tables

#### `document_types`
Global master list of all supported document types.

| Column | Notes |
|---|---|
| `id` INT PK | |
| `name` NVARCHAR(100) | e.g. `'Aadhaar Card'`, `'Caste Certificate'` |
| `description` NVARCHAR(300) | |

#### `student_documents`
Actual file uploads by students. Multiple versions per type allowed.

| Column | Notes |
|---|---|
| `id` INT PK | |
| `student_id` FK | |
| `document_type_id` FK | |
| `file_name` NVARCHAR(300) | Original filename |
| `file_path` NVARCHAR(500) | Server path: `/uploads/students/{studentId}/{file}` |
| `uploaded_at` DATETIME2 | |

#### `college_required_documents`
Which documents a college requires for each course/year combination.

| Column | Notes |
|---|---|
| `college_id` FK | |
| `faculty_master_id` FK | |
| `year_of_study` INT 1-5 | |
| `document_type_id` FK | |
| `is_mandatory` BIT | If 0, document is optional |

---

### Certificate Tables

All three certificate tables follow the same pattern: soft-delete (`is_deleted`), unique index on `(college_id, certificate_no) WHERE is_deleted = 0`.

#### `certificate_bonafide`
Bonafide certificates issued.

| Column | Notes |
|---|---|
| `bonafide_id` INT PK | |
| `college_id` FK | |
| `certificate_no` NVARCHAR(50) | Unique per college |
| `certificate_date` DATE | |
| `reg_no` | Student registration number |
| `student_name` | |
| `gender` | |
| `is_ex_student` BIT | |
| `class_name` | |
| `academic_year` | |
| `birth_date` | |
| `roll_no` | |
| `caste` | |
| `created_by`, `updated_by` | User ID |
| `is_deleted` BIT | Soft delete |

#### `certificate_character`
Character certificates. Same fields as bonafide plus `known_from_years` (how many years the college has known the student).

#### `certificate_noc`
No Objection Certificates. Same fields as bonafide plus: `from_date`, `to_date`, `prn_no`, `final_confirmation_no`.

---

### System Tables

#### `whatsapp_message_log`
Tracks every WhatsApp message send attempt.

| Column | Notes |
|---|---|
| `phone` | Recipient number |
| `campaign_name` | Internal identifier |
| `template_id` | SMSala template ID used |
| `sample` | Template variable values |
| `status` | `'sent'`, `'failed'`, `'skipped'` |
| `campaign_id` | SMSala's return ID |
| `error_detail` | Error message if failed |
| `application_id` FK | Linked application if applicable |

#### `chatbot_knowledge`
Knowledge base articles for the AI chatbot.

| Column | Notes |
|---|---|
| `id` INT PK | |
| `category` | Topic category |
| `target_role` | `'student'`, `'college'`, `'both'` |
| `question` | Sample question |
| `answer` | Knowledge content |
| `keywords` | Comma-separated keywords for retrieval |

#### `chatbot_logs`
Logs every chatbot conversation turn.

| Column | Notes |
|---|---|
| `id` INT PK | |
| `user_id` INT | |
| `user_role` | |
| `question` | |
| `answer` | |
| `created_at` | |

---

## 7. Database Migrations

Migrations are in [BackEnd/scripts/migrations/](BackEnd/scripts/migrations/) and run via:

```bash
cd BackEnd
npm run migrate          # Run pending migrations
npm run migrate:status   # See which migrations have run
```

All migrations use `IF OBJECT_ID(...) IS NULL` guards so they are **safe to re-run**.

**Migration order:**

Migrations live in `BackEnd/scripts/migrations/`. Most are `.sql`; a few are `.js` (used when the change needs JSON manipulation or the shared preset constants). The `.js` ones are run with `node scripts/migrations/<file>.js`.

| File | What it does |
|---|---|
| `001_base_schema.sql` | All core tables. Run on a fresh database only. |
| `002_applications_app_fields.sql` | `app_*` snapshot columns on applications (already in 001; here for existing DBs). |
| `003_admission_periods_archive.sql` | Audit archive table + trigger for admission_periods. |
| `004_indexes.sql` | Performance indexes on frequently queried columns. |
| `005_seed_document_types.sql` | Inserts default document types (Aadhaar, Caste Cert, etc.). |
| `006_prev_exam_columns.sql` | Schema fix for `application_previous_exam` columns. |
| `007_applications_missing_columns.sql` | Adds any missing application columns. |
| `008_chatbot.sql` | Chatbot knowledge + logs tables. |
| `009_college_enabled.sql` | Adds `is_enabled` column to colleges. |
| `010_role_perm_manage_admission_periods.sql` | Seeds the "manage admission periods" role permission. |
| `011_audit_arc_tables.sql` | Audit archive (`$Arc`) tables for core entities. |
| `012_seed_super_admin.sql` | Seeds the default super-admin (password `Admin@123`). |
| `013_created_updated_by.sql` | Adds `created_by` / `updated_by` audit columns. |
| `014_payu_payments.sql` | PayU gateway columns (`gateway`, `gateway_txnid`, ...). |
| `015_classwise_fees_student_type.sql` | Adds `student_type` to classwise fees. |
| `016_fee_installments.sql` | Fee installment plan support. |
| `017_academic_year_fees.sql` | Adds `academic_year` to fees master + classwise fees. |
| `018_arc_academic_year.sql` | Adds `academic_year` to archive tables. |
| `019_payment_link_tokens.sql` | Shareable WhatsApp/PayU payment link tokens. |
| `020_payment_link_tokens_txnid.sql` | Adds `gateway_txnid` to payment link tokens (reload idempotency). |
| `021_audit_triggers_payments_links.sql` | Audit triggers for payments + payment link tokens. |
| `022_category_master.sql` | Dynamic category master: castes, special statuses, fees categories. |
| `023_payment_type_misc_exam.sql` | Extends `payment_type` to include misc/exam fees. |
| `024_payments_notes_column.sql` | Adds `notes` column to payments. |
| `025_backfill_activity_log.sql` | Backfills activity log for existing applications. |
| `026_receipt_numbering.sql` | Receipt numbering (counters + `receipt_no`). |
| `027_clear_test_data.sql` | One-time cleanup of test data. |
| `028_otp_student_transfer.sql` | Adds `student_transfer` as a valid OTP purpose. |
| `029_features_config.sql` | Adds `features_config` JSON column to colleges (see [12a](#12a-college-types--features-config)). |
| `030_new_admission_fields.sql` | Adds admitted/other category, quota, hostel, HSC flags, parent-name split columns. |
| `031_college_type.sql` | Adds `college_type` column to colleges. |
| `032_realign_admission_form_to_type.js` | Re-aligns each college's `admission_form` features to its type preset. |
| `033_agri_admission_fields.sql` | Agriculture fields: date of admission, diploma/direct-SY, name-as-on-Aadhaar, S/o. |
| `034_general_admission_fields.sql` | General fields: native address, parent mobile, land line, guardian relation. |
| `035_realign_college_fee_to_type.js` | Re-aligns `payment.college_fee` to each college's type (general = on, agriculture = off). |
| `036_app_semester.sql` | Adds `app_semester` column (agriculture semester field, 1–8). |
| `037_students_email_non_unique.sql` | Drops the UNIQUE constraint on `students.email` — duplicate student emails are now allowed (phone stays unique). |
| `038_college_users_phone.sql` | Adds `phone` to `college_users` (staff) so staff can receive a password-reset OTP. |
| `039_otp_college_reset_purpose.sql` | Adds `college_password_reset` as a valid `otp_store.purpose` (college admin/staff forgot-password). |
| `040_applications_created_by_role.sql` | Adds `applications.created_by_role` (`student`/`college`, default `student`). Drives whether an application walks the scrutiny pipeline or is directly approved — see [Section 13](#13-application-state-machine-status-flow). |
| `041_filled_seats_derived.sql` | Seats now fill on **confirmation**, not on application. Zeroes the stale `admission_periods.filled_seats` counter, which is no longer maintained — filled seats are derived from application status. See [Rule 6](#26-key-business-rules). |
| `042_exam_registration.sql` | Adds exam-registration tables/columns. |
| `043_role_perm_exams.sql` | Adds the `exams` permission to the role/permission model. |
| `044_registration_counters.sql` | Adds the `registration_counters` table for atomic, race-safe registration-number serials, backfilled from existing numbers. See [Section 13a](#13a-registration--roll-numbers). |

> **Important:** On a brand-new database, run `001` first, then everything in order. On an existing database, run from wherever you left off. The `.sql` migrations are idempotent (safe to re-run); the `.js` re-alignment scripts are also safe to re-run (they only change rows that differ from the preset).

### Rules for writing migrations

**`npm run migrate` only runs `.sql` files.** `scripts/migrate.js` filters on
`.endsWith('.sql')`, so `.js` migrations must be run by hand:

```bash
node scripts/migrations/032_realign_admission_form_to_type.js
node scripts/migrations/035_realign_college_fee_to_type.js
```

Both only re-align **existing** colleges' `features_config` to their `college_type`, so on
a database with no colleges yet there is nothing to align.

**Never put `USE <database>;` in a migration.** Migrations must run against whatever
database the connection points at (`DB_NAME` in `.env`).

**Reseed identities with `DBCC CHECKIDENT (t, RESEED)` — never `RESEED, 0`.** On an empty
table, `RESEED, 0` makes the next inserted row get id **`0`**; the no-value form correctly
starts at **`1`**. IDs must always start at 1 (`0` is falsy in JavaScript and breaks id
checks). When verifying, check **`IDENT_SEED`** (must be `1`), not `IDENT_CURRENT` — the
latter still reports `0` on a freshly-reseeded empty table.

To repair a database whose ids already start at 0, run
[`scripts/fix_identity_seeds.js`](BackEnd/scripts/fix_identity_seeds.js) — it wipes
students/applications and reseeds those tables to start at 1 (colleges, staff, roles,
masters and fees are kept). ⚠️ Destructive.

---

## 8. Backend Architecture

### Entry Point Flow

```
bin/www
  └── app.js
        ├── Helmet (security headers)
        ├── CORS (allowed origins from .env)
        ├── Morgan (HTTP logging)
        ├── express.json() (body parser)
        ├── cookieParser
        ├── Static files (/public)
        ├── Mount all routes
        ├── 404 handler
        ├── Global error handler (never leaks internals in prod)
        └── app.listen(:8000) + startOtpCleanup()
```

### Database Connection (`routes/db.js`)

Single MSSQL connection pool. All routes `require('../routes/db')` to get the pool. Connection details come from env vars.

### Request Authentication Flow

Every protected route uses the `authenticate` middleware from [BackEnd/middleware/auth.js](BackEnd/middleware/auth.js):

1. Reads JWT from `auth_token` **httpOnly cookie** (preferred)
2. Falls back to `Authorization: Bearer <token>` header
3. Verifies JWT signature with `JWT_SECRET`
4. Attaches decoded payload to `req.user`
5. Next middleware checks role as needed

### JWT Payload Structure

```json
{
  "id": 42,
  "role": "student",
  "email": "student@example.com",
  "iat": 1234567890,
  "exp": 1235172690,
  "sxp": 1235172690
}
```

> **`sxp` (session expiry)** — the **absolute daily deadline** (epoch seconds). See
> [Session Expiry](#session-expiry-daily-logout). `/auth/refresh` re-issues a token but
> can **never** extend it past `sxp`, so every user is logged out once a day.

For college staff:
```json
{
  "id": 5,
  "role": "college",
  "email": "staff@college.com",
  "is_staff": true,
  "permissions": {
    "applications": true,
    "masters": false
  }
}
```

---

## 9. All API Routes

Base URL: `http://localhost:8000` (or your production domain)

---

### Authentication — `/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register/student` | Public | Register student. Requires OTP verification |
| POST | `/auth/login/student` | Public | Student login. Sets httpOnly cookie |
| POST | `/auth/login/college` | Public | College admin/staff login |
| POST | `/auth/login/admin` | Public | Super admin login |
| POST | `/auth/otp/send` | Public | Send OTP to phone via WhatsApp |
| POST | `/auth/otp/verify` | Public | Verify OTP + complete student registration |
| POST | `/auth/forgot-password/send-otp` | Public | **Student** reset — send OTP to their phone (identified by phone) |
| POST | `/auth/forgot-password/reset` | Public | **Student** reset — verify OTP + set new password |
| POST | `/auth/forgot-password/college/send-otp` | Public | **College** reset — identified by **email** (admin or staff); OTP goes to the phone on file |
| POST | `/auth/forgot-password/college/reset` | Public | **College** reset — verify OTP + set new password on the matching account |
| POST | `/auth/logout` | Authenticated | Clear auth cookie |
| POST | `/auth/refresh` | Authenticated | Re-issue the JWT. **Cannot extend a session past its daily `sxp` deadline** — returns 401 once that passes. |

---

### Colleges — `/colleges`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/colleges` | Public | List all enabled colleges |
| GET | `/colleges/:id` | Public | Get single college details |
| GET | `/colleges/:id/courses` | Public | Get college's active programs |
| GET | `/colleges/:id/admission-periods` | Public | Get active admission windows |
| POST | `/colleges` | Admin only | Create a new college |
| PATCH | `/colleges/:id/toggle-enabled` | Admin only | Enable/disable a college |

---

### Application Form — `/api`

Multi-step form endpoints. The form is a wizard saved step-by-step.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/applications/init` | Student | Create a new draft or return existing draft for same college+course+year |
| GET | `/api/applications/:id/form` | Student | Load all saved form data for wizard |
| PATCH | `/api/applications/:id/personal-details` | Student | Save Step 1 (name, address, category) |
| PATCH | `/api/applications/:id/other-details` | Student | Save Step 2 (DOB, family, bank, aadhaar) |
| PATCH | `/api/applications/:id/previous-exam` | Student | Save Step 3 (SSC/HSC exam records) |
| POST | `/api/applications/:id/declaration` | Student | Accept declaration (Step 4) |
| GET | `/api/applications/:id/subject-selections` | Student | Get available subjects for selection |
| POST | `/api/applications/:id/subject-selections` | Student | Save subject selections |

---

### Applications — `/applications`

Student's application listing and management.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/applications` | Student | List student's own applications |
| GET | `/applications/:id` | Student | Get full application detail |
| POST | `/applications/:id/subjects` | Student | Submit subject selections (post-roll-assignment) |

---

### Payments — `/payments`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/payments/initiate` | Student | Initiate a PayU payment — returns HTML form fields to auto-submit |
| POST | `/payments/payu-return` | Public | PayU POST-back after checkout (verifies hash, commits payment, redirects to `/payment-result`) |
| POST | `/payments/payu-webhook` | Public | PayU async webhook (backup in case redirect fails) |
| GET | `/payments/college-fee-status/:applicationId` | Student | Check if college fee is paid |
| GET | `/payments/receipts` | Student | List payment receipts |
| GET | `/payments/pay/:token` | **Public** | WhatsApp payment link landing page — renders PayU auto-submit form (no login required) |
| POST | `/payments/send-payment-link` | College | Generate a payment link token and send it to student via WhatsApp |

---

### College Admin — `/college-admin`

All routes require college role. Staff also need appropriate permissions.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/college-admin/:collegeId/admission-periods` | College | List admission periods |
| POST | `/college-admin/:collegeId/admission-periods` | College (write) | Create admission period |
| PUT | `/college-admin/:collegeId/admission-periods/:id` | College (write) | Update admission period |
| DELETE | `/college-admin/:collegeId/admission-periods/:id` | College (write) | Delete admission period |
| GET | `/college-admin/:collegeId/applications` | College | List applications with filters. Also returns `status_counts` + `status_total` — per-status counts computed **ignoring the status filter** (see Rule 24). |
| GET | `/college-admin/:collegeId/applications/:appId` | College | Get full application detail. Also embeds the college's parsed `features` so the review gates fields from the authoritative config (never a stale cache). |
| POST | `/college-admin/:collegeId/applications/:appId/request-correction` | College (write) | Ask student to fix something |
| POST | `/college-admin/:collegeId/applications/:appId/accept-scrutiny` | College (write) | Accept after review |
| POST | `/college-admin/:collegeId/applications/:appId/reject` | College (write) | Reject application |
| POST | `/college-admin/:collegeId/applications/:appId/confirm` | College (write) | Confirm admission + set fee |
| POST | `/college-admin/:collegeId/applications/:appId/verify-docs` | College (write) | Mark documents verified |
| POST | `/college-admin/:collegeId/roll-numbers/generate` | College (write) | Auto-generate roll numbers (general only — rejects agriculture, where reg-no is the roll-no). See [13a](#13a-registration--roll-numbers). |
| POST | `/college-admin/:collegeId/applications/:appId/assign-roll` | College (write) | Manually assign roll number |
| GET | `/college-admin/:collegeId/export-applications` | College | Export applications as Excel/CSV |
| POST | `/college-admin/:collegeId/applications/:appId/record-application-fee` | College (write) | Record cash application fee payment — submits application and generates registration number |
| GET | `/college-admin/:collegeId/fee-receipts` | College | List all payment records (cash + online) |

---

### Masters — `/masters`

All master data CRUD endpoints. All require college access.

| Method | Path | Description |
|---|---|---|
| GET/POST | `/masters/:collegeId/faculty-master` | List / Create programs |
| GET/PUT | `/masters/:collegeId/faculty-master/:id` | Get / Update program |
| GET/POST | `/masters/:collegeId/bank-master` | List / Create bank accounts |
| GET/PUT | `/masters/:collegeId/bank-master/:id` | Get / Update bank account |
| GET/POST | `/masters/:collegeId/course-master` | List / Create subjects |
| GET/PUT | `/masters/:collegeId/course-master/:id` | Get / Update subject |
| GET/POST | `/masters/:collegeId/division-master` | List / Create divisions |
| GET/PUT | `/masters/:collegeId/division-master/:id` | Get / Update division |
| GET/POST | `/masters/:collegeId/group-master` | List / Create elective groups |
| GET/PUT | `/masters/:collegeId/group-master/:id` | Get / Update group |
| POST | `/masters/:collegeId/group-master/:id/courses` | Add courses to group |
| GET/POST | `/masters/:collegeId/fees-master` | List / Create fee heads |
| GET/PUT | `/masters/:collegeId/fees-master/:id` | Get / Update fee head |
| GET/POST | `/masters/:collegeId/required-documents` | List / Set required docs |
| DELETE | `/masters/:collegeId/required-documents/:id` | Remove required doc |

---

### Certificates — `/certificates`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/certificates/:collegeId` | College | List all issued certificates |
| POST | `/certificates/bonafide` | College | Issue bonafide certificate |
| POST | `/certificates/character` | College | Issue character certificate |
| POST | `/certificates/noc` | College | Issue NOC |
| GET | `/certificates/:certId/download` | College | Download/view a certificate |
| DELETE | `/certificates/:certId` | College | Soft-delete a certificate |

---

### Documents — `/` (documents router mounted at root)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/documents/upload` | Student | Upload a document file |
| GET | `/documents/:docId` | Authenticated | Fetch document file |
| DELETE | `/documents/:docId` | Student | Delete own document |
| GET | `/applications/:appId/documents` | College | List documents for an application |

---

### Notifications — `/notifications`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/notifications` | Authenticated | List user's notifications |
| PATCH | `/notifications/:id/read` | Authenticated | Mark notification as read |
| PATCH | `/notifications/read-all` | Authenticated | Mark all as read |

---

### Chat — `/chat`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/chat/ask` | Authenticated | Send question to AI chatbot |
| GET | `/chat/history` | Authenticated | Get conversation history |

---

### Admin — `/admin`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/admin/colleges/:collegeId/users` | Admin | List college staff users |
| POST | `/admin/colleges/:collegeId/users` | Admin | Create college staff user. Accepts an optional `phone` (10-digit) used for their password-reset OTP. |
| PUT | `/admin/colleges/:collegeId/users/:userId` | Admin | Update staff user (incl. `phone`). |
| DELETE | `/admin/colleges/:collegeId/users/:userId` | Admin | Delete staff user |
| GET | `/admin/colleges/:collegeId/roles` | Admin | List college roles |
| POST | `/admin/colleges/:collegeId/roles` | Admin | Create role |
| PUT | `/admin/colleges/:collegeId/roles/:roleId` | Admin | Update role permissions |
| DELETE | `/admin/colleges/:collegeId/roles/:roleId` | Admin | Delete role |

---

## 10. Authentication & Authorization

### How it works

1. User logs in → backend creates a JWT → sets it as the httpOnly cookie `auth_token`.
   The token expires at the **next daily boundary** (see below), not after a fixed window.
2. Frontend stores only `{ user, role }` in `localStorage` (NO token in localStorage — it's in the httpOnly cookie).
3. Every API request sends the cookie automatically (Axios has `withCredentials: true`).
   *(Cross-origin / LAN dev uses an `Authorization: Bearer` header instead.)*
4. Frontend `AuthContext` calls `POST /auth/refresh` on load and then **hourly**.
5. On 401, the Axios interceptor clears local auth state and redirects to login.

### Session Expiry (daily logout)

**Every session expires at a fixed hour each day** — all users are logged out daily.

- **Config:** `SESSION_EXPIRY_HOUR` in `BackEnd/.env` — hour of day `0–23`, local time.
  Currently **`3`** (3:00 AM). Default if unset: `0` (midnight).
- At login the token is signed to expire at the **next occurrence of that hour**, and the
  deadline is embedded in the token as the **`sxp`** claim (epoch seconds).
- **`/auth/refresh` honours `sxp` and can never extend a session past it.** It re-issues a
  token with the *same* deadline. Once `sxp` passes, refresh returns **401**
  (*"Your session has expired for the day. Please log in again."*) and the user must log in.
- The auth cookie's `maxAge` matches the same deadline.
- Applies to **all roles** — student, college admin, college staff, super admin.

> ⚠️ **Why the `sxp` claim exists:** simply shortening the token lifetime would *not*
> produce a daily logout — the frontend auto-refresh would keep minting fresh tokens
> indefinitely. The absolute `sxp` deadline is what actually forces the logout, even for a
> user who is actively working in the app.

**Examples** (with `SESSION_EXPIRY_HOUR=3`):

| Login time | Session expires |
|---|---|
| 1:50 PM Mon | **3:00 AM Tue** |
| 1:00 AM Tue (before 3 AM) | **3:00 AM Tue** (same day) |

Relevant code: `signSessionToken()` / `nextExpiryDate()` in [BackEnd/routes/auth.js](BackEnd/routes/auth.js);
refresh loop in [FrontEnd/src/context/AuthContext.jsx](FrontEnd/src/context/AuthContext.jsx).

### Middleware Guards

| Middleware | Usage | Behavior |
|---|---|---|
| `authenticate` | All protected routes | Verifies JWT, attaches `req.user` |
| `requireStudent` | Student-only routes | Checks `req.user.role === 'student'` |
| `requireCollegeAccess` | College routes | Checks role + matching collegeId + live DB check that college is enabled |
| `requireAdmin` | Admin-only routes | Checks `req.user.role === 'admin'` |
| `requirePerm(perm)` | College staff routes with permissions | Main admin always passes; staff need the permission in JWT |
| `requireWrite(perm)` | Mutating college staff routes | Staff needs `can_write: true` for the permission |

### Password Policy
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Enforced at registration and password reset

---

## 11. Frontend Architecture

### State Management

The app uses **React Context** (not Redux):

- **AuthContext** — `user`, `role`, `isAuthenticated`, `saveSession()`, `logout()`
- **ToastContext** — Toast notification queue, `showToast(message, type)`

### API Layer (`src/services/api.js`)

Central Axios instance with:
- `baseURL` from `VITE_API_URL` env var
- `withCredentials: true` (sends cookies)
- **Request interceptor**: Adds `Content-Type: application/json`
- **Response interceptor**: On 401, clears auth state + redirects to login

All API calls go through domain-specific service files:

| File | Purpose |
|---|---|
| `authService.js` | Login, register, OTP, password reset |
| `applicationService.js` | Multi-step form, application CRUD |
| `collegeAdminService.js` | College-side application management + `sendPaymentLink()` |
| `collegeService.js` | College browsing, admission periods |
| `paymentService.js` | Student payment flow (PayU initiation, fee status, receipts) |
| `documentService.js` | File upload/download |
| `masterService.js` | All master data CRUD |
| `certificateService.js` | Certificate generation |
| `notificationService.js` | Notification management |
| `adminService.js` | Super admin operations |
| `chatService.js` | Chatbot API calls |

### Route Protection

`ProtectedRoute` component checks `allowedRoles`:

```jsx
<Route element={<ProtectedRoute allowedRoles={['student']} />}>
  <Route path="/student/dashboard" element={<StudentDashboard />} />
</Route>
```

- If not authenticated → redirects to login
- If wrong role → redirects to own dashboard

### Lazy Loading

All page components are lazy-loaded with `React.lazy()`. This means each page is a separate JS chunk and only downloaded when visited, keeping initial load fast.

---

## 12. All Frontend Routes & Pages

### Auth Routes (No layout)

| Path | Component | Description |
|---|---|---|
| `/login/student` | `StudentLogin` | Student login form |
| `/login/college` | `CollegeLogin` | College admin login form |
| `/login/vtadmin` | `AdminLogin` | Super admin login form |
| `/register/student` | `StudentRegister` | Student registration with OTP flow |
| `/forgot-password` | `ForgotPassword` | **Student** password reset (by phone) with OTP |
| `/college/forgot-password` | `CollegeForgotPassword` | **College** password reset (admin + staff, by email) with OTP |

### Application Wizard (Full-screen, no sidebar)

| Path | Component | Description |
|---|---|---|
| `/apply/:applicationId` | `ApplyWizard` | Student's 6-step application form |
| `/college/apply/:applicationId` | `CollegeApplyWizard` | College-side application view wizard |
| `/payment-result` | `PaymentResult` | Landing page after PayU redirect. Reads `?status`, `?reg`, `?msg`, `?via` params and shows appropriate screen |

### Student Routes (DashboardLayout)

| Path | Description |
|---|---|
| `/student/dashboard` | Overview: stats, recent applications, shortcuts |
| `/student/browse-colleges` | Browse colleges, view programs, fees, start application |
| `/student/my-applications` | List all applications with status |
| `/student/college-fee-payment` | Pay college fees after admission confirmation |
| `/student/payment-receipts` | View and download payment receipts |
| `/student/documents` | Upload and manage personal documents |
| `/student/notifications` | Notification center |
| `/student/subject-selection` | Select subjects after roll number is assigned |

### College Admin Routes (DashboardLayout)

| Path | Description |
|---|---|
| `/college/dashboard` | Overview stats: applications, seats, revenue |
| `/college/applications` | Application inbox with filter/search |
| `/college/application/:id` | Full application detail + action buttons |
| `/college/admission-periods` | Create/edit/disable admission windows |
| `/college/roll-numbers` | Assign roll numbers to confirmed students |
| `/college/fee-receipts` | View all payment records |
| `/college/masters/programs` | Faculty/Program master CRUD |
| `/college/masters/courses` | Course/Subject master CRUD |
| `/college/masters/divisions` | Division master CRUD |
| `/college/masters/fees` | Fees master CRUD |
| `/college/masters/bank` | Bank master CRUD |
| `/college/masters/documents` | Required documents configuration |
| `/college/masters/groups` | Elective group CRUD |
| `/college/certificates` | Issue and manage certificates |

### Super Admin Routes (DashboardLayout)

| Path | Description |
|---|---|
| `/admin/dashboard` | Platform overview |
| `/admin/colleges` | List all colleges, create new college, toggle enable/disable |
| `/admin/college/:id/roles` | Manage roles and permissions for a college |

---

## 12a. College Types & Features Config

Not every college wants the same admission form. A general arts/science/commerce college needs different fields than an agriculture college, and some colleges charge fees while others don't. Instead of hard-coding this, each college has a **type** and a **features config**.

### The big picture

```
College Type  ──picks──►  a preset  ──writes──►  features_config (JSON on the college row)
   (general /                                          │
    agriculture)                                       ▼
                                        The form, reviews, validation, and fee
                                        steps all READ features_config to decide
                                        which fields to show and which fees to charge.
```

- **`college_type`** — a single column on `colleges`. Either `'general'` or `'agriculture'`. This is the only knob the Super Admin turns.
- **`features_config`** — a JSON blob on `colleges`. This is the **source of truth** the whole app reads. The type just decides its starting values.
- **Presets** live in one file: `BackEnd/constants/collegePresets.js`. Picking a type at onboarding (or changing it later) writes that type's preset into `features_config`.

> **Why two layers?** The form code only ever reads `features_config`, never `college_type` directly. So adding a new college type, or letting an admin fine-tune one field, never requires touching the form code.

### What features_config looks like

```json
{
  "payment": {
    "platform_fee": true,      // charge an application fee at submission?
    "college_fee": true        // does this college run a college-fee system?
  },
  "admission_form": {
    "caste_category": true,     // show caste/category selection
    "admitted_category": false, // separate "Admitted Category" field
    "other_category": false,    // FF, DP, PH, PD, AG, OS, PAP, Spot Round
    "admission_quota": false,   // 70%, 30%, OS, Goa, ICAR, J&K, Management
    "hostel_facility": false,   // hostel checkbox
    "hsc_subject_flags": false, // "Passed with Maths / Biology at HSC"
    "bank_details": true,
    "abc_id": true,
    "prn": true,
    "father_name_split": false, // split parent names into Surname/First/Middle
    "date_of_admission": false, // defaults to today; editable
    "diploma_direct_sy": false, // "Diploma Student (Direct SY)" — only shown for SY admissions
    "name_as_on_aadhaar": false,
    "son_of": false,
    "semester": false           // Semester 1–8, options derived from admission year
  },
  "documents": {
    "required_docs": true,          // online document upload step
    "certificate_checklist": false  // simple checkbox list of certificates
  },
  "notifications": { "whatsapp": true, "email": true }
}
```

### The two presets

| Feature | General preset | Agriculture preset |
|---|---|---|
| `payment.college_fee` | **true** (has college fees) | **false** (no college fees) |
| `admission_form.admitted_category` | false | **true** |
| `admission_form.other_category` | false | **true** |
| `admission_form.admission_quota` | false | **true** |
| `admission_form.hostel_facility` | false | **true** |
| `admission_form.hsc_subject_flags` | false | **true** |
| `admission_form.date_of_admission` | false | **true** |
| `admission_form.diploma_direct_sy` | false | **true** |
| `admission_form.name_as_on_aadhaar` | false | **true** |
| `admission_form.son_of` | false | **true** |
| `admission_form.semester` | false | **true** |
| `documents.certificate_checklist` | false | **true** |

Everything not listed above is the same in both (caste category, bank details, ABC ID, PRN on; `platform_fee` on).

Some fields (Native Address, Parent's Mobile, Land Line, Guardian's Relation) are **always shown for every college** — they have no toggle.

**Field-specific rules for the agriculture form:**
- **Semester** options are derived from the admission year — FY → 1,2 · SY → 3,4 · TY → 5,6, etc. Required.
- **Diploma Student (Direct SY)** is only shown for **SY** admissions (`year_of_study === 2`). When checked, semesters 1 & 2 are blocked (the student enters at SY).
- **Date of Admission** defaults to today for new applications (still editable).

### How a feature flag is used

- **Show/hide a form field** — the form checks `features.admission_form.<key> === true` before rendering that field, and the review/print screens do the same.
- **Require a field** — when a field is enabled, the frontend *and* the backend (`personal-details` route) both require it.
- **Fees** — `payment.college_fee` controls the whole college-fee flow (fees category field, installment plan, fee receipts). `payment.platform_fee` controls whether an application fee is charged at submission.

### Where it is set / read

| Action | Endpoint / file |
|---|---|
| Create college with a type | `POST /colleges` (writes preset to `features_config`) |
| Change a college's type later | `PUT /admin/colleges/:id` with `{ college_type }` (overwrites `features_config`) |
| Admin reads type + config | `GET /admin/colleges/:id/features` |
| Form/reviews read config | `GET /college-admin/:id/features` and `GET /api/applications/:id/form` |
| Presets defined | `BackEnd/constants/collegePresets.js` |
| Admin UI to pick type | `FrontEnd/src/features/admin/components/FeaturesPanel.jsx` |

> **Keeping data in sync:** if a college's `college_type` and `features_config` ever disagree (e.g. after adding a new preset key), the re-alignment scripts `032_realign_admission_form_to_type.js` and `035_realign_college_fee_to_type.js` rewrite the type-driven parts of `features_config` from the preset.

---

## 13. Application State Machine (Status Flow)

### The three admission rules

Where an application goes is decided by two things: **whether the application fee is paid**, and **who filled the form in** (`applications.created_by_role`, set to `'student'` or `'college'` when the application is created and never changed afterwards).

**Rule 1 — no submission without the application fee.**
An application stays in `draft` until the application fee is paid. Paying the fee *is* what submits it. The only exception is when the college owes no fee: either the `payment.platform_fee` feature is disabled for that college, or its `application_fee` is 0 — then the application submits without payment and a ₹0 payment row is recorded so the payment history stays complete.

**Rule 2 — a student-submitted application walks the full scrutiny pipeline.**
It lands in `submitted` and the college must accept it, mark the student as visited, pick a division and set fees before it can be confirmed. Confirming straight out of `submitted` is rejected.

**Rule 3 — a college-filled application is directly approved.**
The college is reviewing it inline as it fills the form, so scrutiny is skipped: paying the application fee takes it straight to `confirmed`.

What "admission successful" means then depends on the college type:

| Who filled the form | General college | Agriculture college |
|---|---|---|
| **Student** | app fee → full scrutiny → college fee → `fees_paid` | app fee → full scrutiny → `confirmed` |
| **College** | app fee → **direct approve** → college fee → `fees_paid` | app fee → **direct approve** → `confirmed` |

Agriculture colleges have `payment.college_fee` disabled, so there is no college-fee step — `confirmed` **is** admission success. General colleges charge a college fee, so success is `fees_paid`.

These rules are enforced in `routes/payments.js` (online application-fee payment — both the PayU return and the webhook), `routes/college_admin.js` (`record-application-fee` for cash, and `confirm`), and `routes/applications.js` (`POST /:id/submit`). All of them branch on `created_by_role` and never move an application backwards: an application already past `submitted` keeps its current status when a fee is posted again.

### Full status flow

The `status` column in `applications` follows this flow:

```
  STUDENT REGISTERS → STARTS APPLICATION
         │
         ▼
     [draft]  ─── student fills form steps ───►  payment_pending
         │                                              │
         │                                Student pays the application fee
         │                                (Rule 1 — nothing submits without it,
         │                                 unless the college charges no fee)
         ▼                                              │
   (stays draft                                         ▼
    while unpaid)                               [submitted]
                                                   │
                                            College receives it
                                                   │
                                                   ▼
                                          [under_review]
                                          /              \
                              College                  College
                             requests fix             rejects
                                 │                       │
                                 ▼                       ▼
                    [correction_requested]          [rejected] ──► FINAL
                                 │
                        Student corrects
                                 │
                                 ▼
                        [correction_done]
                                 │
                          College reviews
                                 │
                                 ▼
                      [scrutiny_accepted]
                                 │
                                 ▼
                   [doc_verification_pending]
                                 │
                          College verifies docs
                                 │
                                 ▼
                          [doc_verified]
                                 │
                         College confirms
                       (sets total fee amount)
                                 │
                                 ▼
                          [confirmed]
                                 │
                        Student pays college fee
                                 │
                                 ▼
                          [fees_paid]
                                 │
                     College assigns roll number
                                 │
                                 ▼
                         [roll_assigned]
                                 │
                        Student selects subjects
                                 │
                                 ▼
                          [enrolled] ──► FINAL
```

Additionally, any application can be moved to `[cancelled]` at any non-terminal stage.

### The college-side shortcut (Rule 3)

The long path above is the **student-submitted** pipeline (`created_by_role = 'student'`). When a **college** creates and submits an application on a walk-in student's behalf (Flow B, `created_by_role = 'college'`), it does **not** go through the manual `under_review → scrutiny_accepted → doc_verified` steps — the college is already reviewing it inline. Instead:

```
[draft] ──application fee paid──► [confirmed] ──college fee paid──► [fees_paid] ──► ...
                                       ▲
                          for an agriculture college this
                          is already admission success
```

- Paying the **application fee** — by cash (`record-application-fee`) or online (the PayU return / webhook) — moves the application straight to **`confirmed`**.
- The "Confirm & Collect Fee" step then records the college fee on the already-`confirmed` application. The confirm endpoint accepts `confirmed` status for exactly this reason (it is **idempotent** — confirming again just saves the fee total / installments / division rather than erroring).
- The confirm endpoint does **not** accept `submitted`. A student-submitted application must be accepted through `/approve` first; confirming it directly would skip the scrutiny Rule 2 requires.

### Status descriptions

| Status | Who sets it | Meaning |
|---|---|---|
| `draft` | System | Application started but not submitted (form incomplete, or the application fee is unpaid) |
| `payment_pending` | System | Form complete, awaiting payment |
| `submitted` | System | Application fee paid by a **student**; application sent to the college for scrutiny |
| `under_review` | College | College has opened the application |
| `correction_requested` | College | College wants student to fix something (with note) |
| `correction_done` | Student | Student has made corrections and resubmitted |
| `scrutiny_accepted` | College | Application passed initial scrutiny |
| `doc_verification_pending` | College | Waiting for document verification |
| `doc_verified` | College | All documents checked and verified |
| `confirmed` | College / System | Admission confirmed and the college fee set. Set by the college at the end of scrutiny, or automatically on application-fee payment for a college-filled application (Rule 3). For an **agriculture** college this is the final success state — there is no college fee. |
| `fees_paid` | System | College fee paid by student |
| `roll_assigned` | College | Roll number assigned |
| `enrolled` | College/System | Student fully enrolled |
| `rejected` | College | Application rejected |
| `cancelled` | Student/Admin | Application cancelled |

---

## 13a. Registration & Roll Numbers

**Service:** [BackEnd/services/RegistrationNumberService.js](BackEnd/services/RegistrationNumberService.js)
**Counter table:** `registration_counters` (migration `044`)

Every confirmed/submitted application is assigned a **registration number**. The format is
self-describing and depends on the college's `college_type`. Both formats embed the college
code, course code and year of study, so each number is globally unique.

| Type | Format | Example |
|---|---|---|
| **General** | `S` + `<compactYear>` + `<collegeCode>` + `<courseCode>` + `<yearOfStudy>` + `<serial4>` | `S2425ELPS002101` → `S2425ELPS0021…` |
| **Agriculture** | `<startYear>` + `<collegeCode>` + `<courseCode>` + `<yearOfStudy>` + `<serial3>` | `2026BSKKVBSCAGRI1003` |

- **compactYear** — general uses the two-year form: `2024-25` → `2425`.
- **startYear** — agriculture uses the 4-digit start year: `2025-26` → `2025`.
- **collegeCode** — `colleges.college_code`, uppercased, whitespace removed.
- **courseCode** — `faculty_master.degree_course_code` (uppercased, whitespace removed).
- **serial** — running number per **college + course + year_of_study + academic_year**, 4 digits (general) or 3 digits (agriculture).

The `registration_number` column is `NVARCHAR(30)` and has a NULL-safe **unique index**
(`uix_applications_reg_number`), so a duplicate can never be stored.

### Race-safe serial (atomic counter)

The serial does **not** come from `COUNT(*)`. It comes from an atomic per-scope counter row
in `registration_counters`, incremented with `MERGE … WITH (HOLDLOCK)` **inside the caller's
transaction** — the same pattern as [ReceiptNumberService](BackEnd/services/ReceiptNumberService.js). This means:

- **No duplicates under concurrency.** Two simultaneous submissions in the same scope are
  serialised by the row lock and receive consecutive serials. (The old `COUNT(*)` approach
  would give both the same number; the second write would then fail the unique index with a
  500 error.)
- **No serial reuse.** The counter only ever increases, so deleting an application never
  causes a freed serial to be reissued.

Because the increment must be transactional, `generate()` **requires** a transaction request
(`tx.request()`); calling it without one throws. All five generation sites run inside a
transaction: `applications.js` (`/:id/submit`), `application_form.js` (`submit-direct`),
`payments.js` (application-fee commit), and `college_admin.js` (offline fee collection);
`college_admin.js`'s `confirm` reuses an already-assigned number.

### Roll numbers

The roll-number rule differs by college type:

| Type | Roll number |
|---|---|
| **General** | A separate step. The college runs the **Roll Numbers** batch (`POST /college-admin/:collegeId/roll-numbers/generate`), which assigns sequential integers to `fees_paid` applications in fee-payment order and moves them to `roll_assigned`. |
| **Agriculture** | **No separate step.** The registration number *is* the roll number — `roll_number` is set equal to `registration_number` automatically at confirmation, in the same UPDATE that assigns the reg-no. |

Consequences for agriculture colleges:

- The **Roll Numbers** page is hidden in the college portal (sidebar nav + dashboard card +
  the `?section=rollnumbers` route all gate on `college_type`, surfaced to the frontend via
  `GET /college-admin/:collegeId/features`).
- The batch endpoint `POST /:collegeId/roll-numbers/generate` **rejects** agriculture
  colleges with a 400 (defence in depth), so it can never double-assign.

---

## 14. Fee Determination System

**File:** [BackEnd/services/FeeDeterminationService.js](BackEnd/services/FeeDeterminationService.js)

This service handles all fee calculations. It is completely stateless — call `compute()` and it returns a structured result.

### Fee Category (Slab) Logic

Priority order:

1. If caste is in `[SC, ST, DT/VJ, NT(A), NT(B), NT(C), SBC, OBC]` → **Cat-3** (backward class concession)
2. Else if special status is in `[EBC, PTC, STC, Ex-Service]` → **Cat-2** (partial concession)
3. Else if special status is in `[FF, PH, Widows, C.Govt., S.Govt.]` → **Cat-4** (institutional)
4. Default → **Cat-1** (full fees, General/Open)

### Payment Mode Logic

| Condition | Mode |
|---|---|
| Caste in BCC list (SC, ST, DT/VJ, NT(A), NT(B), NT(C), SBC) | `BCC` — government reimburses fees |
| Caste is OBC OR any special status | `Other` — concession scheme applies |
| Default | `Paying` — full payment |
| **Override**: Any mode but division `funding_type = 'NonGranted'` | → Force `Paying` (no government scheme for non-granted seats) |

### `compute()` — What it does

1. Looks up `funding_type` from `division_master` for the student's division
2. Determines fee slab (1–4) from caste/status
3. Determines payment mode (Paying/Other/BCC)
4. Builds the fee breakdown from the fee heads **configured for this exact course + year + student-type** (see the rule below)
5. Returns full fee breakdown with totals

### ⚠️ A fee is only charged if it is actually configured

A fee head is included **only** when there is a `classwise_fees` row for this exact
**college + course (faculty_master) + year_level + student_type**, **and** the amount for
the student's slab (`cat{slab}_amount`) is **NOT NULL**.

- **Blank (NULL) classwise amount** → the college left it unset → the head is **not charged** (₹0).
- **No classwise row at all** for this class/year → the head is **not charged**.
- The college-wide `fees_master` base amount is **never used as a fallback**.

> **Why:** the Fees Master UI deliberately stores `NULL` for an unset amount. Previously the
> service fell back to the `fees_master` base amount, so courses whose fees were never set
> still produced a phantom fee. Now "fee not set" reliably means **₹0**.

**Consequence:** a course/year with no fees configured computes to **₹0**. This is what the
"open admission" guard relies on — see [Key Business Rule 21](#26-key-business-rules).

```javascript
const result = await FeeDeterminationService.compute({
  collegeId: 1,
  facultyMasterId: 3,
  yearLevel: 'FY',
  divisionLetter: 'A',
  caste: 'OBC',
  specialStatus: null,
  pool: dbPool
})

// result.feesCategorySlab = 3
// result.paymentMode = 'Other'
// result.breakdown = [{ fees_head, amount, is_refundable }]
// result.totalFee = 45000
// result.reimbursableAmount = 0
// result.studentPayable = 45000
```

---

## 15. Payment Flow (PayU)

The platform uses **PayU** as the payment gateway. Unlike modal-based gateways (Razorpay), PayU uses a **form-based redirect** flow: the backend builds an HTML form with signed fields, the frontend auto-submits it, and PayU redirects back to the backend after checkout.

### Key Files

| File | Role |
|---|---|
| `BackEnd/routes/payments.js` | All payment endpoints |
| `BackEnd/services/payU.js` | PayU helper: hash generation, txnid creation, field building |
| `FrontEnd/src/features/student/pages/PaymentResult.jsx` | Landing page after PayU redirect |

### How PayU Hash Signing Works

Every PayU request requires a SHA-512 hash of specific fields in a fixed order:
```
hash = SHA512(key|txnid|amount|productinfo|firstname|email|||||||||||salt)
```
The backend computes this hash and includes it in the form fields. PayU verifies it server-side before accepting the transaction.

### Application Fee Payment Flow (Student-initiated)

```
1. Student completes all form steps (personal details, prev exam, docs, declaration)
2. Student clicks "Pay & Submit" on Step 5 (Review) in the application wizard
3. Frontend calls POST /payments/initiate
   Body: { applicationId, paymentType: 'application_fee' }
4. Backend:
   a. Generates a unique txnid (format: APP-{appId}-{timestamp})
   b. Inserts a pending payment row in the payments table
   c. Builds PayU form fields (key, txnid, amount, hash, surl, furl, etc.)
   d. Returns form fields as JSON
5. Frontend renders a hidden <form> with the PayU fields and auto-submits it
6. Browser redirects to PayU checkout page (secure.payu.in)
7. Student completes payment on PayU
8. PayU POSTs to /payments/payu-return (surl on success, furl on failure)
9. Backend (payu-return):
   a. Verifies the response hash
   b. Calls commitPayment():
      - Updates payment status to 'success'
      - Sets application.application_fee_paid = 1
      - Sets application.status = 'submitted'
      - Generates registration_number
      - Sends WhatsApp notification to student
   c. Redirects browser to /payment-result?status=success&reg=REG-XXXX
10. Student sees success screen with their registration number
```

### College Fee Payment Flow (Student-initiated)

```
1. College admin confirms application + sets fee_total_amount + fee_pay_now_amount
2. Application status → 'confirmed'
3. Student sees fee on My Applications / college fee payment page
4. Student clicks "Pay College Fee" → same PayU form-redirect flow
   paymentType: 'college_fee'
5. On commitPayment() success:
   - Updates payment status
   - Sets application.college_fee_paid = 1
   - Sets application.status = 'fees_paid'
   - Sends WhatsApp notification
6. Browser redirects to /payment-result?status=success
```

### Cash Payment (College-initiated)

College admins can record cash payments directly from the application wizard or fee receipts panel:

```
POST /college-admin/:collegeId/applications/:appId/record-application-fee

Body: { amount, payment_method: 'cash' }

Backend (in a transaction):
  1. Inserts payment row (gateway='cash', status='success')
  2. Sets application.application_fee_paid = 1
  3. Sets application.status = 'submitted'
  4. Generates registration_number
  5. Returns { registration_number }
```

### PayU Webhook (Backup)

PayU also sends an async server-to-server POST to `/payments/payu-webhook` after payment. This is a backup in case the browser redirect fails (user closes browser mid-flow). The webhook re-runs `commitPayment()` — it is idempotent (a payment already marked `success` is not double-counted).

### Payment Security

- All PayU responses verified via SHA-512 hash before committing
- `gateway_txnid` uniquely identifies each transaction — duplicate commits rejected
- No card/bank details ever stored — PayU handles PCI-DSS compliance
- Rate limiting applied to payment endpoints

---

## 15a. WhatsApp Payment Links

College admins can send a payment link directly to a student's WhatsApp. The student clicks the link, sees a PayU form, pays — **without needing to log in** to the portal.

### When to Use

- Student doesn't have internet access to log into the portal
- College admin collects payment on behalf of a walk-in student
- Quick payment collection for application fee or college fee top-ups

### How to Send a Link (College Side)

From either the **Application Wizard (Step 5)** or the **Fee Receipts** modal:

1. Click "WhatsApp Link" payment mode
2. Enter the student's WhatsApp phone number (or leave pre-filled if on record)
3. Optionally enter a custom amount (defaults to outstanding balance)
4. Click "Send Link"
5. Backend:
   - Creates a row in `payment_link_tokens` (random UUID token, 24h expiry)
   - Sends WhatsApp message via SMSala template 590 with the link URL
   - Returns success to the UI

### How the Link Works (Student Side)

The link URL looks like:
```
https://yourdomain.com/payments/pay/ABC123TOKEN
```

This is a **public route** — no login required.

**On first open:**
1. Backend looks up the token row, checks it is not `used=1` and not expired
2. Generates a `gateway_txnid` (PayU transaction ID) and stores it on the token row
3. Inserts a pending payment row in the `payments` table
4. Renders a PayU auto-submit HTML form
5. Browser auto-submits to PayU checkout

**On page reload (same token):**
1. Backend finds the existing `gateway_txnid` on the token row
2. Reuses the same pending payment row (does NOT create a new one)
3. Renders the PayU form again with the same txnid → PayU resumes the same session

**After payment:**
1. PayU POSTs to `/payments/payu-return`
2. Backend calls `commitPayment()` which:
   - Updates payment status to `success`
   - Marks the token `used=1` (link is now consumed)
   - Updates application status
   - Sends confirmation WhatsApp to student
3. Browser redirects to `/payment-result?status=success&via=link`
4. Student sees success screen — the "Go to My Applications" button is **hidden** (since student is not logged in)

### Token Lifecycle

| State | Condition | Effect |
|---|---|---|
| Valid | `used=0` AND `expires_at > NOW()` | Link works |
| Used | `used=1` | Link rejected — payment already made |
| Expired | `expires_at < NOW()` AND `used=0` | Link rejected — college must send a new one |

### Key Design Decisions

| Decision | Reason |
|---|---|
| Public route (no auth) | Student shouldn't need to create an account or log in just to pay |
| Single-use token | Prevents the same link being shared and paid multiple times |
| 24h expiry | Limits exposure if the link is forwarded to unintended recipients |
| `gateway_txnid` stored on token row | Ensures page reloads don't create duplicate pending payments |
| Token marked used inside `commitPayment()` | Only marked consumed after PayU confirms success — not on page open |
| `via=link` param on redirect | Tells the result page to hide the "Go to My Applications" button |

### Database Tables Involved

- `payment_link_tokens` — stores tokens (see schema in Section 6)
- `payments` — pending row created on first link open; committed on success
- `whatsapp_message_log` — logs the send attempt

### Environment Variable Required

```
WHATSAPP_TPL_PAYMENT_LINK=590   # SMSala template ID for payment link message
```

Template 590 variables (in order): `college_name`, `registration_number`, `link_url`

---

## 16. Document Upload System

### Storage Location (outside the web root)
```
BackEnd/uploads/students/{studentId}/{timestamp}_{random}.{ext}
```
Files are stored **outside** `public/` so they are never served statically or executed. The filename is random (no user-controlled name), and the extension is derived from the **detected** content type, not the client's filename.

### Allowed File Types
- JPG, JPEG, PNG, WEBP, PDF
- Max file size: 5 MB per file

### How Upload Works
1. Multer middleware handles multipart/form-data. `student_id` in the destination is sanitized to digits (blocks path traversal).
2. The `file-type` package validates the **actual magic bytes** (not just the extension); mismatches are rejected.
3. The stored file is renamed with the trusted extension for the detected type.
4. Row inserted into `student_documents` (path stored as `/uploads/students/{id}/{file}`).
5. If for an application, a row is inserted into `application_documents` linking the upload.

### Serving Files (authenticated, never static)
Uploads are **not** served by `express.static`. They are streamed through an authenticated route:
```
GET /uploads/students/:studentId/:filename   (see BackEnd/routes/uploads.js)
```
- Requires authentication; students may only fetch their own files, college/admin may fetch any (for review).
- Confirms the file is a registered `student_documents` row (not a guessed path).
- Sets `X-Content-Type-Options: nosniff`, forces a trusted `Content-Type`, and uses `Content-Disposition: inline` — so an upload can never be interpreted as HTML/JS.
- The frontend fetches files at the same `/uploads/...` URL (cookie auth is sent automatically), so no client change was needed.

### Document Verification
College admins can mark individual documents as verified in the application detail view, which sets `application_documents.is_verified = 1`.

---

## 17. WhatsApp Notifications (SMSala)

**File:** [BackEnd/services/whatsapp.js](BackEnd/services/whatsapp.js)

### Key Design Decisions
- WhatsApp failures **never break the main request flow**. Every send is wrapped in try/catch and failures are logged but not re-thrown.
- Every send attempt (sent/failed/skipped) is logged to `whatsapp_message_log`
- OTP sends always fire regardless of `WHATSAPP_ENABLED` flag (it's critical for registration)
- Template message sends respect `WHATSAPP_ENABLED` — set to `false` in dev to avoid sending real messages

### Phone Number Normalisation
The `normalisePhone()` function handles Indian phone number formats:
- `9876543210` (10 digits) → `919876543210`
- `919876543210` (already has 91) → unchanged
- `09876543210` (starts with 0) → `919876543210`

### Notification Events

| Event | Function | When triggered |
|---|---|---|
| Registration / Password Reset | `sendOtp()` | During OTP send endpoint |
| Correction Requested | `notifyCorrectionRequested()` | College requests correction |
| Application Accepted | `notifyApplicationAccepted()` | College accepts scrutiny |
| Application Rejected | `notifyApplicationRejected()` | College rejects |
| Admission Confirmed | `notifyAdmissionConfirmed()` | College confirms admission |
| Fees Paid | `notifyFeesPaid()` | Payment verification success |
| Roll Assigned | `notifyRollAssigned()` | College assigns roll number |
| Payment Link | `sendTemplateMessage()` | College sends WhatsApp payment link to student (template 590) |

### Template Configuration
Each template ID must be configured in `.env`. The template variables (Sample field) are comma-separated values matching the SMSala template definition.

---

## 18. AI Chatbot (Gemini)

**Files:**
- [BackEnd/services/aiService.js](BackEnd/services/aiService.js)
- [BackEnd/routes/chat.js](BackEnd/routes/chat.js)
- [FrontEnd/src/components/ChatBot.jsx](FrontEnd/src/components/ChatBot.jsx)

### How it Works

1. Student/college asks a question in the chat widget
2. Backend retrieves relevant knowledge articles from `chatbot_knowledge` table (keyword matching + role filtering)
3. Articles concatenated as CONTEXT
4. Sent to Gemini 2.5 Flash with a strict system prompt:
   - Answer ONLY from the provided context
   - If not in context, say "I don't have information about that"
   - Don't answer anything unrelated to admissions
5. Gemini response returned to user
6. Conversation turn logged to `chatbot_logs`

### Knowledge Base
- 660+ articles seeded in `chatbot_knowledge`
- Categorized by `target_role` (`student`, `college`, `both`)
- Each has `question`, `answer`, `keywords`, `category`

---

## 19. Certificate System

Three types of certificates are supported, all issued by college admins:

### Bonafide Certificate
Certifies that a student is currently enrolled. Fields: student name, reg number, class, academic year, DOB, roll number, caste.

### Character Certificate
Certifies good character. Same as bonafide plus `known_from_years` (how long college has known the student).

### NOC (No Objection Certificate)
For students transferring out. Fields: student name, reg number, class, from-date, to-date, PRN number, final confirmation number.

### Certificate Numbering
Each certificate gets a unique `certificate_no` per college. The college admin provides this. The DB enforces uniqueness via a partial unique index (excluding soft-deleted records).

### PDF Generation
Certificates are generated as PDFs on the frontend using jsPDF. The backend stores the metadata; the frontend renders and downloads the PDF.

---

## 20. Master Data Management

Master data must be set up by each college before students can apply. Setup order matters:

```
1. Faculty Master (programs: BCA, BCom, etc.)
2. Bank Master (bank accounts)
3. Division Master (class divisions — IMPORTANT: set funding_type correctly)
4. Course Master (subjects per semester)
5. Group Master (elective groups, if applicable)
6. Fees Master (fee heads and amounts per category)
7. Required Documents (which documents are needed per course/year)
8. Admission Periods (open the admission window for applications)
```

### Why the order matters
- `Division Master` needs `Faculty Master` to exist first (FK relationship)
- `Course Master` needs `Faculty Master`
- `Fees Master` needs `Bank Master` for the `credit_to_bank_ledger` field
- `Admission Periods` needs `Faculty Master` for the `course_id`

### Classwise Fee Overrides
The `classwise_fees` table allows per-class overrides on top of `fees_master`. For example, if First Year BCA has a different tuition fee than Second Year BCA, set a classwise override. The `FeeDeterminationService` automatically uses the override if one exists.

---

## 21. Role & Permission System

The platform has three top-level roles:

| Role | Description |
|---|---|
| `student` | Registered student; can apply, pay, view own data |
| `college` | College admin (main) OR college staff member |
| `admin` | Super admin; can create colleges, manage everything |

### College Staff Permissions

College admins can create staff accounts with custom roles. Each role has a set of named permissions with optional write access:

```
Permission keys (examples):
- applications     → can view/manage application inbox
- masters          → can manage master data (programs, fees, etc.)
- certificates     → can issue certificates
- roll_numbers     → can assign roll numbers
- admissions       → can manage admission periods
```

For each permission:
- `can_write = 0` → read-only access
- `can_write = 1` → full read + write access

The **main college admin** (logged in via `admin_email`/`admin_password_hash` from the `colleges` table) always has full access to everything — permission checks only apply to staff accounts (`is_staff = true`).

### How Permission Checking Works in Routes

```javascript
// Read-only: staff need this permission (read or write)
router.get('/applications', authenticate, requireCollegeAccess, requirePerm('applications'), ...)

// Write operations: staff need write permission
router.post('/applications/:id/reject', authenticate, requireCollegeAccess, requireWrite('applications'), ...)
```

The `requireCollegeAccess` middleware also does a **live database check** on every request to confirm the college is still enabled (`is_enabled = 1`). This means disabling a college in admin immediately locks out all their users without needing to invalidate tokens.

---

## 22. Background Jobs

### OTP Cleanup (`jobs/otpCleanup.js`)
- Runs every **5 minutes** using `node-cron`
- Deletes rows from `otp_store` where `expires_at < NOW()` OR `used = 1`
- Prevents the table from growing indefinitely
- Starts automatically when Express server starts (called in `app.js`)

---

## 23. Security Implementation

### JWT & Session
- JWT stored as **httpOnly cookie** — not accessible to JavaScript, prevents XSS theft
- `Secure` flag set in production (HTTPS only)
- `SameSite: Strict` to prevent CSRF
- **Daily session expiry** — every session ends at `SESSION_EXPIRY_HOUR` (currently **3:00 AM**), so all users are logged out once a day. A token refresh can **never** extend a session past that absolute `sxp` deadline. See [Session Expiry](#session-expiry-daily-logout).
- Frontend silently refreshes the token hourly (within the daily window only)
- `JWT_SECRET` validated at startup — server refuses to start without it

### Input Validation
- Endpoints validate inputs with `express-validator` (auth, payments, applications) or explicit manual checks (type/format/length) — non-conforming input is rejected with a 422/400, not silently coerced.
- Free-text fields on the main mutation (personal-details) have explicit **length bounds**; numeric fields have range checks (e.g. semester 1–8).
- File uploads: mime allowlist + **actual magic-byte validation** via `file-type` (see [Section 16](#16-document-upload-system)).

### Rate Limiting
Centralized in `BackEnd/middleware/rateLimits.js` — **all thresholds are env-configurable** (`RL_*` vars), nothing hardcoded. Three tiers:
- **Auth** (login / register / OTP / password reset): strict. Combines a **per-IP** cap, a **per-account** cap (email/phone), and a **progressive slow-down** (backoff via `express-slow-down`) instead of a hard lockout — so a legitimate user who fumbles a password is delayed, not locked out, while brute force (even across rotating IPs) is throttled.
- **Public** (unauthenticated browse: `/colleges`, `/masters`): moderate limit.
- **Authenticated** (user actions): looser limit.
- Loopback and non-production requests are skipped.
- If deployed behind a reverse proxy, set `app.set('trust proxy', 1)` (a specific hop count, not `true`) so real client IPs are used.

### SQL Injection Prevention
- All database queries use parameterized inputs (`.input()` with `mssql`)
- No raw string interpolation in SQL queries anywhere

### CORS
- Strictly configured via `CORS_ORIGIN` env var
- Only listed origins can make cross-origin requests
- `credentials: true` required to allow cookies

### Security Headers (Helmet)
- `X-Frame-Options: DENY` (no embedding in iframes)
- `Content-Security-Policy` (script/style source restrictions)
- `HSTS` (HTTP Strict Transport Security) in production
- `X-Content-Type-Options: nosniff`

### Audit Logging
- `middleware/auditLog.js` logs sensitive operations to DB
- Application status changes logged to `application_activity_log`
- WhatsApp message attempts logged to `whatsapp_message_log`

### Error Handling
- In production: errors never leak internal details (stack traces, SQL errors, etc.)
- 4xx errors: message forwarded (they're intentional, e.g. validation failures)
- 5xx errors: generic "An internal server error occurred" message sent to client
- Full error details logged to Pino logger server-side

---

## 24. Testing

### Test Setup
Located in [FrontEnd/src/test/](FrontEnd/src/test/)

- **Framework**: Vitest + React Testing Library
- **DOM environment**: JSDOM
- **API mocking**: MSW (Mock Service Worker) — `src/test/server.js`
- **Setup file**: `src/test/setup.js`

### What's Tested
Unit tests for custom hooks:

| Test File | Hook Tested |
|---|---|
| `useAuth.test.js` | Authentication state management |
| `useApplicationForm.test.js` | Multi-step form state |
| `useApplicationSubmit.test.js` | Form submission logic |
| `useCollegePayment.test.js` | College fee payment flow |
| `useDocumentPreview.test.js` | Document preview/download |
| `useForgotPassword.test.js` | Password reset flow |
| `useNotifications.test.js` | Notification management |
| `usePasswordValidation.test.js` | Password strength rules |
| `useSortableTable.test.js` | Table sorting utility |
| `useStudentRegistration.test.js` | Registration with OTP |

### Running Tests

```bash
cd FrontEnd
npm test           # Watch mode
npm run test:run   # Run once (CI)
npm run test:ui    # Visual test UI
```

---

## 25. Deployment Notes

### Backend Deployment

- Default port: **8000** (override with `PORT` env var)
- IIS deployment: [web.config](BackEnd/web.config) is provided
- Run `npm run migrate` before first start to ensure DB schema is up to date
- Always set `NODE_ENV=production`
- Pino outputs pretty logs in dev, structured JSON in prod

### Frontend Deployment

```bash
cd FrontEnd
npm run build
# Output: FrontEnd/dist/
# Deploy dist/ to static hosting (Nginx, Apache, Azure Static Web Apps, etc.)
```

- The `VITE_API_URL` env var is baked into the build at build time
- Ensure the backend URL in VITE_API_URL includes a trailing slash

### File Upload Storage

Uploaded documents are stored in `BackEnd/uploads/` (**outside** the web root; gitignored) and served only through the authenticated route in `routes/uploads.js`. In production:
- Use a shared/persistent volume if running on multiple instances (the folder is not in the deploy artifact).
- Or configure Multer to use cloud storage (Azure Blob, AWS S3) instead — keep serving behind the authenticated route.

---

## 26. Key Business Rules

These are important rules that aren't obvious from reading the code alone:

1. **Registration Number**: Generated when the platform application fee is paid (online via PayU or cash recorded by college). Format: `{AY}-{courseId}-{yearOfStudy}-{seq}` (e.g. `202425-03-1-0001`). A student without a registration number has not paid.

2. **Fee Category Non-Granted Override**: If a student's division has `funding_type = 'NonGranted'`, their payment mode is always `Paying` regardless of caste. Government fee concessions don't apply to non-granted seats.

3. **BCC vs Cat-3**: BCC castes (SC, ST, NT, etc.) also fall under Cat-3 for fee amounts. BUT they additionally have a `paymentMode = 'BCC'` which means the government reimburses the `is_refundable` fee heads. OBC is Cat-3 but `paymentMode = 'Other'` (no full reimbursement).

4. **Draft vs New Application**: A student cannot have two active draft applications for the same college + course + year combination. The `init` endpoint returns the existing draft if one exists.

5. **Correction Flow**: When a college requests correction, the student can edit the form and resubmit. The application status returns to `correction_done` and the college reviews again.

6. **A Seat Is Filled Only on Confirmation**: A seat is counted once the college **confirms** a student's admission — statuses `confirmed`, `fees_paid`, `roll_assigned`, `enrolled`. Applying does not take a seat, and neither does being accepted for document verification: those students may still be rejected, withdraw, or never turn up, so holding seats for them would wrongly show a course as full and block genuine applicants. `rejected` and `cancelled` are not seat-holding, which is what frees a seat back up. The rule is the same for **both college types** — agriculture ends at `confirmed`, general continues to `fees_paid`, so counting from `confirmed` onward covers both.

   Filled seats are **derived** from application status at read time (`BackEnd/constants/seatStatuses.js` defines the set and builds the subquery every seat query uses). There is no counter to increment, so the count cannot drift out of sync the way a stored tally can. `admission_periods.filled_seats` is a leftover column and is no longer maintained.

7. **College Disabled Check**: The `requireCollegeAccess` middleware performs a live database check on every request. Disabling a college via admin immediately blocks all college logins without needing to wait for JWT expiry.

8. **WhatsApp is Optional**: The entire WhatsApp integration can be disabled by setting `WHATSAPP_ENABLED=false`. OTP delivery is separate — if OTP WhatsApp fails, the registration fails (by design, since OTP is required). Status notifications failing just get logged.

9. **Subject Selection Timing**: Students can only select subjects after the college assigns a roll number (`roll_assigned` status). The subject selection page is locked until then.

10. **College Fee Instalments**: The college sets `fee_total_amount` (total fee) and `fee_pay_now_amount` (minimum to pay now) during confirmation. The student pays `fee_pay_now_amount` first. The remaining balance can be paid later. The `college_fee_paid` flag is set even if only the first instalment is paid.

11. **Certificate Soft Delete**: Certificates are never hard-deleted. `is_deleted = 1` marks them as deleted. The unique index on `certificate_no` is a partial index (`WHERE is_deleted = 0`) so a deleted certificate number can be reused.

12. **Chatbot Strictness**: The Gemini prompt explicitly instructs the AI to only answer from the provided knowledge base context. If the answer isn't in the knowledge base, it must say so. This prevents hallucination and keeps the bot on-topic.

13. **Nothing Submits Until the Application Fee Is Paid**: Every application — whether the student filled it in or the college did on their behalf — stays in `draft` until the application fee is paid. Paying the fee *is* the act of submitting: the status only moves at the point of payment (cash recorded by the college, or online via PayU). The sole exception is a college that owes no fee (`payment.platform_fee` disabled, or `application_fee` = 0); those submit without payment and get a ₹0 payment row so the payment history stays complete. See [Section 13](#13-application-state-machine-status-flow).

14. **Payment Link Single-Use Guarantee**: A WhatsApp payment link token is consumed (`used=1`) only when `commitPayment()` runs successfully. If a student opens the link, reaches PayU, but the payment fails, the token remains valid and the student can click the link again. However, once payment succeeds, the token is permanently invalidated.

15. **PayU Idempotency**: The `gateway_txnid` field links a payment link token to a specific PayU transaction. If the student opens the link multiple times before paying, the backend always reuses the same pending payment row and the same txnid. This prevents duplicate payments for a single link.

16. **College Type Drives the Form**: A college's `college_type` (`general`/`agriculture`) is picked at onboarding and writes the `features_config` JSON. The form, reviews, validation, and fee steps all read `features_config` — never `college_type` directly. Changing the type re-applies the preset. General colleges have a college-fee system; agriculture colleges do not. See [Section 12a](#12a-college-types--features-config).

17. **Who Filled the Form Decides the Path**: `applications.created_by_role` (`student` | `college`) is stamped when the application is created and never changes. It is the flag every downstream step branches on. A **student**-filled application lands in `submitted` on fee payment and must walk the full scrutiny pipeline — the college has to accept it (`/approve`) before it can be confirmed, and confirming straight out of `submitted` is rejected. A **college**-filled application is directly approved: paying the application fee takes it straight to `confirmed`, skipping scrutiny, because the college reviewed it inline while filling it. The "Confirm & Collect Fee" endpoint therefore accepts an already-`confirmed` application and is idempotent — it records the college fee / installments / division rather than erroring. Posting a fee never drags an application backwards: one already past `submitted` keeps its current status. For an **agriculture** college (no college fee) `confirmed` is the final success state; for a **general** college success is `fees_paid`. See the matrix in [Section 13](#13-application-state-machine-status-flow).

18. **Semester Options Follow the Year (agriculture)**: The Semester field's options are derived from the admission year — FY → 1,2 · SY → 3,4 · TY → 5,6, etc. "Diploma Student (Direct SY)" is only offered for **SY** admissions; when checked, semesters 1 & 2 are removed (the student enters at SY). A stale semester selection is cleared automatically when the year or DSY flag changes.

19. **Duplicate Student Emails Allowed**: `students.email` is **not unique** (migration 037). Students log in and reset passwords by **phone**, which remains the unique identifier — so two students may share an email without breaking auth. Registration looks up existing students by phone only. (College and admin emails are still unique.)

20. **"Fees Pending" Only for College-Fee Colleges**: On the student's My Applications, a `confirmed` application shows "Fees Pending" only when the college has a college-fee system. For agriculture colleges (`college_fee` off), a `confirmed` application shows "Admission Confirmed" instead — the my-applications API returns a `college_fee_enabled` flag the UI reads. The full application review also shows **every** applicable field (blank ones render as "—"), so nothing looks silently missing.

21. **Cannot Open Admission Without Fees (college-fee colleges only)**: Creating an admission period is blocked if the college fee for that course + year is not configured (computes to ₹0) — the college is told to set the fees in Fees Master first. This is enforced **both** in the frontend pre-check and the backend `POST /admission-periods` route. **Skipped entirely for colleges with `college_fee` disabled** (e.g. agriculture), where ₹0 is expected. Relies on the "fee only if configured" rule in [Section 14](#14-fee-determination-system).

22. **Confirming Admission Without a College Fee**: The `confirm` endpoint only computes the fee total (and only raises *"Could not compute fee total…"*) when the college **has** a college-fee system. For agriculture colleges (`college_fee` off) it skips all fee logic, confirms with `fee_total_amount = 0`, and returns simply *"Admission confirmed."* — no fee configuration is required.

23. **College Forgot Password (admin + staff)**: Colleges reset by **email** (not phone, unlike students). The backend resolves the email to either a college admin (`colleges.admin_email` → OTP to the **college's** phone) or a staff member (`college_users.email` → OTP to the **staff member's own** phone, added in migration 038). Unknown emails get a generic response (no account enumeration); an account with **no phone on file** is told to contact its college admin. The reset updates whichever account matched (`colleges.admin_password_hash` or `college_users.password_hash`).

24. **Inbox Status Counts Ignore the Status Filter**: In the college application inbox, the per-status counts in the dropdown are computed by the **backend** over the full set (`status_counts` / `status_total`), applying every filter **except** status. So selecting one status no longer zeroes out the other counts. Course/year/division filters still narrow the counts (intentional).

25. **Everyone Is Logged Out Daily**: Sessions expire at `SESSION_EXPIRY_HOUR` (currently **3:00 AM**) — an **absolute** deadline carried in the token as `sxp`. `/auth/refresh` re-issues a token but can never push past it, so even an actively-working user is logged out at that hour. Applies to all roles. See [Session Expiry](#session-expiry-daily-logout).

---

*Last updated: July 2026. For questions, see the git log or open an issue.*
