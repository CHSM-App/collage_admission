const mssql = require('mssql');
require('dotenv').config();

// The DB is reached over the internet, so connections can be dropped silently
// while idle. These settings let the pool heal itself instead of failing:
const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
    pool: {
        max: 30,
        min: 0,                        // don't keep idle connections forever — they go stale
        idleTimeoutMillis:    30000,   // close a connection after 30 s idle; a fresh one opens on demand
        acquireTimeoutMillis: 20000,   // longer than connectionTimeout, so a slow connect can be retried
    },
    // Check a connection's socket before handing it out, instead of running
    // `SELECT 1` on every query (a full extra round trip that could also hang).
    validateConnection: 'socket',
    requestTimeout:    15000,          // query must complete within 15s
    connectionTimeout: 10000,          // < acquireTimeoutMillis: a failed connect surfaces as a real error
};

const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // ms

// One pool for the process lifetime. It is never torn down on errors: mssql
// discards broken connections and opens new ones by itself. (Replacing the pool
// used to turn a single dropped connection into seconds of failed requests.)
let pool = null;

async function connect() {
    for (let attempt = 1; ; attempt++) {
        const candidate = new mssql.ConnectionPool(sqlConfig);
        // Registered once per pool. A single failed connection lands here — log it only.
        candidate.on('error', err => console.warn('[DB] Connection error (pool keeps running):', err.message));
        try {
            await candidate.connect();
            pool = candidate;
            console.log('[DB] Connection pool ready.');
            return pool;
        } catch (err) {
            try { await candidate.close(); } catch (_) {}
            console.error(`[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
            if (attempt >= MAX_RETRIES) {
                console.error('[DB] Max retries reached. Exiting.');
                process.exit(1);
            }
            await new Promise(r => setTimeout(r, RETRY_DELAY));
        }
    }
}

// Start connecting immediately; routes call db.request() inside async
// handlers so the pool is normally ready before the first real request.
const ready = connect();

// Exported object — route code calls db.request() inside async functions, and a
// few places use `const pool = await db; pool.transaction()`.
const db = {
    then(resolve, reject) {
        return ready.then(() => resolve(pool), reject);
    },

    request() {
        if (!pool) {
            // Only during startup, before the first successful connect: a request
            // whose .query() rejects, so handlers answer 503 instead of crashing.
            const err = new Error('[DB] Database not connected yet — try again shortly.');
            err.statusCode = 503;
            const fake = { input: () => fake, query: () => Promise.reject(err) };
            return fake;
        }
        return pool.request();
    },

    transaction() {
        if (!pool) throw new Error('[DB] Database not connected yet — try again shortly.');
        return pool.transaction();
    },

    async close() {
        if (pool) {
            try { await pool.close(); } catch (_) {}
            pool = null;
        }
    },
};

module.exports = db;
