/**
 * documents.js
 *
 * GET    /document-types                           — list all document types
 * GET    /student-documents?student_id=            — list student's uploaded docs
 * POST   /student-documents                        — upload/replace a document (multipart/form-data)
 * DELETE /student-documents/:id                    — delete if not locked by active application
 * GET    /student-documents/:id/file               — serve the actual file
 * GET    /application-documents/:applicationId     — list docs for a specific application (college view)
 */

const express = require('express')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const router  = express.Router()
const db      = require('./db')
const mssql   = require('mssql')
const { authenticate } = require('../middleware/auth')

// All document routes require authentication
router.use(authenticate)

// ── Upload storage ───────────────────────────────────────────
const UPLOAD_ROOT = path.join(__dirname, '..', 'public', 'uploads', 'students')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // req.body is not yet parsed when multer runs destination, so use query param
    const studentId = req.query.student_id || 'unknown'
    const dir = path.join(UPLOAD_ROOT, String(studentId))
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_\-]/gi, '_').substring(0, 40)
    const name = `${base}_${Date.now()}${ext}`
    cb(null, name)
  },
})

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE_MB  = 5

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed.'))
    }
    cb(null, true)
  },
})

// ── Helper: check if a student_document is locked ───────────
// A document is locked if it is referenced in any application that is
// NOT rejected or cancelled.
async function isDocumentLocked(studentDocId) {
  const r = await db.request()
    .input('sdId', mssql.Int, studentDocId)
    .query(`
      SELECT TOP 1 a.status
      FROM application_documents ad
      JOIN applications a ON a.id = ad.application_id
      WHERE ad.student_document_id = @sdId
        AND a.status NOT IN ('rejected', 'cancelled')
    `)
  return r.recordset.length > 0 ? r.recordset[0].status : null
}

// ── GET /document-types ──────────────────────────────────────
router.get('/document-types', async (req, res) => {
  try {
    const result = await db.request()
      .query('SELECT id, name, description FROM document_types ORDER BY name')
    return res.json({ success: true, data: result.recordset })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── GET /student-documents?student_id= ──────────────────────
router.get('/student-documents', async (req, res) => {
  const { student_id } = req.query
  if (!student_id) return res.status(400).json({ success: false, message: 'student_id required.' })

  try {
    const result = await db.request()
      .input('sid', mssql.Int, parseInt(student_id))
      .query(`
        SELECT sd.id, sd.document_type_id, sd.file_name, sd.file_path, sd.uploaded_at,
               dt.name AS document_name,
               -- is_locked: used in at least one non-rejected/cancelled application
               CASE WHEN EXISTS (
                 SELECT 1 FROM application_documents ad
                 JOIN applications a ON a.id = ad.application_id
                 WHERE ad.student_document_id = sd.id
                   AND a.status NOT IN ('rejected','cancelled')
               ) THEN 1 ELSE 0 END AS is_locked
        FROM student_documents sd
        JOIN document_types dt ON dt.id = sd.document_type_id
        WHERE sd.student_id = @sid
        ORDER BY dt.name
      `)
    return res.json({ success: true, data: result.recordset })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── POST /student-documents (multipart) ─────────────────────
router.post('/student-documents', upload.single('file'), async (req, res) => {
  const student_id = req.query.student_id || req.body.student_id
  const { document_type_id } = req.body

  if (!student_id || !document_type_id) {
    // Clean up uploaded file if validation fails
    if (req.file) fs.unlink(req.file.path, () => {})
    return res.status(400).json({ success: false, message: 'student_id and document_type_id are required.' })
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' })
  }

  const relativePath = `/uploads/students/${student_id}/${req.file.filename}`

  try {
    const existing = await db.request()
      .input('sid',  mssql.Int, parseInt(student_id))
      .input('dtid', mssql.Int, parseInt(document_type_id))
      .query('SELECT id, file_path FROM student_documents WHERE student_id=@sid AND document_type_id=@dtid')

    if (existing.recordset.length > 0) {
      const existingDoc = existing.recordset[0]

      // Block replacement if locked
      const lockedStatus = await isDocumentLocked(existingDoc.id)
      if (lockedStatus) {
        fs.unlink(req.file.path, () => {})
        return res.status(400).json({
          success: false,
          message: `This document is used in an active application (status: ${lockedStatus}). It cannot be replaced until the application is rejected or cancelled.`,
        })
      }

      // Delete old file from disk
      const oldPath = path.join(__dirname, '..', 'public', existingDoc.file_path)
      if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {})

      await db.request()
        .input('id', mssql.Int, existingDoc.id)
        .input('fn', mssql.NVarChar, req.file.originalname)
        .input('fp', mssql.NVarChar, relativePath)
        .query('UPDATE student_documents SET file_name=@fn, file_path=@fp, uploaded_at=GETDATE() WHERE id=@id')

      return res.json({ success: true, message: 'Document updated.', data: { file_path: relativePath, file_name: req.file.originalname } })
    } else {
      await db.request()
        .input('sid',  mssql.Int, parseInt(student_id))
        .input('dtid', mssql.Int, parseInt(document_type_id))
        .input('fn',   mssql.NVarChar, req.file.originalname)
        .input('fp',   mssql.NVarChar, relativePath)
        .query(`
          INSERT INTO student_documents (student_id, document_type_id, file_name, file_path)
          VALUES (@sid, @dtid, @fn, @fp)
        `)

      return res.json({ success: true, message: 'Document uploaded.', data: { file_path: relativePath, file_name: req.file.originalname } })
    }
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {})
    console.error(err)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── DELETE /student-documents/:id ───────────────────────────
router.delete('/student-documents/:id', async (req, res) => {
  const docId = parseInt(req.params.id)

  try {
    const docRes = await db.request()
      .input('id', mssql.Int, docId)
      .query('SELECT id, file_path FROM student_documents WHERE id=@id')

    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Document not found.' })
    }

    const lockedStatus = await isDocumentLocked(docId)
    if (lockedStatus) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this document is used in an active application (status: ${lockedStatus}). It can only be removed after the application is rejected or cancelled.`,
      })
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '..', 'public', docRes.recordset[0].file_path)
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {})

    await db.request()
      .input('id', mssql.Int, docId)
      .query('DELETE FROM student_documents WHERE id=@id')

    return res.json({ success: true, message: 'Document deleted.' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── GET /student-documents/:id/file ─────────────────────────
// Serves the actual file. In production add auth check here.
router.get('/student-documents/:id/file', async (req, res) => {
  const docId = parseInt(req.params.id)
  try {
    const docRes = await db.request()
      .input('id', mssql.Int, docId)
      .query('SELECT file_path, file_name FROM student_documents WHERE id=@id')

    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Not found.' })
    }

    const { file_path, file_name } = docRes.recordset[0]
    const absPath = path.join(__dirname, '..', 'public', file_path)

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' })
    }

    res.setHeader('Content-Disposition', `inline; filename="${file_name}"`)
    return res.sendFile(absPath)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── GET /application-documents/:applicationId ────────────────
// College view: all docs linked to an application
router.get('/application-documents/:applicationId', async (req, res) => {
  const appId = parseInt(req.params.applicationId)
  try {
    const result = await db.request()
      .input('appId', mssql.Int, appId)
      .query(`
        SELECT ad.id, ad.is_verified, ad.verified_at,
               dt.name AS document_name,
               sd.id   AS student_document_id,
               sd.file_name, sd.file_path, sd.uploaded_at
        FROM application_documents ad
        JOIN student_documents sd ON sd.id = ad.student_document_id
        JOIN document_types    dt ON dt.id = ad.document_type_id
        WHERE ad.application_id = @appId
        ORDER BY dt.name
      `)
    return res.json({ success: true, data: result.recordset })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── Multer error handler ─────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ success: false, message: err.message })
  }
  next(err)
})

module.exports = router
