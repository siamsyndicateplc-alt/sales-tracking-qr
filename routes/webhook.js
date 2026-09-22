const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.CATALOG_DB_HOST,
  port: process.env.CATALOG_DB_PORT || 5432,
  database: process.env.CATALOG_DB_NAME || 'catalog_db',
  user: process.env.CATALOG_DB_USER || 'postgres',
  password: process.env.CATALOG_DB_PASSWORD,
});

function extractField(payload, ...keys) {
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
      return String(payload[key]).trim();
    }
  }
  return null;
}

// POST /api/webhook/catalog
router.post('/catalog', async (req, res) => {
  try {
    const body = req.body?.data || req.body;
    console.log('[webhook/catalog] received:', JSON.stringify(body));

    const first_name   = extractField(body, 'first_name', 'firstName', 'first-name', 'fname');
    const last_name    = extractField(body, 'last_name', 'lastName', 'last-name', 'lname');
    const email        = extractField(body, 'email', 'Email', 'email_address');
    const phone        = extractField(body, 'phone', 'Phone', 'phone_number', 'tel');
    const pdpa_consent = !!(body.pdpa_consent || body.consent || body.pdpaConsent);
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

    const first_name   = extractField(body, 'first_name', 'firstName', 'fname');
    const last_name    = extractField(body, 'last_name', 'lastName', 'lname');
    const email        = extractField(body, 'email', 'Email', 'email_address');
    const phone        = extractField(body, 'phone', 'Phone', 'tel');
    const subject      = extractField(body, 'subject', 'Subject', 'topic');
    const message      = extractField(body, 'message', 'Message', 'detail', 'description');
    const pdpa_consent = !!(body.pdpa_consent || body.consent || body.pdpaConsent);
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
