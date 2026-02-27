// src/middleware/auth.js
const jwt  = require('jsonwebtoken');
const pool = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided.' });

    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT id,name,email,role,department,is_active FROM users WHERE id=$1',
      [decoded.id]
    );
    if (!rows.length || !rows[0].is_active)
      return res.status(401).json({ success: false, message: 'User not found or inactive.' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Token expired.' });
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: `Access denied. Required: ${roles.join(', ')}` });
  next();
};

module.exports = { authenticate, authorize };
