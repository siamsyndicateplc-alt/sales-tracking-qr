// server.js
const express = require('express');
const path = require('path');
require('dotenv').config();
const rateLimit = require('express-rate-limit');

// Rate limiters configurations
const surveyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Increased to 60 to prevent blocking multiple clients on the same office/public Wi-Fi
    message: { error: 'คุณส่งคำขอถี่เกินไป กรุณาลองใหม่อีกครั้งในภายหลัง' },
    standardHeaders: true,
    legacyHeaders: false
});

const eventsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // Increased to 120 to support high concurrent scans
    message: { error: 'คุณส่งคำขอถี่เกินไป กรุณาลองใหม่อีกครั้งในภายหลัง' },
    standardHeaders: true,
    legacyHeaders: false
});

const configLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // Increased to 120 to support high concurrent config fetches
    message: { error: 'คุณส่งคำขอถี่เกินไป กรุณาลองใหม่อีกครั้งในภายหลัง' },
    standardHeaders: true,
    legacyHeaders: false
});

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel) to resolve correct client IP instead of Vercel router IP
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Protect dashboard.html
const basicAuth = require('express-basic-auth');
app.use('/dashboard.html', basicAuth({
    users: { [process.env.DASHBOARD_USER || 'admin']: process.env.DASHBOARD_PASS || 'sstadmin2026' },
    challenge: true,
    realm: 'SST Dashboard'
}));

// Serve Static Files
// Cache fonts for 1 year
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts'), {
    maxAge: '1y',
    immutable: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
const qrLogsRouter = require('./routes/qr-logs');
const surveyRouter = require('./routes/survey');
const reportsRouter = require('./routes/reports');
const eventsRouter = require('./routes/events');
const employeesRouter = require('./routes/employees');

app.use('/api/qr-logs', qrLogsRouter);
app.use('/api/survey', surveyLimiter, surveyRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/events', eventsLimiter, eventsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/config', configLimiter);

// Config Endpoints
app.get('/api/config/supabase-anon', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY
    });
});

// Config Endpoints

app.get('/api/config/qr-base', (req, res) => {
    if (process.env.QR_REDIRECT_BASE_URL) {
        return res.json({ baseUrl: process.env.QR_REDIRECT_BASE_URL });
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host');
    res.json({ baseUrl: `${protocol}://${host}/scan.html` });
});

// Fallback for non-existent public files or APIs
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), {}, (err) => {
            if (err) {
                res.status(404).send('<h1>404 - ไม่พบหน้าเว็บที่คุณต้องการ</h1>');
            }
        });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled System Error:', err);
    res.status(500).json({ 
        error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้งในภายหลัง' 
    });
});

// Export the app for Vercel Serverless
module.exports = app;

// Only listen locally if run directly
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Sales Tracking Server is running on port ${PORT}`);
        console.log(`🌍 URL: http://localhost:${PORT}/`);
        console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}
