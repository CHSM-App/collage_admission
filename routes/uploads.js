/**
 * uploads.js — Authenticated serving of uploaded student documents.
 *
 * Files live OUTSIDE the web root (BackEnd/uploads/), so they are never served
 * statically or executable. Every request is authenticated and ownership-checked,
 * the content type is forced from the stored extension, and MIME sniffing is
 * disabled so a file can never be interpreted as HTML/JS.
 *
 * URL shape (kept identical to the old static path so the frontend is unchanged):
 *   GET /uploads/students/:studentId/:filename
 */

const express = require('express')
const path    = require('path')
const fs      = require('fs')
const router  = express.Router()
const db      = require('./db')
const mssql   = require('mssql')
const logger  = require('../config/logger')
const { authenticate } = require('../middleware/auth')

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'students')

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf',
}

router.use(authenticate)

router.get('/students/:studentId/:filename', async (req, res) => {
  // Sanitize params — studentId is numeric, filename must be a plain basename.
  const studentId = String(req.params.studentId).replace(/[^0-9]/g, '')
  const filename  = path.basename(String(req.params.filename))  // strips any path components
  if (!studentId || !filename || filename.includes('..')) {
    return res.status(400).json({ success: false, message: 'Invalid file request.' })
  }

  const ext = path.extname(filename).toLowerCase()
  if (!EXT_TO_MIME[ext]) {
    return res.status(400).json({ success: false, message: 'Unsupported file type.' })
  }

  try {
    // Ownership: students may only fetch their own files; college/admin may fetch any.
    const u = req.user
    if (u.role === 'student' && String(u.id) !== studentId) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    // Confirm the file is actually a registered student document (not a guessed path).
    const relPath = `/uploads/students/${studentId}/${filename}`
    const docRes = await db.request()
      .input('fp', mssql.NVarChar, relPath)
      .query('SELECT TOP 1 id FROM student_documents WHERE file_path = @fp')
    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Not found.' })
    }

    const abs = path.join(UPLOAD_ROOT, studentId, filename)
    if (!abs.startsWith(path.resolve(UPLOAD_ROOT)) || !fs.existsSync(abs)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' })
    }

    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', EXT_TO_MIME[ext])
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    return res.sendFile(abs)
  } catch (err) {
    logger.error({ err }, 'upload serve error')
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
