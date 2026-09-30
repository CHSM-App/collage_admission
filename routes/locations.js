/**
 * locations.js — India location master (LGD): State → District → Taluka
 * Mounted at /api — public (used by registration and address forms).
 *
 * IDs are LGD codes, so they are stable and shareable across applications.
 *
 * Routes:
 *   GET /api/states
 *   GET /api/states/:stateId/districts
 *   GET /api/districts/:districtId/talukas
 */

const express = require('express')
const router  = express.Router()
const db      = require('./db')
const mssql   = require('mssql')
const logger  = require('../config/logger')
const { publicLimiter } = require('../middleware/rateLimits')

// Master data changes a few times a year — let browsers/CDNs cache for a day
function cached(res) { res.set('Cache-Control', 'public, max-age=86400') }

// Resolve :param to a positive int or answer 400
function idParam(req, res, name) {
  const id = Number(req.params[name])
  if (Number.isInteger(id) && id > 0) return id
  res.status(400).json({ success: false, message: `Invalid ${name}` })
  return null
}

// GET /api/states
router.get('/states', publicLimiter, async (req, res) => {
  try {
    const r = await db.request().query(`
      SELECT id, name, name_local FROM state_master WHERE is_active = 1 ORDER BY name`)
    cached(res)
    res.json({ success: true, data: r.recordset })
  } catch (e) { logger.error({ err: e }, 'get states'); res.status(500).json({ success: false, message: e.message }) }
})

// GET /api/states/:stateId/districts
router.get('/states/:stateId/districts', publicLimiter, async (req, res) => {
  const stateId = idParam(req, res, 'stateId'); if (!stateId) return
  try {
    const r = await db.request()
      .input('sid', mssql.Int, stateId)
      .query(`
        SELECT id, state_id, name, name_local FROM district_master
        WHERE state_id = @sid AND is_active = 1 ORDER BY name`)
    cached(res)
    res.json({ success: true, data: r.recordset })
  } catch (e) { logger.error({ err: e }, 'get districts'); res.status(500).json({ success: false, message: e.message }) }
})

// GET /api/districts/:districtId/talukas
router.get('/districts/:districtId/talukas', publicLimiter, async (req, res) => {
  const districtId = idParam(req, res, 'districtId'); if (!districtId) return
  try {
    const r = await db.request()
      .input('did', mssql.Int, districtId)
      .query(`
        SELECT id, district_id, name, name_local FROM taluka_master
        WHERE district_id = @did AND is_active = 1 ORDER BY name`)
    cached(res)
    res.json({ success: true, data: r.recordset })
  } catch (e) { logger.error({ err: e }, 'get talukas'); res.status(500).json({ success: false, message: e.message }) }
})

module.exports = router
