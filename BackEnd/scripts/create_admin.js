/**
 * Run once: node scripts/create_admin.js
 * Creates admins table and seeds one super-admin account.
 * Credentials: admin@vengurlatech.com / Admin@123
 */

const db     = require('../routes/db');
const bcrypt = require('bcryptjs');

async function run() {
  await db.connect?.();

  // Create table
  await db.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admins'
    )
    BEGIN
      CREATE TABLE admins (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        name          NVARCHAR(100)  NOT NULL,
        email         NVARCHAR(150)  NOT NULL UNIQUE,
        password_hash NVARCHAR(255)  NOT NULL,
        created_at    DATETIME       DEFAULT GETDATE()
      )
    END
  `);
  console.log('✓ admins table ready');

  const email    = 'admin@vengurlatech.com';
  const password = 'Admin@123';
  const hash     = await bcrypt.hash(password, 10);

  const exists = await db.request()
    .input('email', email)
    .query('SELECT id FROM admins WHERE email = @email');

  if (exists.recordset.length > 0) {
    console.log('Admin already exists — skipping insert.');
  } else {
    await db.request()
      .input('name',  'Super Admin')
      .input('email', email)
      .input('hash',  hash)
      .query(`INSERT INTO admins (name, email, password_hash) VALUES (@name, @email, @hash)`);
    console.log(`✓ Admin created: ${email} / ${password}`);
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
