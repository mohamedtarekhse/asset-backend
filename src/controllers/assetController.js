// src/controllers/assetController.js
const pool = require('../config/database');
const XLSX = require('xlsx');
const fs   = require('fs');

const BASE_QUERY = `
  SELECT a.id, a.asset_no, a.name, a.category, a.serial_number, a.status,
         a.location, a.value_usd, a.acquisition_date, a.notes,
         a.created_at, a.updated_at,
         c.id AS company_id, c.name AS company_name,
         r.id AS rig_id,     r.name AS rig_name,
         k.id AS contract_id, k.contract_no,
         u.name AS created_by_name
  FROM assets a
  LEFT JOIN companies c ON a.company_id  = c.id
  LEFT JOIN rigs      r ON a.rig_id      = r.id
  LEFT JOIN contracts k ON a.contract_id = k.id
  LEFT JOIN users     u ON a.created_by  = u.id
`;

exports.getAll = async (req, res) => {
  try {
    const { search='', status, category, company_id, rig_id, sort='a.created_at', order='desc', page=1, limit=50 } = req.query;
    const conditions = [], params = [];
    let p = 1;
    if (search)     { conditions.push(`(a.asset_no ILIKE $${p} OR a.name ILIKE $${p} OR a.location ILIKE $${p} OR a.serial_number ILIKE $${p})`); params.push(`%${search}%`); p++; }
    if (status)     { conditions.push(`a.status=$${p++}`);     params.push(status); }
    if (category)   { conditions.push(`a.category=$${p++}`);   params.push(category); }
    if (company_id) { conditions.push(`a.company_id=$${p++}`); params.push(company_id); }
    if (rig_id)     { conditions.push(`a.rig_id=$${p++}`);     params.push(rig_id); }
    const where   = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const allowed = ['a.asset_no','a.name','a.category','a.status','a.value_usd','a.created_at','c.name','r.name'];
    const sortCol = allowed.includes(sort) ? sort : 'a.created_at';
    const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset  = (parseInt(page)-1) * parseInt(limit);
    const [data, count] = await Promise.all([
      pool.query(`${BASE_QUERY} ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${p} OFFSET $${p+1}`, [...params, parseInt(limit), offset]),
      pool.query(`SELECT COUNT(*) FROM assets a LEFT JOIN companies c ON a.company_id=c.id ${where}`, params),
    ]);
    res.json({ success:true, data:data.rows, pagination:{ total:parseInt(count.rows[0].count), page:parseInt(page), limit:parseInt(limit), pages:Math.ceil(count.rows[0].count/limit) } });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE_QUERY} WHERE a.id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success:false, message:'Asset not found.' });
    const hist = await pool.query(
      `SELECT ah.*,u.name AS user_name FROM asset_history ah LEFT JOIN users u ON ah.performed_by=u.id WHERE ah.asset_id=$1 ORDER BY ah.performed_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ success:true, data:{ ...rows[0], history:hist.rows } });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.create = async (req, res) => {
  try {
    const { asset_no, name, category, serial_number, status='Active', company_id, rig_id, contract_id, location, value_usd=0, acquisition_date, notes } = req.body;
    if (!asset_no || !name) return res.status(400).json({ success:false, message:'asset_no and name are required.' });
    const { rows } = await pool.query(
      `INSERT INTO assets (asset_no,name,category,serial_number,status,company_id,rig_id,contract_id,location,value_usd,acquisition_date,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [asset_no,name,category,serial_number,status,company_id||null,rig_id||null,contract_id||null,location,value_usd,acquisition_date||null,notes,req.user.id]
    );
    await pool.query(`INSERT INTO asset_history (asset_id,action,notes,performed_by) VALUES ($1,'Created','Asset registered in system',$2)`, [rows[0].id, req.user.id]);
    res.status(201).json({ success:true, message:'Asset created.', id:rows[0].id });
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ success:false, message:'Asset number already exists.' });
    res.status(500).json({ success:false, message:err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { rows:existing } = await pool.query('SELECT * FROM assets WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success:false, message:'Asset not found.' });
    const fields = ['name','category','serial_number','status','company_id','rig_id','contract_id','location','value_usd','acquisition_date','notes'];
    const updates=[], params=[], historyEntries=[];
    let p=1;
    for (const f of fields) {
      if (req.body[f] !== undefined && String(req.body[f]) !== String(existing[0][f])) {
        updates.push(`${f}=$${p++}`);
        params.push(req.body[f]==='' ? null : req.body[f]);
        historyEntries.push({ field:f, old:existing[0][f], new:req.body[f] });
      }
    }
    if (!updates.length) return res.json({ success:true, message:'No changes detected.' });
    params.push(req.params.id);
    await pool.query(`UPDATE assets SET ${updates.join(',')} WHERE id=$${p}`, params);
    for (const h of historyEntries) {
      await pool.query(`INSERT INTO asset_history (asset_id,action,field_name,old_value,new_value,performed_by) VALUES ($1,'Updated',$2,$3,$4,$5)`,
        [req.params.id, h.field, String(h.old), String(h.new), req.user.id]);
    }
    res.json({ success:true, message:'Asset updated.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.remove = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM assets WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success:false, message:'Asset not found.' });
    res.json({ success:true, message:'Asset deleted.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.exportExcel = async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY a.asset_no`);
    const data = rows.map(a => ({
      'Asset No': a.asset_no, 'Name': a.name, 'Category': a.category,
      'Serial Number': a.serial_number, 'Status': a.status,
      'Company': a.company_name, 'Rig': a.rig_name, 'Contract No': a.contract_no,
      'Location': a.location, 'Value (USD)': Number(a.value_usd),
      'Acquisition Date': a.acquisition_date ? a.acquisition_date.toISOString().split('T')[0] : '',
      'Notes': a.notes || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [12,30,22,18,14,28,20,16,22,14,18,30].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="Assets_${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.importExcel = async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) return res.status(400).json({ success:false, message:'No file uploaded.' });
    const wb   = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    if (!rows.length) return res.status(400).json({ success:false, message:'File is empty.' });
    let imported=0, skipped=0, errors=[];
    for (const [i, row] of rows.entries()) {
      const assetNo = row['Asset No'] || row['asset_no'];
      const name    = row['Name']     || row['name'];
      if (!assetNo || !name) { skipped++; continue; }
      try {
        await pool.query(
          `INSERT INTO assets (asset_no,name,category,serial_number,status,location,value_usd,acquisition_date,notes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (asset_no) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status`,
          [assetNo,name,row['Category']||null,row['Serial Number']||null,row['Status']||'Inactive',row['Location']||null,parseFloat(row['Value (USD)']||0)||0,row['Acquisition Date']||null,row['Notes']||null,req.user.id]
        );
        imported++;
      } catch(e) { errors.push(`Row ${i+2}: ${e.message}`); skipped++; }
    }
    fs.unlinkSync(filePath);
    res.json({ success:true, message:'Import complete.', imported, skipped, errors });
  } catch (err) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success:false, message:err.message });
  }
};

exports.summary = async (req, res) => {
  try {
    const [totals, byStatus, byCategory, totalValue] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM assets'),
      pool.query('SELECT status, COUNT(*) AS count FROM assets GROUP BY status ORDER BY count DESC'),
      pool.query('SELECT category, COUNT(*) AS count FROM assets GROUP BY category ORDER BY count DESC'),
      pool.query('SELECT COALESCE(SUM(value_usd),0) AS total_value FROM assets'),
    ]);
    res.json({ success:true, data:{ total:parseInt(totals.rows[0].total), totalValue:parseFloat(totalValue.rows[0].total_value), byStatus:byStatus.rows, byCategory:byCategory.rows } });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
