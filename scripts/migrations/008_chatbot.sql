-- ============================================================
-- 008_chatbot.sql
-- Chatbot knowledge base and chat log tables + full knowledge seed.
-- Idempotent — safe to re-run (skips existing titles).
-- ============================================================

-- ── Knowledge base ───────────────────────────────────────────
IF OBJECT_ID('chatbot_knowledge', 'U') IS NULL
CREATE TABLE chatbot_knowledge (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    title      NVARCHAR(300) NOT NULL,
    category   NVARCHAR(20)  NOT NULL CHECK (category IN ('student', 'college', 'both')),
    keywords   NVARCHAR(500) NOT NULL,  -- space-separated words for keyword search
    content    NVARCHAR(MAX) NOT NULL,
    is_active  BIT           NOT NULL DEFAULT 1,
    created_at DATETIME2     DEFAULT GETDATE()
);
GO

-- ── Chat log ─────────────────────────────────────────────────
IF OBJECT_ID('chatbot_logs', 'U') IS NULL
CREATE TABLE chatbot_logs (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NULL,
    role       NVARCHAR(20)  NULL,
    question   NVARCHAR(MAX) NOT NULL,
    answer     NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2     DEFAULT GETDATE()
);
GO

-- ── Seed knowledge base (idempotent) ────────────────────────
-- Only inserts rows whose title does not already exist.

INSERT INTO chatbot_knowledge (title, category, keywords, content)
SELECT title, category, keywords, content FROM (VALUES

-- ============================================================
-- STUDENT — HOW TO APPLY
-- ============================================================

(
  'How to Apply for Admission',
  'student',
  'apply application admission how start register college',
  'To apply for admission: 1) Log in to the student portal. 2) Go to "Browse & Apply". 3) Enter the exact college name or college code (e.g. CL001). 4) Select the course and year you want to apply for. 5) Click "Apply" to start the multi-step application form. 6) Complete all steps: Personal Details, Other Details, Previous Exam, Documents, Review. 7) Pay the platform fee to submit your application. Your application will then be reviewed by the college.'
),

(
  'What is the Platform Fee',
  'student',
  'platform fee application fee payment charge cost submit',
  'The Platform Fee is a one-time fee charged when you submit your application. This fee is non-refundable and is required to submit your application form to the college. The fee amount varies by college. You can see the exact fee on the course listing before applying. Payment is made online via Razorpay (UPI, card, net banking).'
),

(
  'How to Upload Documents',
  'student',
  'document upload attach file pdf photo marksheet certificate aadhaar',
  'To upload documents: 1) Go to the Documents step (Step 5) inside your application form. 2) Click the upload button next to each required document. 3) Select a JPG, PNG, or PDF file (max 5 MB each). 4) Required documents typically include: Aadhaar Card, Passport Photo, 10th Marksheet, 12th Marksheet, Leaving Certificate. Optional documents include Caste Certificate, Income Certificate. The college decides which documents are mandatory for each course.'
),

(
  'Application Status Meanings',
  'student',
  'status draft submitted review correction confirmed rejected enrolled fees paid roll',
  'Your application goes through these stages: Draft = form not yet submitted. Submitted = platform fee paid, waiting for college review. Under Review = college is reviewing your application. Correction Requested = college needs you to fix something (check the correction note). Correction Done = you have resubmitted after correction. Confirmed = college has accepted your application. Fees Paid = you have paid the college fee. Roll Assigned = college has assigned your roll number. Enrolled = subject selection complete, admission finalised. Rejected = application was not accepted (reason is shown). Cancelled = application was withdrawn.'
),

(
  'What to Do When Correction is Requested',
  'student',
  'correction requested fix edit update resubmit change form',
  'If your application status is "Correction Requested": 1) Open your application from "My Applications". 2) Read the correction note shown by the college. 3) Click "Edit Application" and fix the details mentioned. 4) Re-upload any documents if asked. 5) Submit the corrections. Your status will change to "Correction Done" and the college will review again.'
),

(
  'How to Pay College Fee',
  'student',
  'college fee pay tuition fees payment instalment remaining balance',
  'College fee payment becomes available after your application is Confirmed by the college. 1) Go to "My Applications" and open your confirmed application. 2) Click "Pay College Fee". 3) The fee amount is set by the college. Some colleges allow instalments — you will see how much is due now. 4) Payment is made via Razorpay. After payment your status changes to "Fees Paid".'
),

(
  'Forgot Password / Reset Password',
  'student',
  'forgot password reset change login otp phone',
  'If you forgot your password: 1) Go to the login page and click "Forgot password?". 2) Enter your registered mobile number. 3) You will receive a 6-digit OTP on WhatsApp. 4) Enter the OTP. 5) Set your new password. Password requirements: at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.'
),

(
  'How to Register as a Student',
  'student',
  'register signup create account new student phone otp verify',
  'To create a student account: 1) Go to the student login page and click "Register". 2) Fill in your name, email, mobile number, and password. 3) An OTP will be sent to your WhatsApp number. 4) Enter the OTP to verify your phone. 5) Your account is created. You can now log in and start applying. Note: your mobile number must be a valid 10-digit Indian number starting with 6-9.'
),

(
  'How to Download Payment Receipt',
  'student',
  'receipt download payment proof transaction id pdf print',
  'To view or download your payment receipt: 1) Go to "My Receipts" in the student portal (visible after you have made at least one payment). 2) Select the application. 3) Click on a payment to expand the receipt. 4) Click "Download PDF" to save the receipt. Receipts show the college name, course, transaction ID, amount, and date.'
),

(
  'How to Select Subjects',
  'student',
  'subject selection enroll elective choose semester',
  'Subject selection becomes available after the college assigns your roll number. 1) Go to "My Applications" and open the application with status "Roll Assigned". 2) Click "Select Subjects". 3) All compulsory (core) subjects are pre-selected. 4) Choose your elective subjects from the available groups. 5) Click "Submit" to finalise. Your status will change to "Enrolled".'
),

(
  'Application Rejected — What to Do',
  'student',
  'rejected rejection denied application why reason',
  'If your application is rejected: 1) Open the application to see the rejection reason provided by the college. 2) You can apply again to the same or a different college for the same academic year. 3) There is no refund of the platform fee for rejected applications. If you believe the rejection is wrong, contact the college directly using the contact details shown on their college page.'
),

-- ============================================================
-- STUDENT — ACCOUNT & LOGIN
-- ============================================================

(
  'Student Login Steps',
  'student',
  'login sign in student portal how enter phone password',
  'To log in as a student: 1) Go to the Student Login page. 2) Enter your registered 10-digit mobile number. 3) Enter your password. 4) Click "Login". If you see "Invalid phone number or password", double-check your number and password. If you forgot your password, use the "Forgot password?" link. You will be redirected to your Student Dashboard after successful login.'
),

(
  'Password Requirements',
  'student',
  'password requirements strong rules uppercase lowercase number special character',
  'Your password must meet all of these requirements: At least 8 characters long. At least one uppercase letter (A-Z). At least one lowercase letter (a-z). At least one number (0-9). At least one special character (e.g. @, #, $, !, %). Example of a valid password: Admit@2026. Avoid using your name or phone number as your password.'
),

(
  'OTP Not Received on WhatsApp',
  'student',
  'otp not received whatsapp sms message delay resend',
  'If you did not receive the OTP: 1) Wait up to 2 minutes — WhatsApp delivery can be delayed. 2) Make sure your WhatsApp is active on the number you entered. 3) Check your WhatsApp message requests or spam folder. 4) Make sure the number starts with 6, 7, 8, or 9 and is exactly 10 digits. 5) If still not received, click "Resend OTP" after the timer expires. 6) If the problem continues, the WhatsApp service may be temporarily unavailable — try again after 10 minutes.'
),

(
  'How to Change Mobile Number or Email',
  'student',
  'change mobile number email update contact details account',
  'Currently, mobile number and email cannot be changed from the student portal. Your mobile number is used for login and OTP verification. If you need to update your contact details, contact the college where you have applied or the platform administrator. Make sure you use the correct number when registering, as OTPs are sent to it.'
),

(
  'Account Already Exists Error',
  'student',
  'account exists already registered duplicate email phone error',
  'If you see "An account with this email already exists" or "An account with this phone number already exists" during registration: 1) You already have an account with that email or phone number. 2) Go to the login page and sign in instead. 3) If you forgot your password, use "Forgot password?" to reset it. 4) Do not register again with the same number or email — you only need one account to apply to multiple colleges.'
),

-- ============================================================
-- STUDENT — APPLICATION FORM STEPS
-- ============================================================

(
  'Application Form Step 1 — Personal Details',
  'student',
  'step 1 personal details name surname first middle mother gender mobile email address taluka district state category division',
  'Step 1 collects your personal information: Full name (surname, first name, middle name), Mother name, Gender, Mobile number, Email address, Residential address (including taluka, district, state), Category (General, OBC, SC, ST, NT, SBC, EWS etc.), Special status if any, Division (assigned by college — A, B, C etc.). Fill all mandatory fields marked with *. Your name here will appear on your admission documents, so enter it exactly as in your certificates.'
),

(
  'Application Form Step 2 — Other Details',
  'student',
  'step 2 other details birth date place nationality religion caste mother tongue father occupation income aadhaar prn bank',
  'Step 2 collects additional personal information: Date of birth and place of birth, Nationality, Religion, Caste, Mother tongue, Height and weight, Blood group, Father name and occupation, Annual family income, Aadhaar number, PRN (Permanent Registration Number if you have one), ABC ID (Academic Bank of Credits), University application number if applicable, Bank account details (account number, IFSC, bank name, branch) — used for scholarship/refund purposes.'
),

(
  'Application Form Step 3 — Previous Exam Details',
  'student',
  'step 3 previous exam SSC HSC 10th 12th marksheet board seat number percentage marks passing',
  'Step 3 records your previous academic qualifications: For SSC (10th): Board name, school name, seat number, month and year of passing, total marks obtained, maximum marks, percentage, class/grade. For HSC (12th): Same details for your 12th board exam. For lateral entry (SY/TY): Previous college name, FY or SY marksheet details. Enter the information exactly as it appears on your marksheets. Percentage is calculated automatically if you enter obtained and maximum marks.'
),

(
  'Application Form Step 4 — Declaration',
  'student',
  'step 4 declaration accept terms certify agree undertaking',
  'Step 4 is the Declaration step. You must read and accept the declaration before proceeding. The declaration states that all information provided is true and correct to the best of your knowledge. If any information is found to be false, your admission may be cancelled. Tick the checkbox to confirm you have read and accept the declaration. You cannot submit the form without accepting this.'
),

(
  'Application Form Step 5 — Documents',
  'student',
  'step 5 documents upload required mandatory optional list',
  'Step 5 is document upload. The college defines which documents are required for your specific course and year. Common mandatory documents: Aadhaar Card, Passport Photo, 10th Marksheet, 12th Marksheet, Leaving Certificate. Common optional documents: Caste Certificate, Income Certificate, Non-Creamy Layer Certificate, Migration Certificate, Gap Certificate. Upload each document as a JPG, PNG, WEBP or PDF file. Maximum file size is 5 MB per file. Documents must be clear and legible.'
),

(
  'Application Form Step 6 — Review and Submit',
  'student',
  'step 6 review submit preview check confirm application fee pay',
  'Step 6 is the final review before payment. You can see a summary of all your entered details. Check everything carefully — name, course, category, documents. If anything is wrong, go back to the relevant step and fix it. At the bottom you will see the Platform Fee amount. Click "Pay & Submit" to proceed to payment. Once payment is made, your application is submitted and you cannot edit it (unless the college requests a correction).'
),

(
  'Can I Edit My Application After Submission',
  'student',
  'edit application after submitted change update modify locked',
  'After you pay the platform fee and submit your application, you cannot edit it yourself. Editing is only possible if: 1) The college reviews your application and requests a correction — they will specify what needs to be changed. 2) Your application is still in Draft status (before payment). If you made a mistake after submission, you must wait for the college to request a correction, or contact the college directly to request one.'
),

(
  'Can I Apply to Multiple Colleges',
  'student',
  'multiple colleges apply more than one two several different college same course',
  'Yes, you can apply to multiple colleges. There is no restriction on how many colleges you can apply to. Each application is separate and requires its own platform fee payment. You can apply to the same course at different colleges, or different courses. Manage all your applications from "My Applications" in the student portal. Note: applying to multiple colleges does not guarantee admission to any of them.'
),

(
  'Can I Apply for Multiple Courses at the Same College',
  'student',
  'multiple courses same college two courses apply different program',
  'Yes, you can apply for multiple courses at the same college. For example, you can apply for BCA FY and BCom FY at the same college. Each course application is separate and requires a separate platform fee payment. However, once confirmed for one course, you should inform the college if you wish to withdraw from the other application.'
),

-- ============================================================
-- STUDENT — PAYMENTS
-- ============================================================

(
  'Accepted Payment Methods',
  'student',
  'payment method UPI card net banking debit credit Razorpay how pay online',
  'Payments are processed through Razorpay. You can pay using: UPI (Google Pay, PhonePe, Paytm, BHIM, any UPI app), Debit card (Visa, Mastercard, RuPay), Credit card (Visa, Mastercard, Amex), Net banking (all major Indian banks). Make sure your bank account has sufficient balance. For UPI payments, ensure your UPI app is working and linked to your bank account.'
),

(
  'Payment Pending or Stuck',
  'student',
  'payment pending stuck loading not completing processing hang',
  'If your payment appears stuck or pending: 1) Do NOT close the browser or press back — wait at least 3-5 minutes. 2) Check your bank account / UPI app to see if money was deducted. 3) If deducted, wait 10-15 minutes and refresh the portal — payments are verified automatically. 4) If money was NOT deducted, the payment failed safely — you can try again. 5) Never pay twice for the same application without confirming the first payment failed. Check "My Receipts" to see if a receipt was generated.'
),

(
  'Transaction ID and Order ID Explained',
  'student',
  'transaction id order id razorpay pay_ what is difference receipt',
  'Transaction ID (starts with pay_) is your unique payment reference number assigned by Razorpay when the payment is successfully completed. This is the most important number — keep it for your records. Order ID (starts with order_) is created before payment begins. If a payment fails, the Order ID may exist but no Transaction ID is assigned. Your payment receipt shows the Transaction ID. Always use the Transaction ID when contacting support about a payment.'
),

(
  'Refund Policy',
  'student',
  'refund money back cancelled rejected platform fee college fee',
  'Platform Fee (application submission fee): Non-refundable in all cases — including if your application is rejected or you withdraw. College Fee: Refund policy is set by the individual college. Contact the college directly for their refund policy. If you paid college fee and your application is cancelled after that, the refund depends on the college rules. The portal does not handle refunds directly — they are processed by the college or through Razorpay dispute resolution.'
),

(
  'College Fee Instalment Payment',
  'student',
  'instalment partial payment college fee first second remaining balance',
  'Some colleges allow paying the college fee in instalments. When the college sets a "Pay Now" amount that is less than the total fee, you pay that amount first. After paying the first instalment, your status changes to "Fees Paid". The remaining balance will be shown in your application. You can pay the remaining amount later through the same "Pay College Fee" option. Not all colleges offer instalment payment — it depends on the college settings.'
),

-- ============================================================
-- STUDENT — DOCUMENTS
-- ============================================================

(
  'Document Types Required for Admission',
  'student',
  'documents list required aadhaar photo 10th 12th leaving caste income migration domicile gap',
  'Common documents required for admission: Mandatory — Aadhaar Card (government ID), Passport Photo (recent, colour), 10th Marksheet (SSC), 12th Marksheet (HSC), Leaving Certificate (from last institution). For SY applicants — FY Marksheet. For TY applicants — SY Marksheet. Commonly optional — Caste Certificate, Caste Validity Certificate, Non-Creamy Layer Certificate, Income Certificate, Domicile Certificate, Migration Certificate (if from another university), Gap Certificate (if there was a gap year), Medical Certificate, Bank Passbook. The exact list depends on the college and course.'
),

(
  'Document Upload Errors',
  'student',
  'upload error failed invalid file type size large rejected document',
  'Common document upload errors: "Invalid file type" — only JPG, PNG, WEBP, and PDF files are accepted. Convert other formats before uploading. "File too large" — maximum size is 5 MB per file. Compress or scan at lower resolution. "Upload failed" — check your internet connection and try again. Make sure the file is not password-protected (PDFs). If a PDF is scanned, ensure it is readable. Do not upload blank or corrupted files.'
),

(
  'Document Verification by College',
  'student',
  'document verified verification college check original physical',
  'After you upload documents online, the college staff will review them. Document verification status (verified or pending) is shown on your application. Online document upload does not replace physical document verification. Most colleges require you to bring original documents at the time of admission confirmation or at the start of the academic year. The college will inform you about physical verification requirements.'
),

-- ============================================================
-- STUDENT — NOTIFICATIONS
-- ============================================================

(
  'How Notifications Work',
  'student',
  'notification bell alert update application status change message',
  'Notifications are shown in the bell icon at the top of the student portal. You receive notifications when: Your application status changes (e.g. submitted, under review, confirmed, rejected). The college requests a correction on your application. Your roll number is assigned. College fee payment is received. Notifications also appear as a popup when you first log in. Click "View Notifications" to see all notifications. Notifications are also sent via WhatsApp to your registered mobile number.'
),

(
  'WhatsApp Notifications',
  'student',
  'whatsapp message notification update alert admission status',
  'The portal sends WhatsApp messages to your registered mobile number for important events: OTP for registration and password reset, Application submission confirmation, Admission confirmation (when college confirms your application), Fee payment confirmation, Roll number assignment. Ensure your WhatsApp is active on the number you registered with. If you do not receive WhatsApp messages, check the portal notifications as a backup.'
),

-- ============================================================
-- STUDENT — CERTIFICATES AND RECEIPTS
-- ============================================================

(
  'Bonafide Certificate',
  'student',
  'bonafide certificate study proof enrolled student issue',
  'A Bonafide Certificate is issued by the college to certify that you are a currently enrolled student. It is required for bank loans, passport applications, government schemes, etc. To get a Bonafide Certificate: Contact your college administration office. The college staff generates it through the college portal. The certificate shows your name, course, year, academic year, and registration number. It is issued after your admission is confirmed and roll number is assigned.'
),

(
  'Character Certificate',
  'student',
  'character certificate conduct good moral issue college',
  'A Character Certificate certifies your conduct and character as a student. It is typically required when applying to other institutions or for employment. It is issued by the college. Contact your college administration to request one. The certificate is generated by college staff through the portal and includes your name, course, years of study, and a character statement.'
),

(
  'No Objection Certificate NOC',
  'student',
  'NOC no objection certificate transfer migration another college university',
  'A No Objection Certificate (NOC) is required when you want to transfer to another college or university. It states that your current/previous institution has no objection to your admission elsewhere. To get an NOC: Contact your college administration office. Provide your registration number and details of the institution you are transferring to. The college issues it through the portal. It shows your enrollment dates, course, and confirmation that fees are cleared.'
),

-- ============================================================
-- STUDENT — ACADEMIC
-- ============================================================

(
  'What is PRN Number',
  'student',
  'PRN permanent registration number university what is where find',
  'PRN stands for Permanent Registration Number. It is a unique number assigned by the university to every student after formal enrollment. You enter your PRN in Step 2 of the application form if you already have one (e.g. for SY or TY students who were enrolled previously). First-year students (FY) typically do not have a PRN yet — leave it blank if you do not have one. Your college will provide your PRN after admission is confirmed.'
),

(
  'What is ABC ID',
  'student',
  'ABC ID academic bank credits APAAR what is where get',
  'ABC ID stands for Academic Bank of Credits (ABC) ID, also known as APAAR ID. It is a unique 12-digit ID assigned by the National Academic Depository under NEP 2020. It stores your academic credits digitally. You can create your ABC ID on the DigiLocker app or website. Enter it in Step 2 of your application form. It is optional for most admissions currently but will become mandatory as NEP implementation progresses.'
),

(
  'Year of Study Explained',
  'student',
  'year study FY SY TY first second third year what apply',
  'Year of Study refers to which year of the degree course you are applying for: FY (First Year) = Year 1, for students completing 12th (HSC). SY (Second Year) = Year 2, for students who completed FY at another college (lateral transfer) or are continuing. TY (Third Year) = Year 3, for students who completed SY. Apply for the year that matches your current qualification. Most new students apply for FY. Each year of study may have different fee structures and seat availability.'
),

(
  'Academic Year Format',
  'student',
  'academic year 2026-27 format what enter which year',
  'The academic year is in the format YYYY-YY, for example 2026-27 meaning the academic session starting in 2026 and ending in 2027. The portal shows available academic years in the admission period listing. You apply for the current academic year that the college has opened admissions for. The academic year appears on your registration number, receipts, and admission documents.'
),

-- ============================================================
-- COLLEGE ADMIN — PORTAL OVERVIEW
-- ============================================================

(
  'College Portal Overview',
  'college',
  'college portal dashboard overview sections features menu navigation',
  'The College Portal has these main sections: Overview — shows summary stats (total applications, confirmed, enrolled, pending). Admission Periods — create and manage open admission slots. Admission Inbox — review all incoming student applications. Admission — add applications directly for walk-in students. Roll Numbers — assign roll numbers to confirmed/fees-paid students. Fee Receipts — view all payment receipts. Masters section — Program Master, Bank Master, Course Master, Group Master, Division Master, Fees Master, Required Documents. Certificates — generate Bonafide, Character, and NOC certificates.'
),

(
  'College Login Steps',
  'college',
  'college login sign in admin staff portal email password',
  'To log in to the college portal: 1) Go to the College Login page. 2) Enter your college admin email address. 3) Enter your password. 4) Click "Login". College admins use the email set during college registration. Staff members use their individual staff email. If you forgot your password, contact the platform administrator to reset it — college admins do not have a self-service password reset.'
),

(
  'Difference Between College Admin and Staff',
  'college',
  'admin staff difference role permission sub user college user',
  'College Admin is the main account for the college (set up by the platform administrator). The admin has full access to all features and can create staff accounts. College Staff are sub-users created by the college admin. Each staff member has a specific role with defined permissions — e.g. a staff member may only be allowed to review applications but not manage fees. Staff permissions are set in the college admin portal under user management. Staff see only the sections they have permission for.'
),

(
  'How to Create College Staff Accounts',
  'college',
  'staff user create account add role permission college user management',
  'To add a staff member: 1) Log in as the college admin. 2) Go to the admin section for managing college users. 3) Click "Add User". 4) Enter the staff member name, email, and password. 5) Assign a role (e.g. Admission Clerk, Fee Collector). 6) The role defines what the staff member can access and do. Staff members log in using the same College Login page with their own email and password.'
),

-- ============================================================
-- COLLEGE ADMIN — APPLICATION WORKFLOW
-- ============================================================

(
  'How to Review Student Applications',
  'college',
  'review application inbox accept reject verify document scrutiny',
  'To review applications: 1) Go to "Admission Inbox" in the college portal. 2) Open any submitted application. 3) Check the student details and uploaded documents. 4) You can: Accept (move to Under Review), Request Correction (ask student to fix details), Reject (with a reason), or Confirm (formally accept the student). Use the status buttons on the application detail page.'
),

(
  'Application Review Workflow',
  'college',
  'workflow steps review accept reject confirm application process flow',
  'The college application review workflow: 1) Student submits application (pays platform fee) → status: Submitted. 2) College clicks "Accept for Review" → status: Under Review. 3) College reviews details and documents. Options: a) Request Correction → student fixes and resubmits → status: Correction Done. b) Reject (with reason) → status: Rejected. c) Accept Scrutiny → status: Scrutiny Accepted. d) Mark Doc Verification Pending → status: Doc Verification Pending. e) Mark Doc Verified → status: Doc Verified. f) Confirm Admission (set fee) → status: Confirmed. 4) Student pays college fee → status: Fees Paid. 5) College assigns roll number → status: Roll Assigned. 6) Student selects subjects → status: Enrolled.'
),

(
  'How to Set College Fee for a Student',
  'college',
  'fee amount set confirm tuition total pay now instalment college admin',
  'When confirming an application you can set the fee: 1) Open the application and click "Confirm Admission". 2) Enter the Total Fee Amount. 3) Optionally enter a "Pay Now" amount if you want to allow instalments. 4) Click Confirm. The student will then see the fee and can pay online. If you use the Fees Master, fees are calculated automatically from the student category and division.'
),

(
  'How to Confirm an Application and Set Fee',
  'college',
  'confirm application admission set fee total amount accept student',
  'To confirm a student application: 1) Open the application from the Admission Inbox. 2) Review all details and documents. 3) Click the "Confirm" or "Confirm Admission" button. 4) A dialog will appear asking for: Total Fee Amount (the full college fee the student must pay), Pay Now Amount (optional — the first instalment if you allow part-payment). 5) Click Confirm. The student will receive a notification and can now see the fee and make payment. Note: once confirmed, the application moves to "Confirmed" status.'
),

(
  'How to Reject an Application',
  'college',
  'reject application reason denial student why',
  'To reject an application: 1) Open the application from the Admission Inbox. 2) Click the "Reject" button. 3) Enter a rejection reason — this is shown to the student, so write a clear explanation (e.g. "Seat not available for this category" or "Incomplete documents"). 4) Click Confirm Reject. The student receives a notification about the rejection. They can apply again if they wish. Rejection is permanent — a rejected application cannot be restored to an earlier status.'
),

(
  'How to Request Correction from Student',
  'college',
  'request correction ask fix student form details documents change',
  'If a student application has incorrect information: 1) Open the application from the Inbox. 2) Click "Request Correction". 3) Enter a detailed correction note explaining exactly what needs to be fixed (e.g. "Please upload a clear copy of your 12th marksheet" or "Date of birth does not match Aadhaar"). 4) Click Submit. The student receives a notification and can edit and resubmit. The status changes to "Correction Requested". Once the student fixes and resubmits, the status becomes "Correction Done" and you can review again.'
),

(
  'How to Verify Documents',
  'college',
  'verify document check original physical online uploaded mark verified',
  'To verify documents in the portal: 1) Open the application. 2) Go to the Documents section. 3) Click on each document to view it. 4) After verifying, you can mark it as verified. 5) Once all required documents are verified, proceed to Confirm the application. Physical document verification (original documents) is typically done when the student visits the college. The portal tracks which documents have been uploaded and verified online.'
),

(
  'Walk-in Student Application by College',
  'college',
  'walk in student offline admission college apply add direct form manual',
  'College staff can add applications directly for walk-in or offline students: 1) Go to the "Admission" section in the college portal. 2) Search for the student by phone number — if they have a portal account, their details will load. 3) If the student is not registered, you can enter their details manually. 4) Select the course, year, and admission period. 5) Complete the application form on behalf of the student. 6) The platform fee can be waived for college-entered applications. This is used when students apply in person at the college office.'
),

-- ============================================================
-- COLLEGE ADMIN — ADMISSION PERIODS
-- ============================================================

(
  'How to Manage Admission Periods',
  'college',
  'admission period open close seats academic year start end date',
  'Admission periods control when students can apply. 1) Go to "Admission Periods". 2) Click "Add Period" to create a new period for a course and year. 3) Set start date, end date, total seats, and whether it is active. 4) Students can only apply when the period is active and between the start and end dates. 5) You can disable a period at any time to stop new applications.'
),

(
  'Admission Periods — Seat Management',
  'college',
  'seats total filled available remaining close disable period full',
  'Each admission period has a total seat count and a filled seats count. Filled seats increase automatically when applications are confirmed. When filled seats equal total seats, no new applications can be submitted for that period. You can: Increase total seats if more seats become available. Disable the period to stop new applications before seats are full. Re-enable a disabled period to open applications again. Monitor seat availability from the Admission Periods page. Students see available seats when browsing your college.'
),

-- ============================================================
-- COLLEGE ADMIN — ROLL NUMBERS
-- ============================================================

(
  'How to Assign Roll Numbers',
  'college',
  'roll number assign seat enrollment class list',
  'To assign roll numbers: 1) Go to "Roll Numbers" in the college portal. 2) Select the academic year, course, and year of study. 3) Use "Auto Assign" to assign roll numbers sequentially to all confirmed/fees-paid students, or assign individually. 4) Once assigned, students can see their roll number and proceed to subject selection.'
),

-- ============================================================
-- COLLEGE ADMIN — MASTERS
-- ============================================================

(
  'Program Master (Faculty Master)',
  'college',
  'program master faculty course BCA BCom add create duration code',
  'The Program Master (also called Faculty Master) is where you define the degree programs offered by your college. Each program has: Degree Course Code (e.g. BCA, BCOM), Degree Course Name (full name), Duration in years (e.g. 3), Semester codes for each semester. Add a new program: 1) Go to Program Master. 2) Click "Add Program". 3) Enter the code, name, and duration. 4) Save. Programs defined here appear as course options when creating admission periods.'
),

(
  'Fees Master',
  'college',
  'fees master fee structure add head type amount category BCC open',
  'The Fees Master defines the fee components for each course: Fee Type (e.g. Tuition, Exam, Library, Lab), Fee Head name, Amount for each category (Cat 1 = Open/General, Cat 2 = OBC/SBC/EWS, Cat 3 = SC/ST/NT, Cat 4 = custom). Fees are linked to courses and year levels (FY, SY, TY). When you confirm a student application, the fee is auto-calculated from the Fees Master based on the student category and division. You can also override the fee manually at confirmation time.'
),

(
  'Division Master',
  'college',
  'division master class section A B C create add year level',
  'The Division Master defines class divisions (sections) for each course and year: Division Letter (A, B, C, D), Year Level (FY, SY, TY), Funding type (grant/non-grant), Class Year Code. Divisions are used to categorise students into sections and are linked to fee structures. When a student fills their application, they select or are assigned a division. The division determines which fee slab applies from the Fees Master.'
),

(
  'Bank Master',
  'college',
  'bank master account IFSC add ledger code name branch',
  'The Bank Master defines the college bank accounts used for fee collection: Bank account number, Bank name, Branch, IFSC code, Account type, Ledger code (auto-generated). Bank accounts defined here are linked to fee heads in the Fees Master. This ensures each fee component is credited to the correct bank account. Add accounts: 1) Go to Bank Master. 2) Click "Add Account". 3) Fill in bank details. 4) Save.'
),

(
  'Course Master (Subjects)',
  'college',
  'course master subject semester add code title credits marks internal external',
  'The Course Master (not to be confused with Program/Faculty Master) defines individual subjects for each semester of a program: Course code, Course title, Semester number, Credits, Maximum internal marks, Minimum internal marks, Maximum semester-end marks, Minimum semester-end marks, Subject type (theory/practical/project). These subjects appear in the student subject selection step after roll number assignment.'
),

(
  'Required Documents Master',
  'college',
  'required documents master add configure course year mandatory optional',
  'The Required Documents Master lets you configure which documents students must upload for each course and year of study: 1) Go to "Req. Documents" in the Masters section. 2) Select course and year of study. 3) Add document types from the global list (Aadhaar, Photo, Marksheet, etc.). 4) Set each as Mandatory or Optional. Students applying for that course will see exactly these documents in their upload step. If not configured, students see the default global document list.'
),

-- ============================================================
-- COLLEGE ADMIN — FEES AND PAYMENTS
-- ============================================================

(
  'Viewing Fee Receipts',
  'college',
  'fee receipt view payment student transaction history report',
  'To view payment receipts: 1) Go to "Fee Receipts" in the college portal. 2) You can filter by course, year of study, and payment type (platform fee or college fee). 3) Each receipt shows: student name, registration number, payment type, amount, transaction ID, and date. 4) You can expand individual receipts to see full details. This section is useful for reconciling payments and confirming who has paid.'
),

(
  'College Collects Fee on Behalf of Student',
  'college',
  'collect fee student offline cash counter college staff pay behalf',
  'If a student pays the college fee in person (cash or DD), college staff can record it through the portal: 1) Open the confirmed application. 2) Use the "Collect Payment" option. 3) Enter the payment amount. 4) Process the payment through Razorpay on behalf of the student. Note: all payments must go through the online Razorpay gateway for proper tracking and receipts. The portal does not support manual cash entry — the payment must be processed online.'
),

-- ============================================================
-- COLLEGE ADMIN — CERTIFICATES
-- ============================================================

(
  'How to Issue Bonafide Certificate',
  'college',
  'bonafide issue generate create certificate student enrolled class year',
  'To issue a Bonafide Certificate: 1) Go to "Certificates" in the college portal. 2) Select "Bonafide Certificate". 3) Search for the student by registration number or name. 4) Fill in the certificate details: certificate number, date, class name, academic year. 5) Click Generate. 6) The certificate can be printed or downloaded as PDF. Certificate numbers are unique per college. Keep a record of issued certificates for your records.'
),

(
  'How to Issue Character Certificate',
  'college',
  'character issue generate certificate conduct student',
  'To issue a Character Certificate: 1) Go to "Certificates" → "Character Certificate". 2) Search for the student. 3) Fill in the certificate number, date, class, academic year, and years known. 4) Click Generate. 5) Print or download the certificate. The certificate states the student was of good conduct during their enrollment. Issue only after verifying the student has no disciplinary record.'
),

(
  'How to Issue NOC Certificate',
  'college',
  'NOC issue generate no objection certificate migration transfer',
  'To issue a No Objection Certificate (NOC): 1) Go to "Certificates" → "NOC Certificate". 2) Search for the student. 3) Fill in the certificate number, date, from date, to date (enrollment period), PRN number, and final confirmation number if applicable. 4) Click Generate. 5) Print or download. Issue NOCs only for students who have formally completed or withdrawn from your institution and are transferring elsewhere.'
),

-- ============================================================
-- BOTH — GENERAL SYSTEM
-- ============================================================

(
  'Contact College Support',
  'both',
  'contact help support phone email problem issue',
  'If you have an issue that the portal cannot resolve: 1) Find the college contact details on the college page (phone and email are shown). 2) For platform-level technical issues (login problems, payment errors), contact the system administrator. 3) For application-specific issues, always contact the college directly as they manage their own admissions process.'
),

(
  'Payment Failed or Deducted but Not Confirmed',
  'both',
  'payment failed error deducted not confirmed razorpay retry',
  'If your payment was deducted but the application was not updated: 1) Wait 5-10 minutes and refresh — payments are verified automatically. 2) Check "My Receipts" to see if the payment appears there. 3) If the payment was genuinely deducted but not reflected after 30 minutes, note your Razorpay Transaction ID (starts with pay_) and contact college support or the platform administrator. Do not attempt payment again until confirmed — duplicate payments may not be refunded.'
),

(
  'Registration Number Format',
  'both',
  'registration number format what is meaning structure decode',
  'The registration number is assigned automatically when a student pays the platform fee. Format: YYYYYYYYYYY-CC-Y-NNNN. Where: YYYYYYYYYYY = academic year without hyphen (e.g. 202627), CC = course ID padded to 2 digits, Y = year of study (1, 2, or 3), NNNN = sequential number (0001, 0002...). Example: 202627-01-1-0001 means academic year 2026-27, course ID 1, First Year, first applicant. The registration number appears on your application, receipts, and admission documents.'
),

(
  'What is the College Code',
  'both',
  'college code CL001 what format unique identifier',
  'Each college on the platform has a unique College Code in the format CL followed by a 3-digit number (e.g. CL001, CL002, CL015). The college code is assigned when the college is registered on the platform. Students use this code to search for a specific college in "Browse & Apply". The code is case-insensitive — CL001 and cl001 both work. College staff can find their college code on the college portal overview page.'
),

(
  'Portal Supported Browsers and Devices',
  'both',
  'browser device mobile phone tablet laptop compatible chrome firefox safari edge',
  'The portal works on all modern web browsers: Google Chrome (recommended), Mozilla Firefox, Microsoft Edge, Safari (Mac and iOS). It is fully responsive and works on mobile phones, tablets, and laptops. For the best experience, use Chrome on a laptop or desktop. If you face display issues, try clearing your browser cache (Ctrl+Shift+Del) or use a different browser. JavaScript must be enabled. Internet Explorer is not supported.'
),

(
  'Portal is Slow or Not Loading',
  'both',
  'slow loading not working error page blank white screen reload refresh',
  'If the portal is slow or not loading: 1) Check your internet connection. 2) Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R on Mac). 3) Clear browser cache and cookies. 4) Try a different browser. 5) Disable browser extensions (ad blockers can sometimes interfere). 6) Try on a different device or network. If the problem persists for more than 30 minutes, the server may be under maintenance — try again later.'
),

(
  'Session Expired — Please Login Again',
  'both',
  'session expired logout automatically login again token expired',
  'Your login session lasts for 7 days. If you see "Session expired" or are redirected to the login page: 1) Your session has timed out after 7 days of inactivity, or your browser cleared cookies. 2) Log in again with your credentials. 3) If you are logged out frequently, make sure your browser is not set to clear cookies on close. 4) The portal uses secure httpOnly cookies for sessions — do not disable cookies in your browser.'
),

(
  'Offline or No Internet Error',
  'both',
  'no internet offline connection error network unavailable',
  'If you see a "No internet connection" message: 1) Check your WiFi or mobile data connection. 2) Try opening another website to confirm internet is working. 3) If you are on mobile data, move to an area with better signal. 4) Once connection is restored, the portal will reconnect automatically. 5) Any form data you were filling may need to be re-entered — the portal saves progress where possible but does not guarantee local saving during offline periods.'
),

(
  'Data Privacy and Security',
  'both',
  'privacy data security personal information safe stored confidential',
  'Your personal data is stored securely on the platform. Passwords are encrypted using bcrypt and never stored in plain text. Authentication uses secure httpOnly cookies (tokens are not accessible via JavaScript). Document files are stored on the server and accessible only to you and the college you applied to. Personal information is used only for admission processing. The platform does not share your data with third parties. Payment processing is handled entirely by Razorpay — the portal does not store card or bank details.'
),

(
  'Super Admin — Adding a New College',
  'both',
  'add college create onboard new register admin super platform',
  'To add a new college to the platform: 1) Log in as Super Admin. 2) Go to the Admin Dashboard. 3) Click "+ New College". 4) Fill in college details: Name, Address, City, Phone, Email, Admin Email, Admin Password, College Code (auto-generated if left blank), Application Fee. 5) Click Create. The college can now log in using the admin email and password provided. The college will then set up their programs, fees, and admission periods.'
),

(
  'Super Admin — Managing Colleges',
  'both',
  'manage college list view edit roles permissions super admin',
  'Super Admin can see all colleges registered on the platform. From the Admin Dashboard you can: View list of all colleges with their codes and contact details. View college details and their role/permission setup. Add new colleges. Manage college roles and permissions (what sections each staff role can access). Super Admin has access to all college data and can assist with setup or troubleshooting.'
),

(
  'College Roles and Permissions',
  'both',
  'role permission college staff create assign what access',
  'College roles define what staff members can do. Each role has a set of permissions: review_application — can view and process applications. submit_application — can submit applications on behalf of students. assign_subjects — can assign roll numbers and manage subject selection. collect_fees — can view and process fee payments. masters — can manage master data (programs, fees, etc.). certificates — can generate certificates. nav: permissions control which sidebar sections are visible. The college admin creates roles and assigns them to staff members.'
)

) AS src(title, category, keywords, content)
WHERE NOT EXISTS (
    SELECT 1 FROM chatbot_knowledge ck WHERE ck.title = src.title
);
GO
