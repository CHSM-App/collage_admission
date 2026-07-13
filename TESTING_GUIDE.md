# Manual Testing Guide — College Admission System

> A step-by-step plan to deeply test the system by hand. Work top-to-bottom; each
> section builds on the last. **Check off each box as you go** and note anything
> that doesn't match the "Expected" column.

---

## 0. Before you start

### 0.1 Start the system

```bash
# Terminal 1 — backend
cd BackEnd
npm run dev            # or: node ./bin/www

# Terminal 2 — frontend
cd FrontEnd
npm run dev
```

- [ ] Backend health check returns `{"status":"ok"}` → open `http://localhost:5000/health`
- [ ] Frontend loads → open the URL Vite prints (usually `http://localhost:5173`)

> ⚠️ **If the backend fails with `Login failed for user ...`**, your `BackEnd/.env`
> DB credentials are wrong. Fix `DB_USER` / `DB_PASSWORD` / `DB_SERVER` / `DB_NAME`
> before continuing — nothing will work until the DB connects.

### 0.2 Make sure migrations are applied

```bash
cd BackEnd
npm run migrate:status     # see what's applied
npm run migrate            # apply anything missing
```

- [ ] All migrations through **039** are applied. The recent ones matter:
  029 features_config · 031 college_type · 033/034/036 new form fields ·
  037 duplicate emails · 038 staff phone · 039 college OTP purpose.

### 0.3 Your test accounts & data (current state)

| Role | Login URL | Account |
|---|---|---|
| Super Admin | `/login/vtadmin` | `admin@vengurlatech.com` / `Admin@123` |
| College admin (general) | `/login/college` | `admin@elphinstone.com` (Elphinstone, code `EC001`) |
| College admin (general) | `/login/college` | `admin@fergusson.com` (Fergusson, code `FRGN`) |
| College admin (**agriculture**) | `/login/college` | `admin@bskkv.com` (BSKKV Dapoli, code `BSKKV`) |
| College admin (**agriculture**) | `/login/college` | `admin@coep.com` (COEP, code `COEP`) |
| College **staff** | `/login/college` | `collegeadmin@bskkv.com` (Rahul Patil, BSKKV) |
| Student | `/login/student` | Register a new one (login is by **phone**) |

**Colleges by type — this drives almost everything:**

| College | Type | College fee? | App fee |
|---|---|---|---|
| Elphinstone, Fergusson, VJTI | **general** | ✅ yes | ₹5 / ₹100 / ₹50 |
| **BSKKV, COEP** | **agriculture** | ❌ **no** | ₹50 |

> 🔑 **The single most important thing to test** is that *general* and *agriculture*
> colleges behave differently. Almost every recent change hinges on this.

---

## 1. Super Admin — onboarding & college type

Login: `/login/vtadmin` → `admin@vengurlatech.com` / `Admin@123`

### 1.1 Create a GENERAL college
Go to **+ New College**.

- [ ] The form shows a **College Type** dropdown with two options:
      "General (BSc / BCom / Arts)" and "Agriculture"
- [ ] Create a college with type **General**. It saves and shows the college code.

**Expected:** college created; its features are the *general* preset.

### 1.2 Create an AGRICULTURE college
- [ ] Create another college, this time type **Agriculture**.

**Expected:** created successfully.

### 1.3 Check the type drives the features
Go to **Colleges → Manage** on your new agriculture college → **Features** tab.

- [ ] The tab shows a **College Type** selector (not a grid of toggles).
- [ ] **Agriculture** is pre-selected (amber highlight).
- [ ] "Save College Type" is **disabled** until you change the selection.
- [ ] Switch to **General**, Save. Then switch back to **Agriculture**, Save.

**Expected:** each save re-applies that type's full field set.

### 1.4 Enable / disable a college
- [ ] Disable a college. Try logging in as that college.

**Expected:** login is blocked with a "college has been disabled" message.
- [ ] Re-enable it and confirm login works again.

---

## 2. College staff & roles (Super Admin)

**Manage** a college → **Roles & Staff**.

### 2.1 Create staff with a phone
- [ ] Add a new staff user. The form has: Full Name, Email, **Phone (for password reset OTP)**, Password, Role.
- [ ] Save with a valid 10-digit mobile (starting 6–9).

**Expected:** saved. The phone is stored.
- [ ] Try saving a staff member with an **invalid** phone (e.g. `12345`).

**Expected:** rejected with "Phone must be a 10-digit number starting with 6–9."

### 2.2 Edit staff
- [ ] Edit an existing staff member and add/change their phone.

**Expected:** the phone persists after save + reload.

### 2.3 Permissions
- [ ] Create a role with limited permissions (e.g. no `collect_fees`).
- [ ] Log in as a staff member with that role.

**Expected:** the restricted sections are hidden or read-only.

---

## 3. Forgot password (NEW — test both flows)

### 3.1 Student forgot password (by PHONE)
- [ ] Go to `/login/student` → click **Forgot password?**
- [ ] Enter a **registered student phone** → OTP sent to their WhatsApp.
- [ ] Enter the OTP → set a new password → log in with it.

**Expected:** login succeeds with the new password.
- [ ] Try an **unregistered** phone.

**Expected:** a generic message (doesn't reveal whether the number exists).

### 3.2 College ADMIN forgot password (by EMAIL) — NEW
- [ ] Go to `/login/college` → click **Forgot password?** (this link is new)
- [ ] Enter a **college admin email** (e.g. `admin@bskkv.com`).

**Expected:** OTP is sent to the **college's phone** (`colleges.phone`).

> ⚠️ **Gotcha:** if the college's phone isn't a valid mobile (6–9 start), the OTP
> can't be sent. Check the college's phone first (Elphinstone's is `2525252525`,
> a landline — that admin **cannot** self-reset until the phone is fixed).

- [ ] Enter the OTP → set a new password → log in as that college admin.

**Expected:** login succeeds with the new password.

### 3.3 College STAFF forgot password (by EMAIL) — NEW
- [ ] Use `collegeadmin@bskkv.com` (Rahul Patil — he **has** a phone: `8263829478`).
- [ ] Enter that email on the college forgot-password page.

**Expected:** OTP goes to **his own** phone (not the college's).
- [ ] Complete the reset and log in as that staff member.

### 3.4 Staff with NO phone
- [ ] Try the college forgot-password with `sachin@gmail.com` (no phone on file).

**Expected:** clear error — *"No phone number is on file for this account. Please contact your college admin to set one."*

### 3.5 Unknown email
- [ ] Enter an email that doesn't exist.

**Expected:** generic *"If this email is registered, an OTP has been sent…"* (no account enumeration).

---

## 4. College masters & fees (do this BEFORE testing admissions)

Login as a **general** college (e.g. `admin@fergusson.com`).

### 4.1 Fees Master
- [ ] Open **Masters → Fees Master**. Add fee heads and set **classwise** amounts
      for a course + year + student type (Grand / NonGrand).

### 4.2 🔴 The "fee not set" rule (IMPORTANT — recently changed)
This is the highest-risk change. Test it carefully.

- [ ] Pick a course + year where the classwise fee amounts are **blank/not set**.
- [ ] Try to **open an admission period** for it (Admission Periods → add).

**Expected:** **BLOCKED** with *"Fees not configured for … Please go to Masters → Fees Master and set up fees before opening admissions."*

- [ ] Now go set the fee amounts for that course+year, then retry.

**Expected:** the admission period is created successfully.

- [ ] Also confirm: a course/year with fees set to **blank (null)** computes to **₹0**,
      not some fallback amount. (Previously a "phantom fee" appeared here.)

### 4.3 🔴 Agriculture colleges must NOT require fees
Login as **BSKKV** (`admin@bskkv.com`) — an agriculture college.

- [ ] Open an admission period for **any** course/year, **without** setting any fees.

**Expected:** ✅ **ALLOWED** — no "set the fees first" error. (Agriculture has no
college fee, so ₹0 is expected.)

> If this asks you to set fees, that's a bug — report it.

### 4.4 Other masters
- [ ] Program/Faculty Master, Course Master, Bank Master, Category Master, Documents Master —
      create/edit/delete a row in each; confirm it persists after reload.

---

## 5. Admission periods

- [ ] Create a period (course + year + academic year + dates + seats).
- [ ] Close / reopen a period; confirm students can/can't see it.
- [ ] Try creating a **duplicate** period (same course+year+AY).
- [ ] Confirm the seat count and "filled seats" update as applications come in.

---

## 6. Student journey — GENERAL college (full end-to-end)

### 6.1 Register + login
- [ ] Register a new student at `/register/student` (OTP to WhatsApp).
- [ ] Log in — **login is by PHONE**, not email.

### 6.2 🔴 Duplicate emails allowed (recently changed)
- [ ] Register a **second** student using the **same email** but a **different phone**.

**Expected:** ✅ **allowed** (duplicate emails are permitted now).
- [ ] Try registering with a **phone that already exists**.

**Expected:** the existing account is reused / blocked — phone stays unique.

### 6.3 Apply
- [ ] Find the college by its **code** (e.g. `FRGN`), pick an open course/year.
- [ ] Walk the wizard: Context → Personal → Other → Exam → Documents → Review.

**On a GENERAL college, Step 2 (Personal) should show:**
- [ ] Caste/Community Category, **Fees Category** (auto-determined)
- [ ] Native/Permanent Address, Parent's Mobile, Land Line, Guardian's Relation *(always shown)*
- [ ] ❌ **NOT** shown: Semester, Admitted Category, Other Category, Admission Quota,
      Diploma (Direct SY), Name-as-on-Aadhaar, S/o

### 6.4 Documents
- [ ] Upload a valid **PDF** and a valid **JPG/PNG**.
- [ ] Try uploading a **>5 MB** file → rejected ("File is too large").
- [ ] Try uploading a **.txt / .exe** renamed to `.pdf` → rejected (content is checked,
      not just the extension).
- [ ] Confirm you can preview/download an uploaded document.

### 6.5 Review + submit + pay
- [ ] Step 6 review shows **all** the fields you filled (blanks show as "—").
- [ ] Accept the declaration → pay the application fee (PayU).
- [ ] After payment, status becomes **Under Review**.

### 6.6 Track status
- [ ] **My Applications** shows the correct status and lets you print/download the form.

---

## 7. Student journey — AGRICULTURE college (the important one)

Use **BSKKV** (code `BSKKV`) or **COEP** (code `COEP`).

### 7.1 🔴 Agriculture-only fields must appear
Apply as a student, get to **Step 2 (Personal)**.

**Expected — ALL of these show (they do NOT on a general college):**
- [ ] **Semester** dropdown (required)
- [ ] **Admitted Category** (required)
- [ ] **Other Category**
- [ ] **Admission Quota** (required)
- [ ] **Date of Admission** — pre-filled with **today** (editable)
- [ ] **Name as on Aadhaar Card**
- [ ] **S/o (for Transcript & Certificate)**
- [ ] **Diploma Student (Direct SY)** — see 7.2

Also expected on agriculture:
- [ ] **Hostel Facility** checkbox (Step 3)
- [ ] "Passed with Maths / Biology at HSC" flags (Step 3)
- [ ] ❌ **Fees Category is NOT shown** (agriculture has no college fee)

### 7.2 🔴 Semester ↔ Year ↔ DSY logic
- [ ] Apply for an **FY** (First Year) course. Open the Semester dropdown.

**Expected:** only **Semester 1** and **Semester 2** (options follow the year).
- [ ] Apply for an **SY** course.

**Expected:** only **Semester 3** and **Semester 4**.
- [ ] On the **FY** application: is the **Diploma (Direct SY)** checkbox visible?

**Expected:** ❌ **NO** — DSY only appears for **SY** admissions.
- [ ] On an **SY** application: check the **Diploma (Direct SY)** box.

**Expected:** semesters 1 & 2 are blocked/removed (student enters at SY).
- [ ] Change the year or toggle DSY after picking a semester.

**Expected:** an invalid semester selection is **cleared automatically**.

### 7.3 Required-field validation
- [ ] Try to advance past Step 2 leaving **Semester**, **Admitted Category**, or
      **Admission Quota** blank.

**Expected:** blocked with a clear "… is required" message for each.

### 7.4 Submit
- [ ] Complete and submit the agriculture application (pay the ₹50 app fee).

---

## 8. College review — the correction loop

Login as the **agriculture** college (`admin@bskkv.com`).

### 8.1 Inbox
- [ ] The new application appears in the **Application Inbox**.

### 8.2 🔴 Status filter counts (recently fixed)
- [ ] Open the **All Statuses** dropdown. Note the counts next to each status.
- [ ] **Select one status** (e.g. "Admission Confirmed"). Re-open the dropdown.

**Expected:** ✅ the **other statuses still show their real counts** — they must
**NOT** all become `(0)`. (This was the bug.)
- [ ] Now also apply a **Course** or **Year** filter.

**Expected:** counts narrow to that course/year (this *is* intended).

### 8.3 🔴 Review shows agriculture fields (recently fixed)
Open the application → **Application Review**.

**Expected in Personal Details:**
- [ ] **Semester** (e.g. "Semester 1")
- [ ] **Admitted Category**
- [ ] **Admission Quota**
- [ ] **Diploma (Direct SY)**
- [ ] **Date of Admission**
- [ ] **S/o** (shows "—" if the student left it blank — that's correct)
- [ ] ❌ **Fees Category NOT shown** (agriculture)

- [ ] Every field the student filled is visible; blanks show as **"—"** (nothing silently missing).

### 8.4 Request a correction
- [ ] Click **Request Correction**, write a note, submit.

**Expected:** status → **Correction Requested**; the note is saved.

### 8.5 🔴 Student fixes it — form must stay AGRICULTURE
Log back in as the **student**.
- [ ] **My Applications** shows "Correction Required" + your note.
- [ ] Click **Edit & Resubmit Application**.

**Expected:** ✅ the form still shows the **agriculture** fields (Semester, Admitted
Category, Quota, DSY…) — **NOT** the general layout.

> If it shows the general form, hard-refresh (Ctrl+Shift+R) — a stale cached bundle
> can cause this. If it persists after a clean rebuild, that's a bug.

- [ ] Make a change, accept the declaration, **Resubmit**.

**Expected:** status → back to the college for review; **no second app fee** is charged
(it was already paid).

### 8.6 🔴 Confirm admission — agriculture must NOT ask for fees
Back as the college, on the corrected application:
- [ ] Verify documents → **Student Visited — Confirm Admission**.

**Expected:** ✅ **"Admission confirmed."** — with **NO** *"Could not compute fee total.
Please configure classwise fees in Fees Master first"* error.

> This was a bug. Agriculture colleges have no college fee, so no fee configuration
> should be required to confirm.

- [ ] Check the application status is now **Confirmed**.

### 8.7 🔴 Student sees the right status
Log in as the student → **My Applications**.

**Expected:** the agriculture application shows **"Admission Confirmed"** —
**NOT** "Fees Pending" (there is no college fee to pay).
- [ ] There is **no** "pay the college fee" prompt.

---

## 9. College review — GENERAL college (fee path)

Now do the same on a **general** college (e.g. Fergusson) to check the *other* branch.

- [ ] Review → verify documents → **Confirm Admission**.

**Expected:** you **are** asked to set the fee / it computes a fee total.
- [ ] If the fee is **not configured** for that course/year:

**Expected:** *"Could not compute fee total. Please configure classwise fees in Fees Master first."* — this error **is correct here**.
- [ ] Set an **installment plan** (optional) and confirm.
- [ ] The student sees **"Fees Pending"** and can **pay the college fee**.
- [ ] After payment → status **Fees Paid**.

---

## 10. College-side application entry (walk-in student)

Login as a college → **Add Application**.

### 10.1 Student search
- [ ] Search an existing student by name/email/phone → select them.
- [ ] Register a **brand-new** student inline.
- [ ] Search a student who is **confirmed at another college**.

**Expected:** a **transfer OTP** is sent to their WhatsApp; you must enter it to proceed.

### 10.2 🔴 Already-applied courses are greyed out (recently fixed)
- [ ] Pick a student who already has a **submitted/confirmed** application for a course.

**Expected:** that course shows **"(already applied)"** and is **greyed out / unselectable**.
- [ ] Pick a student who has only a **draft** (started but never submitted) for a course.

**Expected:** ✅ that course is **still selectable** (a draft must not block re-applying) —
and starting it **resumes the existing draft** rather than creating a duplicate.

### 10.3 🔴 Application must NOT submit before the fee is collected (recently fixed)
- [ ] Fill the whole form, reach **Review**, click **Submit Application**.

**Expected:** you're shown the **fee-collection options** (cash / online / WhatsApp link).
The application is **still a draft** at this point.
- [ ] **Navigate away without collecting the fee.** Check the application status.

**Expected:** ✅ it is **still `draft`** — NOT stuck as submitted-but-unpaid.
- [ ] Go back, collect the fee (e.g. **cash**).

**Expected:** now it becomes submitted/confirmed and a **registration number** is assigned.

### 10.4 Step 5 review shows everything
- [ ] On the college's **Review** step, confirm **all** filled fields appear
      (including all the agriculture ones if it's an agriculture college), and
      blanks show as **"—"**.

### 10.5 Confirm & collect
- [ ] Complete "Confirm & Collect Fee". Confirm it doesn't error on an already-confirmed app
      (it should be idempotent).

---

## 11. Payments

- [ ] Application fee via **PayU** (success + failure/cancel).
- [ ] College fee via **PayU** (general college).
- [ ] **Cash** collection by the college.
- [ ] **WhatsApp payment link**: send it, open it, pay.
  - [ ] Open the link **twice before paying** → the same pending payment is reused (no duplicate charge).
  - [ ] After a successful payment, the link is **invalidated** (can't be reused).
  - [ ] If a payment **fails**, the link **still works** for a retry.
- [ ] **Receipts**: a receipt number is generated; the receipt shows the correct amount,
      paid/due, and payment mode.
- [ ] Installments: pay the first installment; the remaining balance is correct.

---

## 12. Post-admission

- [ ] **Roll numbers**: batch-generate for `fees_paid` students. Status → **Roll Assigned**.
- [ ] **Subject selection**: the student can only select subjects **after** a roll number
      is assigned. Completing it → status **Enrolled**.
- [ ] **Certificates**: generate Bonafide / Character / NOC. Check the certificate number,
      and that deleting one is a *soft* delete.
- [ ] **Reports/Export**: export applications to Excel; check the columns and filters.

---

## 13. Activity timeline (recently fixed)

Open any application's **Activity Timeline**.

- [ ] Each event shows the **correct actor** — an application submitted by the **college**
      says **"by College"** (not "by Student").
- [ ] There is **no duplicate** "Application Submitted" entry. Collecting the application
      fee shows as **"Application Fee Paid"**, a *separate* event.
- [ ] When a college **edits** a submitted application, an **"Application Updated"** event appears.

---

## 14. Security spot-checks

- [ ] **Uploads are not public**: copy an uploaded document's URL
      (`/uploads/students/<id>/<file>`) and open it in a **logged-out** / incognito window.

**Expected:** ✅ **401 Unauthorized** — the file must **not** be served.
- [ ] A **student** cannot fetch **another student's** document.
- [ ] **Rate limiting**: fail the login ~10+ times quickly.

**Expected:** you get slowed down / blocked with a "too many attempts" message
(not a permanent lockout).
- [ ] **Error messages**: force an error (e.g. bad input) — you should **never** see a
      stack trace, SQL error, or file path.
- [ ] A college **cannot** access another college's data (change the college id in a URL).

---

## 15. Cross-cutting / regression

- [ ] **Refresh the page** at every step of the wizard — your progress and data survive.
- [ ] **Back/forward** browser buttons don't corrupt state.
- [ ] Inbox **filters + pagination + sorting** all work together.
- [ ] **Notifications** (in-app + WhatsApp) fire on status changes.
- [ ] Try the app on a **narrow/mobile** viewport — forms and tables are usable.

---

## How to report a bug

For anything that fails, note:
1. **Who** you were logged in as (role + which college — *general or agriculture?*).
2. **Where** (page / step).
3. **What you did**, **what you expected**, **what happened**.
4. The **application ID** and **college** if relevant.
5. Any error message, and the **browser console** + **backend terminal** output.

> 💡 Before reporting a UI bug, do a **hard refresh (Ctrl+Shift+R)** — a stale cached
> bundle can make already-fixed issues appear to still be present.
