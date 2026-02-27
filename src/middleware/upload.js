// src/middleware/upload.js
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
});

module.exports = upload;
