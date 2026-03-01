// src/server.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const routes    = require('./routes/index');

const app = express();

// ── SECURITY ─────────────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,   // must be false when origin is '*'
}));
// Handle preflight for all routes
app.options('*', cors());

// ── RATE LIMITING ────────────────────────────────────────────
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success:false, message:'Too many login attempts. Try again in 15 minutes.' },
}));
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { success:false, message:'Rate limit exceeded.' },
}));

// ── BODY PARSERS ─────────────────────────────────────────────
app.use(express.json({ limit:'5mb' }));
app.use(express.urlencoded({ extended:true }));

// ── STATIC UPLOADS ───────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── ROOT ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'SAP Asset Management API',
    status:  'running',
    version: '1.0.0',
    endpoints: {
      health:    '/health',
      auth:      '/api/auth/login',
      assets:    '/api/assets',
      bom:       '/api/bom',
      contracts: '/api/contracts',
      rigs:      '/api/rigs',
      companies: '/api/companies',
      users:     '/api/users',
      aiChat:    '/api/ai/chat',
    }
  });
});

// ── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:      'ok',
    service:     'SAP Asset Management API',
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── API ROUTES ───────────────────────────────────────────────
app.use('/api', routes);

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success:false, message:`Route ${req.method} ${req.path} not found.` });
});

// ── GLOBAL ERROR HANDLER ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.code==='LIMIT_FILE_SIZE')
    return res.status(400).json({ success:false, message:'File size exceeds limit.' });
  res.status(500).json({ success:false, message:err.message || 'Internal server error.' });
});

// ── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  SAP Asset Management API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
