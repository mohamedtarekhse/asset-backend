// src/config/database.js
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  family: 4,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  PostgreSQL connection failed:', err.message);
  } else {
    console.log('✅  PostgreSQL connected successfully');
    release();
  }
});

module.exports = pool;
