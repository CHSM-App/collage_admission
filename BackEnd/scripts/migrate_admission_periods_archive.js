/**
 * migrate_admission_periods_archive.js
 *
 * Runs migrate_admission_periods_archive.sql against the configured DB.
 * The SQL file uses GO-separated batches (CREATE TRIGGER must be the only
 * statement in its batch), so we split on GO and execute each batch
 * separately via mssql.
 *
 * Idempotent — safe to re-run.
 *
 * Run once: node BackEnd/scripts/migrate_admission_periods_archive.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const sql  = require('mssql');

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT),
  options:  { encrypt: true, trustServerCertificate: true },
};

const SQL_FILE = path.join(__dirname, 'migrate_admission_periods_archive.sql');

// Split SQL on standalone GO lines (GO is a sqlcmd batch separator,
// not a SQL statement — mssql can't process it directly).
function splitOnGo(text) {
  return text
    .split(/^\s*GO\s*;?\s*$/im)
    .map(s => s.trim())
    .filter(Boolean);
}

async function run() {
  if (!fs.existsSync(SQL_FILE)) {
    throw new Error(`SQL file not found: ${SQL_FILE}`);
  }
  const fullSql = fs.readFileSync(SQL_FILE, 'utf-8');
  const batches = splitOnGo(fullSql);

  console.log(`Connecting to ${config.server}/${config.database}...`);
  const pool = await sql.connect(config);

  console.log(`Executing ${batches.length} batch${batches.length === 1 ? '' : 'es'}...`);
  for (let i = 0; i < batches.length; i++) {
    const preview = batches[i].split('\n').find(l => l.trim() && !l.trim().startsWith('--'))?.trim().slice(0, 80) || '';
    process.stdout.write(`  [${i + 1}/${batches.length}] ${preview} ... `);
    try {
      await pool.request().batch(batches[i]);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(err.message);
      await pool.close();
      process.exit(1);
    }
  }

  await pool.close();
  console.log('Migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
