// src/utils/email.js
const nodemailer = require('nodemailer');
const pool       = require('../config/database');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function buildHtmlEmail(subject, body) {
  return `<!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f5f6f7;font-family:'Segoe UI',Arial,sans-serif">
    <div style="max-width:700px;margin:30px auto;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)">
      <div style="background:#354A5E;padding:20px 28px;">
        <div style="background:#0070F2;color:#fff;display:inline-block;padding:6px 14px;border-radius:4px;font-weight:700;font-size:16px;letter-spacing:1px">SAP</div>
        <span style="color:#fff;font-size:15px;font-weight:500;margin-left:12px">Asset Management System</span>
      </div>
      <div style="padding:28px">
        <h2 style="color:#32363A;font-size:18px;margin:0 0 16px">${subject}</h2>
        <div style="color:#555;font-size:14px;line-height:1.7;white-space:pre-line">${body}</div>
      </div>
      <div style="background:#f5f6f7;padding:14px 28px;font-size:12px;color:#888;border-top:1px solid #e0e0e0">
        This is an automated message from SAP Asset Management System.
      </div>
    </div>
  </body>
  </html>`;
}

async function sendEmail({ to, subject, body, alertType = 'Custom', sentBy = null }) {
  const recipients = Array.isArray(to) ? to.join(', ') : to;
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to: recipients,
    subject,
    html: buildHtmlEmail(subject, body),
  });
  await pool.query(
    `INSERT INTO email_logs (sent_by,recipients,subject,body,alert_type) VALUES ($1,$2,$3,$4,$5)`,
    [sentBy, recipients, subject, body, alertType]
  );
  return { recipients, subject };
}

module.exports = { sendEmail };
