const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.CATALOG_DB_HOST,
  port: process.env.CATALOG_DB_PORT || 5432,
  database: process.env.CATALOG_DB_NAME || 'catalog_db',
  user: process.env.CATALOG_DB_USER || 'postgres',
  password: process.env.CATALOG_DB_PASSWORD,
  ssl: false,
});

function extractField(payload, ...keys) {
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
      return String(payload[key]).trim();
    }
  }
  return null;
}

function extractWixSubmissions(payload) {
  const result = {};
  const submissions = payload.submissions || payload.data?.submissions;
  if (!Array.isArray(submissions)) return result;
  for (const item of submissions) {
    const label = (item.label || '').toLowerCase();
    const value = item.value;
    if (label.includes('ชื่อ') && !label.includes('นามสกุล')) result.first_name = value;
    else if (label.includes('นามสกุล')) result.last_name = value;
    else if (label.includes('email') || label.includes('อีเมล')) result.email = value;
    else if (label.includes('เบอร์') || label.includes('โทร') || label.includes('phone')) result.phone = value;
    else if (label.includes('บริษัท') || label.includes('company')) result.company = value;
    else if (label.includes('เรื่อง') || label.includes('subject')) result.subject = value;
    else if (label.includes('ข้อความ') || label.includes('message') || label.includes('รายละเอียด')) result.message = value;
    else if (label.includes('ยอมรับ') || label.includes('consent') || label.includes('pdpa')) result.pdpa_consent = !!(value === 'ทำเครื่องหมายไว้' || value === true || value === 'true');
  }
  // fallback from contact object
  if (!result.first_name && payload.contact?.name?.first) result.first_name = payload.contact.name.first;
  if (!result.last_name && payload.contact?.name?.last) result.last_name = payload.contact.name.last;
  if (!result.email && payload.contact?.email) result.email = payload.contact.email;
  if (!result.phone && payload.contact?.phone) result.phone = payload.contact.phone;
  return result;
}

// POST /api/webhook/catalog
router.post('/catalog', async (req, res) => {
  try {
    const body = req.body?.data || req.body;
    console.log('[webhook/catalog] received:', JSON.stringify(body));

    const wix = extractWixSubmissions(body);
    const first_name   = wix.first_name || extractField(body, 'first_name', 'firstName', 'fname');
    const last_name    = wix.last_name  || extractField(body, 'last_name', 'lastName', 'lname');
    const email        = wix.email      || extractField(body, 'email', 'Email');
    const phone        = wix.phone      || extractField(body, 'phone', 'Phone');
    const pdpa_consent = !!(wix.pdpa_consent || body.pdpa_consent || body.consent);
    const consent_at   = pdpa_consent ? new Date() : null;
    const source_form  = extractField(body, 'formName', 'form_name', 'formId') || 'catalog';

    await pool.query(
      `INSERT INTO catalog_requests
        (first_name, last_name, email, phone, pdpa_consent, consent_at, source_form, raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [first_name, last_name, email, phone, pdpa_consent, consent_at, source_form, body]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[webhook/catalog] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhook/contact
router.post('/contact', async (req, res) => {
  try {
    const body = req.body?.data || req.body;
    console.log('[webhook/contact] received:', JSON.stringify(body));

    const wix = extractWixSubmissions(body);
    const first_name   = wix.first_name || extractField(body, 'first_name', 'firstName', 'fname');
    const last_name    = wix.last_name  || extractField(body, 'last_name', 'lastName', 'lname');
    const email        = wix.email      || extractField(body, 'email', 'Email');
    const phone        = wix.phone      || extractField(body, 'phone', 'Phone');
    const subject      = wix.subject    || extractField(body, 'subject', 'Subject', 'topic');
    const message      = wix.message    || extractField(body, 'message', 'Message', 'detail');
    const pdpa_consent = !!(wix.pdpa_consent || body.pdpa_consent || body.consent);
    const consent_at   = pdpa_consent ? new Date() : null;
    const source_form  = extractField(body, 'formName', 'form_name', 'formId') || 'contact';

    await pool.query(
      `INSERT INTO contact_requests
        (first_name, last_name, email, phone, subject, message, pdpa_consent, consent_at, source_form, raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [first_name, last_name, email, phone, subject, message, pdpa_consent, consent_at, source_form, body]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[webhook/contact] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
