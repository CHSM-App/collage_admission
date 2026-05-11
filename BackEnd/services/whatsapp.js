/**
 * SMSala WhatsApp Messaging Service
 * Docs: https://api2.smsala.com
 *
 * Sends transactional WhatsApp messages to students on application status changes.
 * Set WHATSAPP_ENABLED=true in .env to activate. Failures are logged but never
 * throw — they must not break the main request flow.
 *
 * All sends (sent / failed / skipped) are recorded in whatsapp_message_log.
 */

const https  = require('https')
const mssql  = require('mssql')
const db     = require('../routes/db')

const API_TOKEN    = process.env.WHATSAPP_API_TOKEN || ''
const ENABLED      = process.env.WHATSAPP_ENABLED === 'true'
const OTP_TEMPLATE = process.env.WHATSAPP_TPL_OTP

// Template ID map — keys match logActivity action names used in college_admin.js
const TEMPLATES = {
  correction_requested: process.env.WHATSAPP_TPL_CORRECTION_REQUESTED,
  accepted:             process.env.WHATSAPP_TPL_APPLICATION_ACCEPTED,
  rejected:             process.env.WHATSAPP_TPL_APPLICATION_REJECTED,
  confirmed:            process.env.WHATSAPP_TPL_ADMISSION_CONFIRMED,
  fees_paid:            process.env.WHATSAPP_TPL_FEES_PAID,
  roll_assigned:        process.env.WHATSAPP_TPL_ROLL_ASSIGNED,
}

// ─────────────────────────────────────────────────────────────────────────────
// DB logging helper
// ─────────────────────────────────────────────────────────────────────────────

async function logToDb({ phone, campaignName, templateId, sample, status, campaignId, errorDetail, applicationId }) {
  try {
    await db.request()
      .input('phone',         mssql.NVarChar, phone         || null)
      .input('campaignName',  mssql.NVarChar, campaignName  || null)
      .input('templateId',    mssql.NVarChar, templateId    ? String(templateId) : null)
      .input('sample',        mssql.NVarChar, sample        || null)
      .input('status',        mssql.NVarChar, status        || 'sent')
      .input('campaignId',    mssql.NVarChar, campaignId    ? String(campaignId) : null)
      .input('errorDetail',   mssql.NVarChar, errorDetail   || null)
      .input('applicationId', mssql.Int,      applicationId || null)
      .query(`
        INSERT INTO whatsapp_message_log
          (phone, campaign_name, template_id, sample, status, campaign_id, error_detail, application_id)
        VALUES
          (@phone, @campaignName, @templateId, @sample, @status, @campaignId, @errorDetail, @applicationId)
      `)
  } catch (e) {
    // Never let logging failure break anything
    console.warn('[WhatsApp] DB log failed:', e.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

function postForm(path, body) {
  return new Promise((resolve, reject) => {
    const payload = Object.entries(body)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    const options = {
      hostname: 'api2.smsala.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const options = {
      hostname: 'api2.smsala.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP send (always fires regardless of ENABLED flag)
// ─────────────────────────────────────────────────────────────────────────────

async function sendOtp(phone, otpCode) {
  if (!API_TOKEN || API_TOKEN.startsWith('REPLACE')) {
    throw new Error('WhatsApp API token not configured.')
  }
  const normPhone = normalisePhone(phone)
  if (!normPhone) throw new Error('Invalid phone number.')

  let result
  try {
    result = await postJson('/whatsapp/SendOtp', {
      PhoneNumber: normPhone,
      OtpCode:     String(otpCode),
      ApiToken:    API_TOKEN,
      TemplateId:  OTP_TEMPLATE || undefined,
    })
  } catch (err) {
    await logToDb({ phone: normPhone, campaignName: 'otp', templateId: OTP_TEMPLATE, status: 'failed', errorDetail: err.message })
    throw err
  }

  const success = result.IsSuccess || result.ErrorCode === 0
  await logToDb({
    phone:        normPhone,
    campaignName: 'otp',
    templateId:   OTP_TEMPLATE,
    status:       success ? 'sent' : 'failed',
    campaignId:   result.ReturnData,
    errorDetail:  success ? null : (result.ErrorDescription || JSON.stringify(result)),
  })

  if (!success) {
    throw new Error(result.ErrorDescription || 'OTP send failed.')
  }
  console.log(`[WhatsApp] OTP sent to ${normPhone} — CampaignId: ${result.ReturnData}`)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Template message send
// ─────────────────────────────────────────────────────────────────────────────

async function sendTemplateMessage(phone, templateId, sample, campaignName, applicationId) {
  if (!ENABLED) {
    console.log(`[WhatsApp] Disabled — would have sent "${campaignName}" to ${phone} (template: ${templateId})`)
    await logToDb({ phone, campaignName, templateId, sample, status: 'skipped', applicationId })
    return null
  }
  if (!API_TOKEN || API_TOKEN.startsWith('REPLACE')) {
    console.warn('[WhatsApp] API token not configured — skipping send.')
    await logToDb({ phone, campaignName, templateId, sample, status: 'skipped', errorDetail: 'API token not configured', applicationId })
    return null
  }
  if (!templateId || String(templateId).startsWith('REPLACE')) {
    console.warn(`[WhatsApp] Template ID not configured for campaign "${campaignName}" — skipping.`)
    await logToDb({ phone, campaignName, templateId, sample, status: 'skipped', errorDetail: 'Template ID not configured', applicationId })
    return null
  }

  let result
  try {
    result = await postForm('/whatsapp/SendMessage', {
      ApiToken:     API_TOKEN,
      TemplateId:   templateId,
      QuickNumber:  phone,
      Sample:       sample || '',
      CampaignName: campaignName || 'admission_portal',
    })
  } catch (err) {
    console.error(`[WhatsApp] Network error for "${campaignName}":`, err.message)
    await logToDb({ phone, campaignName, templateId, sample, status: 'failed', errorDetail: err.message, applicationId })
    return null
  }

  const success = result.IsSuccess || result.ErrorCode === 40
  await logToDb({
    phone,
    campaignName,
    templateId,
    sample,
    status:      success ? 'sent' : 'failed',
    campaignId:  result.ReturnData,
    errorDetail: success ? null : (result.ErrorDescription || JSON.stringify(result)),
    applicationId,
  })

  if (success) {
    console.log(`[WhatsApp] Sent "${campaignName}" to ${phone} — CampaignId: ${result.ReturnData}`)
  } else {
    console.warn(`[WhatsApp] Send failed for "${campaignName}":`, result)
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone normaliser
// ─────────────────────────────────────────────────────────────────────────────

function normalisePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits
}

// ─────────────────────────────────────────────────────────────────────────────
// Public notification helpers — one per application event
// Each accepts a student object { name, phone, course_name } and optional applicationId.
// ─────────────────────────────────────────────────────────────────────────────

async function notifyCorrectionRequested(student, applicationId) {
  const phone = normalisePhone(student.phone)
  if (!phone) return
  return sendTemplateMessage(phone, TEMPLATES.correction_requested, `${student.name},${student.course_name}`, 'correction_requested', applicationId)
}

async function notifyApplicationAccepted(student, applicationId) {
  const phone = normalisePhone(student.phone)
  if (!phone) return
  return sendTemplateMessage(phone, TEMPLATES.accepted, `${student.name},${student.course_name}`, 'application_accepted', applicationId)
}

async function notifyApplicationRejected(student, applicationId) {
  const phone = normalisePhone(student.phone)
  if (!phone) return
  return sendTemplateMessage(phone, TEMPLATES.rejected, `${student.name},${student.course_name}`, 'application_rejected', applicationId)
}

async function notifyAdmissionConfirmed(student, payNowAmount, applicationId) {
  const phone = normalisePhone(student.phone)
  if (!phone) return
  return sendTemplateMessage(phone, TEMPLATES.confirmed, `${student.name},${student.course_name},₹${Number(payNowAmount).toLocaleString('en-IN')}`, 'admission_confirmed', applicationId)
}

async function notifyFeesPaid(student, amountPaid, applicationId) {
  const phone = normalisePhone(student.phone)
  if (!phone) return
  return sendTemplateMessage(phone, TEMPLATES.fees_paid, `${student.name},₹${Number(amountPaid).toLocaleString('en-IN')}`, 'fees_paid', applicationId)
}

async function notifyRollAssigned(student, rollNumber, applicationId) {
  const phone = normalisePhone(student.phone)
  if (!phone) return
  return sendTemplateMessage(phone, TEMPLATES.roll_assigned, `${student.name},${rollNumber}`, 'roll_assigned', applicationId)
}

module.exports = {
  sendOtp,
  normalisePhone,
  notifyCorrectionRequested,
  notifyApplicationAccepted,
  notifyApplicationRejected,
  notifyAdmissionConfirmed,
  notifyFeesPaid,
  notifyRollAssigned,
}
