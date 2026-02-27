// src/routes/index.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const auth   = require('../controllers/authController');
const assets = require('../controllers/assetController');
const bom    = require('../controllers/bomController');
const email  = require('../controllers/emailController');
const notif  = require('../controllers/notificationController');
const res_   = require('../controllers/resourceControllers');

// ── AUTH ─────────────────────────────────────────────────────
router.post('/auth/login',           auth.login);
router.get ('/auth/me',              authenticate, auth.me);
router.post('/auth/change-password', authenticate, auth.changePassword);

// ── ASSETS ───────────────────────────────────────────────────
router.get   ('/assets/stats/summary', authenticate, assets.summary);
router.get   ('/assets/export/excel',  authenticate, assets.exportExcel);
router.post  ('/assets/import/excel',  authenticate, authorize('admin','manager','editor'), upload.single('file'), assets.importExcel);
router.get   ('/assets',               authenticate, assets.getAll);
router.get   ('/assets/:id',           authenticate, assets.getOne);
router.post  ('/assets',               authenticate, authorize('admin','manager','editor'), assets.create);
router.put   ('/assets/:id',           authenticate, authorize('admin','manager','editor'), assets.update);
router.delete('/assets/:id',           authenticate, authorize('admin','manager'), assets.remove);

// ── BOM ──────────────────────────────────────────────────────
router.get   ('/bom/export/excel', authenticate, bom.exportExcel);
router.get   ('/bom',              authenticate, bom.getAll);
router.get   ('/bom/:id',          authenticate, bom.getOne);
router.post  ('/bom',              authenticate, authorize('admin','manager','editor'), bom.create);
router.put   ('/bom/:id',          authenticate, authorize('admin','manager','editor'), bom.update);
router.delete('/bom/:id',          authenticate, authorize('admin','manager'), bom.remove);

// ── COMPANIES ────────────────────────────────────────────────
router.get   ('/companies',     authenticate, res_.getCompanies);
router.post  ('/companies',     authenticate, authorize('admin','manager'), res_.createCompany);
router.put   ('/companies/:id', authenticate, authorize('admin','manager'), res_.updateCompany);

// ── RIGS ─────────────────────────────────────────────────────
router.get   ('/rigs',     authenticate, res_.getRigs);
router.post  ('/rigs',     authenticate, authorize('admin','manager'), res_.createRig);
router.put   ('/rigs/:id', authenticate, authorize('admin','manager'), res_.updateRig);

// ── CONTRACTS ────────────────────────────────────────────────
router.get   ('/contracts',     authenticate, res_.getContracts);
router.post  ('/contracts',     authenticate, authorize('admin','manager'), res_.createContract);
router.put   ('/contracts/:id', authenticate, authorize('admin','manager','editor'), res_.updateContract);
router.delete('/contracts/:id', authenticate, authorize('admin'), res_.deleteContract);

// ── USERS ────────────────────────────────────────────────────
router.get   ('/users',     authenticate, authorize('admin','manager'), res_.getUsers);
router.post  ('/users',     authenticate, authorize('admin'), res_.createUser);
router.put   ('/users/:id', authenticate, authorize('admin'), res_.updateUser);
router.delete('/users/:id', authenticate, authorize('admin'), res_.deleteUser);

// ── NOTIFICATIONS ────────────────────────────────────────────
router.get   ('/notifications',          authenticate, notif.getAll);
router.patch ('/notifications/read-all', authenticate, notif.markAllRead);
router.patch ('/notifications/:id/read', authenticate, notif.markRead);
router.delete('/notifications/:id',      authenticate, notif.remove);

// ── EMAIL ────────────────────────────────────────────────────
router.post('/email/send', authenticate, email.sendAlert);
router.get ('/email/logs', authenticate, authorize('admin','manager'), email.getLogs);

module.exports = router;
