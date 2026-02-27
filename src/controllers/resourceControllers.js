// src/controllers/resourceControllers.js
const pool   = require('../config/database');
const bcrypt = require('bcryptjs');

// ─── USERS ────────────────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,name,email,role,department,is_active,last_login,created_at FROM users ORDER BY name');
    res.json({ success:true, data:rows });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role='viewer', department } = req.body;
    if (!name||!email||!password) return res.status(400).json({ success:false, message:'name, email and password are required.' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash,role,department) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role',
      [name, email.toLowerCase(), hash, role, department]
    );
    res.status(201).json({ success:true, data:rows[0] });
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ success:false, message:'Email already exists.' });
    res.status(500).json({ success:false, message:err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, role, department, is_active } = req.body;
    await pool.query(
      'UPDATE users SET name=COALESCE($1,name),role=COALESCE($2,role),department=COALESCE($3,department),is_active=COALESCE($4,is_active) WHERE id=$5',
      [name, role, department, is_active, req.params.id]
    );
    res.json({ success:true, message:'User updated.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id===req.user.id) return res.status(400).json({ success:false, message:'Cannot delete your own account.' });
    await pool.query('UPDATE users SET is_active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success:true, message:'User deactivated.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// ─── COMPANIES ────────────────────────────────────────────────────────────────
exports.getCompanies = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,COUNT(k.id) AS active_contracts FROM companies c LEFT JOIN contracts k ON k.company_id=c.id AND k.status='Active' GROUP BY c.id ORDER BY c.name`
    );
    res.json({ success:true, data:rows });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.createCompany = async (req, res) => {
  try {
    const { company_code, name, type, country, contact_name, contact_email, contact_phone } = req.body;
    if (!company_code||!name) return res.status(400).json({ success:false, message:'company_code and name are required.' });
    const { rows } = await pool.query(
      `INSERT INTO companies (company_code,name,type,country,contact_name,contact_email,contact_phone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [company_code,name,type,country,contact_name,contact_email,contact_phone]
    );
    res.status(201).json({ success:true, id:rows[0].id });
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ success:false, message:'Company code already exists.' });
    res.status(500).json({ success:false, message:err.message });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { name, type, country, contact_name, contact_email, contact_phone, status } = req.body;
    await pool.query(
      `UPDATE companies SET name=COALESCE($1,name),type=COALESCE($2,type),country=COALESCE($3,country),contact_name=COALESCE($4,contact_name),contact_email=COALESCE($5,contact_email),contact_phone=COALESCE($6,contact_phone),status=COALESCE($7,status) WHERE id=$8`,
      [name,type,country,contact_name,contact_email,contact_phone,status,req.params.id]
    );
    res.json({ success:true, message:'Company updated.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// ─── RIGS ─────────────────────────────────────────────────────────────────────
exports.getRigs = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,c.name AS company_name,COUNT(a.id) AS asset_count FROM rigs r LEFT JOIN companies c ON r.company_id=c.id LEFT JOIN assets a ON a.rig_id=r.id GROUP BY r.id,c.name ORDER BY r.name`
    );
    res.json({ success:true, data:rows });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.createRig = async (req, res) => {
  try {
    const { rig_code, name, type, company_id, location, depth_capacity, status } = req.body;
    if (!rig_code||!name) return res.status(400).json({ success:false, message:'rig_code and name are required.' });
    const { rows } = await pool.query(
      `INSERT INTO rigs (rig_code,name,type,company_id,location,depth_capacity,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [rig_code,name,type,company_id||null,location,depth_capacity,status||'Active']
    );
    res.status(201).json({ success:true, id:rows[0].id });
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ success:false, message:'Rig code already exists.' });
    res.status(500).json({ success:false, message:err.message });
  }
};

exports.updateRig = async (req, res) => {
  try {
    const { name, type, company_id, location, depth_capacity, status } = req.body;
    await pool.query(
      `UPDATE rigs SET name=COALESCE($1,name),type=COALESCE($2,type),company_id=COALESCE($3,company_id),location=COALESCE($4,location),depth_capacity=COALESCE($5,depth_capacity),status=COALESCE($6,status) WHERE id=$7`,
      [name,type,company_id,location,depth_capacity,status,req.params.id]
    );
    res.json({ success:true, message:'Rig updated.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// ─── CONTRACTS ────────────────────────────────────────────────────────────────
exports.getContracts = async (req, res) => {
  try {
    const { search='', status } = req.query;
    const conditions=[], params=[];
    let p=1;
    if (search) { conditions.push(`(k.contract_no ILIKE $${p} OR c.name ILIKE $${p})`); params.push(`%${search}%`); p++; }
    if (status) { conditions.push(`k.status=$${p++}`); params.push(status); }
    const where = conditions.length ? 'WHERE '+conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT k.*,c.name AS company_name,r.name AS rig_name,COUNT(a.id) AS asset_count FROM contracts k LEFT JOIN companies c ON k.company_id=c.id LEFT JOIN rigs r ON k.rig_id=r.id LEFT JOIN assets a ON a.contract_id=k.id ${where} GROUP BY k.id,c.name,r.name ORDER BY k.created_at DESC`,
      params
    );
    res.json({ success:true, data:rows });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.createContract = async (req, res) => {
  try {
    const { contract_no, company_id, rig_id, start_date, end_date, value_usd, status, notes } = req.body;
    if (!contract_no||!start_date||!end_date) return res.status(400).json({ success:false, message:'contract_no, start_date and end_date are required.' });
    const { rows } = await pool.query(
      `INSERT INTO contracts (contract_no,company_id,rig_id,start_date,end_date,value_usd,status,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [contract_no,company_id||null,rig_id||null,start_date,end_date,value_usd||0,status||'Pending',notes,req.user.id]
    );
    res.status(201).json({ success:true, id:rows[0].id });
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ success:false, message:'Contract number already exists.' });
    res.status(500).json({ success:false, message:err.message });
  }
};

exports.updateContract = async (req, res) => {
  try {
    const { company_id, rig_id, start_date, end_date, value_usd, status, notes } = req.body;
    await pool.query(
      `UPDATE contracts SET company_id=COALESCE($1,company_id),rig_id=COALESCE($2,rig_id),start_date=COALESCE($3,start_date),end_date=COALESCE($4,end_date),value_usd=COALESCE($5,value_usd),status=COALESCE($6,status),notes=COALESCE($7,notes) WHERE id=$8`,
      [company_id,rig_id,start_date,end_date,value_usd,status,notes,req.params.id]
    );
    res.json({ success:true, message:'Contract updated.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.deleteContract = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM contracts WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success:false, message:'Contract not found.' });
    res.json({ success:true, message:'Contract deleted.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
