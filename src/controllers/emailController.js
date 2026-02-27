// src/controllers/emailController.js
const pool = require('../config/database');
const { sendEmail } = require('../utils/email');

exports.sendAlert = async (req, res) => {
  try {
    const { to, subject, body, alertType='Custom' } = req.body;
    if (!to||!subject||!body) return res.status(400).json({ success:false, message:'to, subject, and body are required.' });
    await sendEmail({ to, subject, body, alertType, sentBy:req.user.id });
    res.json({ success:true, message:`Email sent to ${Array.isArray(to)?to.join(', '):to}` });
  } catch (err) { res.status(500).json({ success:false, message:'Email failed: '+err.message }); }
};

exports.getLogs = async (req, res) => {
  try {
    const { page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    const { rows } = await pool.query(
      `SELECT el.*,u.name AS sender_name FROM email_logs el LEFT JOIN users u ON el.sent_by=u.id ORDER BY el.sent_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );
    res.json({ success:true, data:rows });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
