var express = require('express');
var router = express.Router();
var db     = require('./db');
var mssql  = require('mssql');

const START_TIME = Date.now();

/* GET home page — API root. Returns JSON (no HTML view engine). */
router.get('/', function(req, res) {
  res.json({ success: true, service: 'College Admission API', status: 'ok' });
});

/* GET /health — uptime monitoring and load balancer probe */
router.get('/health', async function(req, res) {
  const uptimeMs = Date.now() - START_TIME;
  const uptimeSec = Math.floor(uptimeMs / 1000);

  let dbStatus = 'ok';
  let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    await db.request().query('SELECT 1 AS ping');
    dbLatencyMs = Date.now() - t0;
  } catch (e) {
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'ok';

  res.status(healthy ? 200 : 503).json({
    status:  healthy ? 'ok' : 'degraded',
    uptime:  { seconds: uptimeSec, human: formatUptime(uptimeSec) },
    database: { status: dbStatus, latency_ms: dbLatencyMs },
    timestamp: new Date().toISOString(),
  });
});

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

module.exports = router;
