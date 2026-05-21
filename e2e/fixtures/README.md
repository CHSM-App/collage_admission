# E2E Test Fixtures

## How to seed the test database

Run the seed file against your dev/test SQL Server database:

```bash
# Using sqlcmd (replace connection details)
sqlcmd -S localhost -d college_admission -U sa -P yourpassword -i BackEnd/scripts/seed_e2e.sql

# Or open the file in SSMS and execute it
```

The seed is **idempotent** — safe to re-run at any time. It will never create duplicates.

---

## What the seed creates

### Accounts

| Role | Login field | Value | Password |
|---|---|---|---|
| Super Admin | Email | `vtadmin@test.com` | `Admin@1234` |
| College Admin | Email | `admin@testcollege.edu` | `Admin@1234` |
| Test Student 1 | Phone | `9000000001` | `Test@1234` |
| Test Student 2 | Phone | `9000000002` | `Test@1234` |

> Student 2 exists only for IDOR security tests. Student 1 must not be able to read Student 2's applications.

### College

| Field | Value |
|---|---|
| Name | Test College of Commerce |
| Code | `TC001` |
| City | Vengurla |
| Application Fee | ₹500 |
| Program | BCom (3 years) |
| Admission Period | FY BCom, 2025-26, 50 seats, open |

### Master Data

| Data | Details |
|---|---|
| Program (Faculty Master) | BCOM — Bachelor of Commerce, 3 years |
| Bank | SBI Vengurla, `1234567890`, `SBIN0001234` |
| Division | FY, Division A, **Granted** (government concessions apply) |
| Fees | Tuition ₹15,000 (Cat-1), Exam ₹3,000, Library ₹500 |
| Subjects | 4 core subjects for Semester 1 (BCM101–BCM104) |
| Required Docs | Aadhaar (mandatory), Passport Photo (mandatory), 12th Marksheet (mandatory), Caste Certificate (optional) |

### Sample Applications (Student 1)

| Registration No. | Status | What it tests |
|---|---|---|
| *(no reg no.)* | `draft` | Draft UI, Continue button, Delete draft |
| `REG-2025-0001` | `submitted` | College inbox, Under Review UI |
| `REG-2025-0002` | `confirmed` | Pay College Fee button, fee amount display |
| `REG-2025-0003` | `rejected` | Rejection reason display |
| `REG-2025-0004` | `correction_requested` | Correction note display, Edit & Resubmit button |
| `REG-2025-0005` | `fees_paid` | Adm. Confirmed badge, Select Subjects button |

---

## Credentials used in test files

These values are in [e2e/fixtures/users.js](users.js) and imported by all test specs:

```js
STUDENT       = { phone: '9000000001', password: 'Test@1234' }
COLLEGE_ADMIN = { email: 'admin@testcollege.edu', password: 'Admin@1234', collegeCode: 'TC001' }
SUPER_ADMIN   = { email: 'vtadmin@test.com', password: 'Admin@1234' }
```

---

## Regenerating password hashes

If you want to change the test passwords, regenerate bcrypt hashes:

```bash
node -e "require('bcryptjs').hash('YourPassword',10).then(console.log)"
```

Then replace the hash values in `seed_e2e.sql` and re-run it.
