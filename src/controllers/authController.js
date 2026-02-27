// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/database');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !user.is_active)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
    const token = signToken(user);
    res.json({
      success: true, token,
      user: { id:user.id, name:user.name, email:user.email, role:user.role, department:user.department },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords are required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
