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

const express   = require('express')
const multer    = require('multer')
const path      = require('path')
const fs        = require('fs')
const router    = express.Router()
const db        = require('./db')
const mssql     = require('mssql')
const { authenticate } = require('../middleware/auth')
const logger    = require('../config/logger')
// file-type v22 is ESM-only; load it lazily via dynamic import from CommonJS.
const fileTypeFromBuffer = async (buf) => (await import('file-type')).fileTypeFromBuffer(buf)

// All document routes require authentication
router.use(authenticate)

// ── Upload storage ───────────────────────────────────────────
// Stored OUTSIDE the web root (not under public/) so uploads are never served
// statically or executed. Files are streamed back through an authenticated
// route (see routes/uploads.js) with nosniff + inline disposition.
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'students')
const crypto = require('crypto')

// Extension is decided from the detected content type after upload, not from
// the client-supplied filename. Map the trusted mime -> safe extension.
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf',
}

// Resolve a stored file_path (e.g. "/uploads/students/12/abc.png") to an
// absolute path under UPLOAD_ROOT, guarding against path traversal.
function resolveUploadPath(filePath) {
  const rel = String(filePath || '').replace(/^\/?uploads\/students\/?/, '')
  const abs = path.join(UPLOAD_ROOT, rel)
  // Ensure the resolved path stays inside UPLOAD_ROOT
  if (!abs.startsWith(path.resolve(UPLOAD_ROOT))) return null
  return abs
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // req.body is not yet parsed when multer runs destination, so use query param.
    // Sanitize to digits only — student_id is numeric; this blocks path traversal.
    const studentId = String(req.query.student_id || 'unknown').replace(/[^0-9]/g, '') || 'unknown'
    const dir = path.join(UPLOAD_ROOT, studentId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    // Random, non-guessable name with NO user-controlled extension. The real
    // extension is appended after magic-byte validation confirms the type.
    cb(null, `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`)
  },
})

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE_MB  = 5
const ALLOWED_TYPES_MESSAGE = 'Only JPG, PNG, WEBP, and PDF files are allowed.'

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error(ALLOWED_TYPES_MESSAGE))
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
    logger.error({ err })
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
        WITH ranked AS (
          SELECT sd.id, sd.document_type_id, sd.file_name, sd.file_path, sd.uploaded_at,
                 ROW_NUMBER() OVER (PARTITION BY sd.document_type_id ORDER BY sd.uploaded_at DESC) AS rn
          FROM student_documents sd
          WHERE sd.student_id = @sid
        )
        SELECT r.id, r.document_type_id, r.file_name, r.file_path, r.uploaded_at,
               dt.name AS document_name
        FROM ranked r
        JOIN document_types dt ON dt.id = r.document_type_id
        WHERE r.rn = 1
        ORDER BY dt.name
      `)
    return res.json({ success: true, data: result.recordset })
  } catch (err) {
    logger.error({ err })
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// Magic-bytes → allowed MIME types map
const MAGIC_MIME_WHITELIST = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

async function validateMagicBytes(filePath) {
  // Read first 4 KB — enough for all supported formats
  const fd  = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(4096)
  const bytesRead = fs.readSync(fd, buf, 0, 4096, 0)
  fs.closeSync(fd)
  const result = await fileTypeFromBuffer(buf.slice(0, bytesRead))
  return result ? result.mime : null
}

// ── POST /student-documents (multipart) ─────────────────────
router.post('/student-documents', upload.single('file'), async (req, res) => {
  const student_id = req.query.student_id || req.body.student_id
  const { document_type_id } = req.body

  if (!student_id || !document_type_id) {
    if (req.file) fs.unlink(req.file.path, () => {})
    return res.status(400).json({ success: false, message: 'student_id and document_type_id are required.' })
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' })
  }

  // Validate actual file content — reject files where magic bytes don't match allowed types
  const detectedMime = await validateMagicBytes(req.file.path)
  if (!detectedMime || !MAGIC_MIME_WHITELIST.has(detectedMime)) {
    fs.unlink(req.file.path, () => {})
    return res.status(400).json({ success: false, message: 'Invalid file type. Only JPG, PNG, WEBP, and PDF files are allowed.' })
  }

  // Append the extension derived from the DETECTED type (not the client name),
  // then rename the stored file to match.
  const safeExt   = MIME_TO_EXT[detectedMime]
  const finalName = `${req.file.filename}${safeExt}`
  try {
    fs.renameSync(req.file.path, path.join(path.dirname(req.file.path), finalName))
  } catch (e) {
    fs.unlink(req.file.path, () => {})
    logger.error({ err: e }, 'failed to finalize upload')
    return res.status(500).json({ success: false, message: 'Server error.' })
  }

  const sanitizedStudentId = String(student_id).replace(/[^0-9]/g, '')
  const relativePath = `/uploads/students/${sanitizedStudentId}/${finalName}`

  try {
    // Always insert a new row — each upload creates its own student_document record.
    // This allows different applications to reference different versions of the same doc type.
    const ins = await db.request()
      .input('sid',   mssql.Int,      parseInt(student_id))
      .input('dtid',  mssql.Int,      parseInt(document_type_id))
      .input('fn',    mssql.NVarChar, req.file.originalname)
      .input('fp',    mssql.NVarChar, relativePath)
      .input('actor', mssql.NVarChar, String(req.user.staff_id || req.user.id))
      .query(`
        INSERT INTO student_documents (student_id, document_type_id, file_name, file_path, created_by)
        OUTPUT INSERTED.id VALUES (@sid, @dtid, @fn, @fp, @actor)
      `)

    const newId = ins.recordset[0].id
    return res.json({ success: true, message: 'Document uploaded.', data: { id: newId, file_path: relativePath, file_name: req.file.originalname } })
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {})
    logger.error({ err })
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
    const filePath = resolveUploadPath(docRes.recordset[0].file_path)
    if (filePath && fs.existsSync(filePath)) fs.unlink(filePath, () => {})

    await db.request()
      .input('id', mssql.Int, docId)
      .query('DELETE FROM student_documents WHERE id=@id')

    return res.json({ success: true, message: 'Document deleted.' })
  } catch (err) {
    logger.error({ err })
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── GET /student-documents/:id/file ─────────────────────────
// Serves the actual file. Caller must own the document (student)
// or be a college/admin user (for application review).
router.get('/student-documents/:id/file', async (req, res) => {
  const docId = parseInt(req.params.id)
  try {
    const docRes = await db.request()
      .input('id', mssql.Int, docId)
      .query('SELECT file_path, file_name, student_id FROM student_documents WHERE id=@id')

    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Not found.' })
    }

    const { file_path, file_name, student_id } = docRes.recordset[0]
    const u = req.user

    // Ownership check: student can only fetch their own docs;
    // college and admin users can fetch any (for application review)
    if (u.role === 'student' && u.id !== student_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const absPath = resolveUploadPath(file_path)

    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' })
    }

    // Force a trusted content type from the stored extension and prevent MIME
    // sniffing, so a file can never be interpreted as HTML/JS by the browser.
    const ext  = path.extname(absPath).toLowerCase()
    const mime = EXT_TO_MIME[ext] || 'application/octet-stream'
    const safeName = String(file_name || 'file').replace(/[\r\n"]/g, '')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
    return res.sendFile(absPath)
  } catch (err) {
    logger.error({ err })
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
    logger.error({ err })
    return res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ── Multer error handler ─────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer's own messages are safe (e.g. file too large); map the common one.
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large. Maximum size is ${MAX_SIZE_MB} MB.`
      : 'File upload failed. Please check the file and try again.'
    return res.status(400).json({ success: false, message: msg })
  }
  if (err && err.message === ALLOWED_TYPES_MESSAGE) {
    // Our own fileFilter rejection — safe, user-facing message.
    return res.status(400).json({ success: false, message: err.message })
  }
  if (err) {
    logger.error({ err }, 'document upload error')
    return res.status(400).json({ success: false, message: 'File upload failed. Please try again.' })
  }
  next(err)
})

module.exports = router
