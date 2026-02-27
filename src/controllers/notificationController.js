// src/controllers/notificationController.js
const pool = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
    const unread = rows.filter(n=>!n.is_read).length;
    res.json({ success:true, data:rows, unread });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.markRead = async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ success:true });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.markAllRead = async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET is_read=TRUE WHERE user_id=$1`, [req.user.id]);
    res.json({ success:true, message:'All notifications marked as read.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success:true });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
