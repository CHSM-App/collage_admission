/**
 * seed_elphinstone_100.js
 * Inserts 100 test applications for Elphinstone college (id=1).
 * Creates new test students as needed, then inserts applications
 * spread across available admission periods with varied statuses.
 */

const sql = require('mssql')

const cfg = {
  user: 'college_vt',
  password: 'College_db@123',
  server: 'winsome.grabweb.in',
  port: 5691,
  database: 'college_db',
  options: { encrypt: false, trustServerCertificate: true },
}

const COLLEGE_ID = 1
const ACADEMIC_YEAR = '2026-27'

const FIRST_NAMES = ['Aarav','Aditi','Aditya','Akshay','Akshara','Amey','Amruta','Ananya','Anjali','Ankit',
  'Arjun','Arya','Ashwini','Bhavesh','Deepa','Devika','Dhruv','Divya','Gaurav','Gauri',
  'Harsh','Hemangi','Ishaan','Ishita','Jay','Jyoti','Karan','Kavya','Krish','Laxmi',
  'Madhuri','Manav','Manisha','Mayur','Meera','Mihir','Monika','Nandini','Neha','Nikhil',
  'Nilesh','Omkar','Pallavi','Payal','Pooja','Pratik','Priya','Rahul','Raj','Rajesh',
  'Rakesh','Ravi','Rohit','Rutuja','Sahil','Sakshi','Sandesh','Sanjay','Sanika','Shruti',
  'Shubham','Snehal','Soham','Sonal','Suraj','Swapnil','Tanvi','Tejas','Tushar','Uday',
  'Vaibhav','Varsha','Vedant','Vijay','Vipul','Vishal','Yogesh','Yash','Zeenat','Zara']

const LAST_NAMES = ['Patil','Desai','Sawant','Naik','Gaikwad','Shinde','Jadhav','More','Bhosale','Kulkarni',
  'Joshi','Pawar','Salunkhe','Kadam','Mane','Rane','Tawde','Khamkar','Surve','Waghmare']

const CASTES = ['General','OBC','SC','ST','NT(B)','SBC','General','General','OBC','SC']
const STATUSES_LIST = [null, null, null, 'EBC', null, 'PH', null, null, null, null]
const APP_STATUSES = [
  'submitted','submitted','under_review','under_review',
  'correction_requested','correction_done','doc_verified',
  'confirmed','fees_paid','roll_assigned',
]

// Admission periods for college 1
const PERIODS = [
  { id: 4,  course_id: 1, year_of_study: 1 },
  { id: 2,  course_id: 1, year_of_study: 2 },
  { id: 8,  course_id: 1, year_of_study: 3 },
  { id: 12, course_id: 3, year_of_study: 1 },
  { id: 6,  course_id: 3, year_of_study: 2 },
  { id: 7,  course_id: 3, year_of_study: 3 },
  { id: 13, course_id: 4, year_of_study: 1 },
  { id: 14, course_id: 4, year_of_study: 2 },
  { id: 15, course_id: 4, year_of_study: 3 },
]

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pad(n) { return String(n).padStart(4, '0') }

async function main() {
  const pool = await sql.connect(cfg)
  console.log('Connected.')

  let created = 0
  let skipped = 0

  for (let i = 0; i < 100; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]
    const lastName  = LAST_NAMES[i % LAST_NAMES.length]
    const fullName  = `${firstName} ${lastName}`
    const email     = `test.${firstName.toLowerCase()}${i + 1}@testmail.com`
    const phone     = `9${String(7000000000 + i).slice(1)}`
    const dob       = '2003-06-15'

    // Insert student
    let studentId
    try {
      await pool.request()
        .input('name',  sql.NVarChar, fullName)
        .input('email', sql.NVarChar, email)
        .input('phone', sql.NVarChar, phone)
        .input('dob',   sql.Date,     dob)
        .query(`
          INSERT INTO students (full_name, email, phone, dob, password_hash)
          VALUES (@name, @email, @phone, @dob, 'SEED_NOLOGIN')
        `)
      // @@IDENTITY works even with triggers (SCOPE_IDENTITY returns NULL when trigger fires)
      const idRes = await pool.request().query('SELECT CAST(@@IDENTITY AS INT) AS id')
      studentId = idRes.recordset[0].id
    } catch (e) {
      // email conflict — fetch existing
      const ex = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT id FROM students WHERE email=@email')
      if (!ex.recordset.length) { console.error('Skip', i, e.message); skipped++; continue }
      studentId = ex.recordset[0].id
    }

    const period   = PERIODS[i % PERIODS.length]
    const appStatus = APP_STATUSES[i % APP_STATUSES.length]
    const caste    = CASTES[i % CASTES.length]
    const special  = STATUSES_LIST[i % STATUSES_LIST.length]
    const regNo    = `ELP${ACADEMIC_YEAR.replace('-','')}-${pad(i + 1)}`
    const submittedAt = new Date(Date.now() - (100 - i) * 86400000) // spread over last 100 days

    try {
      await pool.request()
        .input('collegeId',   sql.Int,      COLLEGE_ID)
        .input('studentId',   sql.Int,      studentId)
        .input('periodId',    sql.Int,      period.id)
        .input('courseId',    sql.Int,      period.course_id)
        .input('year',        sql.Int,      period.year_of_study)
        .input('ay',          sql.NVarChar, ACADEMIC_YEAR)
        .input('status',      sql.NVarChar, appStatus)
        .input('caste',       sql.NVarChar, caste)
        .input('special',     sql.NVarChar, special)
        .input('regNo',       sql.NVarChar, regNo)
        .input('submittedAt', sql.DateTime2, submittedAt)
        .query(`
          INSERT INTO applications
            (college_id, student_id, admission_period_id, course_id, year_of_study,
             academic_year, status, app_category, app_special_status,
             registration_number, submitted_at)
          VALUES
            (@collegeId, @studentId, @periodId, @courseId, @year,
             @ay, @status, @caste, @special,
             @regNo, @submittedAt)
        `)
      created++
      if (created % 10 === 0) console.log(`  ${created} applications inserted...`)
    } catch (e) {
      console.error(`App ${i} failed:`, e.message)
      skipped++
    }
  }

  console.log(`\nDone. ${created} applications created, ${skipped} skipped.`)
  await pool.close()
}

main().catch(e => { console.error(e.message); process.exit(1) })
