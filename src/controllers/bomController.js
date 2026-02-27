// src/controllers/bomController.js
const pool = require('../config/database');
const XLSX = require('xlsx');

const TREE_CTE = `
  WITH RECURSIVE bom_tree AS (
    SELECT b.*, 0 AS depth, b.id::text AS path
    FROM bom_items b WHERE b.asset_id=$1 AND b.parent_id IS NULL
    UNION ALL
    SELECT b.*, bt.depth+1, bt.path||'/'||b.id::text
    FROM bom_items b JOIN bom_tree bt ON b.parent_id=bt.id
  )
`;

exports.getAll = async (req, res) => {
  try {
    const { asset_id, type, status, search } = req.query;
    if (asset_id) {
      const { rows } = await pool.query(`${TREE_CTE} SELECT bt.*,u.name AS created_by_name FROM bom_tree bt LEFT JOIN users u ON bt.created_by=u.id ORDER BY bt.path`, [asset_id]);
      const total=rows.length, serialized=rows.filter(r=>r.item_type==='Serialized').length, bulk=rows.filter(r=>r.item_type==='Bulk').length;
      const totalCost=rows.reduce((s,r)=>s+parseFloat(r.unit_cost_usd||0)*parseFloat(r.quantity||0),0);
      return res.json({ success:true, data:rows, summary:{ total, serialized, bulk, totalCost } });
    }
    const conditions=[], params=[];
    let p=1;
    if (search) { conditions.push(`(b.name ILIKE $${p} OR b.part_no ILIKE $${p})`); params.push(`%${search}%`); p++; }
    if (type)   { conditions.push(`b.item_type=$${p++}`); params.push(type); }
    if (status) { conditions.push(`b.status=$${p++}`);    params.push(status); }
    const where = conditions.length ? 'WHERE '+conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT b.*,a.asset_no,a.name AS asset_name,u.name AS created_by_name FROM bom_items b JOIN assets a ON b.asset_id=a.id LEFT JOIN users u ON b.created_by=u.id ${where} ORDER BY a.asset_no,b.created_at`, params
    );
    res.json({ success:true, data:rows, total:rows.length });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT b.*,a.asset_no,a.name AS asset_name FROM bom_items b JOIN assets a ON b.asset_id=a.id WHERE b.id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success:false, message:'BOM item not found.' });
    res.json({ success:true, data:rows[0] });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.create = async (req, res) => {
  try {
    const { asset_id, parent_id=null, name, part_no, item_type='Serialized', serial_number, manufacturer, quantity=1, uom='EA', unit_cost_usd=0, lead_time_days=0, status='Active', notes } = req.body;
    if (!asset_id || !name) return res.status(400).json({ success:false, message:'asset_id and name are required.' });
    const effectiveSerial = item_type==='Bulk' ? null : serial_number;
    if (parent_id) {
      const parentCheck = await pool.query('SELECT asset_id,item_type FROM bom_items WHERE id=$1', [parent_id]);
      if (!parentCheck.rows.length) return res.status(400).json({ success:false, message:'Parent BOM item not found.' });
      if (parentCheck.rows[0].item_type==='Bulk') return res.status(400).json({ success:false, message:'Cannot add children under a Bulk item.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO bom_items (asset_id,parent_id,name,part_no,item_type,serial_number,manufacturer,quantity,uom,unit_cost_usd,lead_time_days,status,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [asset_id,parent_id||null,name,part_no||null,item_type,effectiveSerial,manufacturer||null,quantity,uom,unit_cost_usd,lead_time_days,status,notes||null,req.user.id]
    );
    res.status(201).json({ success:true, id:rows[0].id, message:'BOM component created.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.update = async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM bom_items WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ success:false, message:'BOM item not found.' });
    const old = existing.rows[0];
    const { name, part_no, item_type, serial_number, manufacturer, quantity, uom, unit_cost_usd, lead_time_days, status, notes, parent_id } = req.body;
    const newType   = item_type ?? old.item_type;
    const newSerial = newType==='Bulk' ? null : (serial_number ?? old.serial_number);
    await pool.query(
      `UPDATE bom_items SET name=COALESCE($1,name),part_no=COALESCE($2,part_no),item_type=COALESCE($3,item_type),serial_number=$4,
       manufacturer=COALESCE($5,manufacturer),quantity=COALESCE($6,quantity),uom=COALESCE($7,uom),unit_cost_usd=COALESCE($8,unit_cost_usd),
       lead_time_days=COALESCE($9,lead_time_days),status=COALESCE($10,status),notes=COALESCE($11,notes),parent_id=COALESCE($12,parent_id) WHERE id=$13`,
      [name,part_no,item_type,newSerial,manufacturer,quantity,uom,unit_cost_usd,lead_time_days,status,notes,parent_id,req.params.id]
    );
    res.json({ success:true, message:'BOM component updated.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.remove = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `WITH RECURSIVE sub AS (SELECT id FROM bom_items WHERE id=$1 UNION ALL SELECT b.id FROM bom_items b JOIN sub ON b.parent_id=sub.id) SELECT COUNT(*) AS total FROM sub`,
      [req.params.id]
    );
    const { rowCount } = await pool.query('DELETE FROM bom_items WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success:false, message:'BOM item not found.' });
    res.json({ success:true, message:`Deleted ${rows[0].total} component(s).`, deleted:parseInt(rows[0].total) });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.exportExcel = async (req, res) => {
  try {
    const { asset_id } = req.query;
    const where  = asset_id ? 'WHERE b.asset_id=$1' : '';
    const params = asset_id ? [asset_id] : [];
    const { rows } = await pool.query(`SELECT b.*,a.asset_no,a.name AS asset_name FROM bom_items b JOIN assets a ON b.asset_id=a.id ${where} ORDER BY a.asset_no,b.created_at`, params);
    const data = rows.map(b => ({
      'Asset No': b.asset_no, 'Asset Name': b.asset_name, 'Component Name': b.name,
      'Part Number': b.part_no||'', 'Type': b.item_type, 'Serial Number': b.serial_number||'',
      'Manufacturer': b.manufacturer||'', 'Quantity': parseFloat(b.quantity),
      'UOM': b.uom, 'Unit Cost (USD)': parseFloat(b.unit_cost_usd||0),
      'Total Cost (USD)': parseFloat(b.unit_cost_usd||0)*parseFloat(b.quantity||0),
      'Lead Time (days)': b.lead_time_days||0, 'Status': b.status, 'Notes': b.notes||'',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [10,25,35,16,12,18,20,10,6,14,14,14,12,30].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws, 'BOM');
    const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="BOM_Export_${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
