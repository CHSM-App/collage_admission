const mssql = require('mssql');
require('dotenv').config();

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    // Replace with your database
    options: {
        encrypt: true, // Use this if you're on Windows Azure
        trustServerCertificate: true // Change to true for local dev / self-signed certs
    }
};
// Create a connection pool *once*, and reuse it everywhere
const db = mssql.connect(sqlConfig, function (err) {
    if (err)
        console.log(err);
    else
        console.log("Connection Successful")


});
module.exports = db;