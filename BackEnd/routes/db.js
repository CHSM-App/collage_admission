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
        trustServerCertificate: true
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

// Create a connection pool *once*, and reuse it everywhere
const db = mssql.connect(sqlConfig, function (err) {
    if (err)
        console.log(err);
    else
        console.log("Connection Successful")
});

module.exports = db;
