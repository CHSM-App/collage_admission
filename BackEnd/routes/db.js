const mssql = require('mssql');
require('dotenv').config();

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: process.env.NODE_ENV !== 'production'
    },
    pool: {
        max: 30,                       // match max concurrent VUs in load test
        min: 5,                        // keep 5 connections warm at all times
        acquireTimeoutMillis: 15000,   // wait up to 15s for a free connection
        idleTimeoutMillis:    30000,   // release idle connections after 30s
    },
    requestTimeout:    15000,          // query must complete within 15s
    connectionTimeout: 15000,          // connecting to DB must complete within 15s
};

const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // ms

// The live pool instance — replaced on every successful reconnect.
let pool = null;

async function connect(attempt = 1) {
    try {
        if (pool) {
            try { await pool.close(); } catch (_) {}
            pool = null;
        }

        pool = await mssql.connect(sqlConfig);

        pool.on('error', err => {
            console.error('[DB] Pool error — reconnecting:', err.message);
            pool = null;
            setTimeout(() => connect(1), RETRY_DELAY);
        });

        console.log('[DB] Connection pool ready.');

    } catch (err) {
        console.error(`[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);

        if (attempt >= MAX_RETRIES) {
            console.error('[DB] Max retries reached. Exiting.');
            process.exit(1);
        }

        await new Promise(r => setTimeout(r, RETRY_DELAY));
        return connect(attempt + 1);
    }
}

// Start connecting immediately; routes call db.request() inside async
// handlers so the pool will be ready before the first real request arrives.
const ready = connect();

// Exported object — all existing route code calls db.request() synchronously
// inside async functions. By the time a request arrives the pool is up.
// If for any reason the pool is null (mid-reconnect), request() throws a
// clear error instead of crashing with "cannot read property of undefined".
const db = {
    // Allow `await db` in the handful of places that use transaction pools:
    // `const pool = await db; const tx = pool.transaction()`
    then(resolve, reject) {
        return ready.then(() => resolve(pool), reject);
    },

    request() {
        if (!pool) throw new Error('[DB] Pool is not available — reconnect in progress.');
        return pool.request();
    },

    transaction() {
        if (!pool) throw new Error('[DB] Pool is not available — reconnect in progress.');
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
