// src/config/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱  Seeding database...');
    await client.query('BEGIN');

    // ── USERS ──────────────────────────────────────────
    const users = [
      { name: 'Ahmad Mohammed',  email: 'admin@assetmgmt.com',  role: 'admin',   dept: 'Asset Management' },
      { name: 'Sara Al-Rashid',  email: 'sara@assetmgmt.com',   role: 'manager', dept: 'Operations' },
      { name: 'James Miller',    email: 'james@assetmgmt.com',  role: 'viewer',  dept: 'Finance' },
      { name: 'Layla Hassan',    email: 'layla@assetmgmt.com',  role: 'editor',  dept: 'Contracts' },
      { name: 'David Chen',      email: 'david@assetmgmt.com',  role: 'viewer',  dept: 'Engineering' },
      { name: 'Fatima Al-Zahra', email: 'fatima@assetmgmt.com', role: 'editor',  dept: 'Maintenance' },
    ];
    const hash = await bcrypt.hash('Password123!', 12);
    const userIds = {};
    for (const u of users) {
      const r = await client.query(
        `INSERT INTO users (name,email,password_hash,role,department)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
         RETURNING id`,
        [u.name, u.email, hash, u.role, u.dept]
      );
      userIds[u.email] = r.rows[0].id;
    }
    console.log('  ✔ Users seeded');

    // ── COMPANIES ──────────────────────────────────────
    const companies = [
      { code:'CMP001', name:'Arabian Drilling Company',     type:'Drilling Contractor', country:'Saudi Arabia', contact:'Khalid Al-Rashid',  email:'k.rashid@adc.com.sa',        phone:'+966-11-4567890' },
      { code:'CMP002', name:'NABORS Industries',            type:'Drilling Contractor', country:'USA',          contact:'James Wilson',       email:'j.wilson@nabors.com',         phone:'+1-281-874-0035' },
      { code:'CMP003', name:'Patterson-UTI Energy',         type:'Drilling Contractor', country:'USA',          contact:'Sarah Johnson',      email:'s.johnson@patenergy.com',     phone:'+1-713-693-4000' },
      { code:'CMP004', name:'Al-Khafji Joint Operations',  type:'Operator',            country:'Kuwait',       contact:'Mohammed Al-Khafji', email:'m.khafji@kjo.com',            phone:'+965-2244-5566' },
      { code:'CMP005', name:'Parker Drilling',              type:'Drilling Contractor', country:'USA',          contact:'Mike Parker',        email:'m.parker@parkerdrilling.com', phone:'+1-713-460-0010' },
    ];
    const companyIds = {};
    for (const c of companies) {
      const r = await client.query(
        `INSERT INTO companies (company_code,name,type,country,contact_name,contact_email,contact_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (company_code) DO UPDATE SET name=EXCLUDED.name
         RETURNING id`,
        [c.code,c.name,c.type,c.country,c.contact,c.email,c.phone]
      );
      companyIds[c.code] = r.rows[0].id;
    }
    console.log('  ✔ Companies seeded');

    // ── RIGS ───────────────────────────────────────────
    const rigs = [
      { code:'RIG001', name:'ADC Rig #7',       type:'Mechanical', comp:'CMP001', loc:'Ghawar Field, Saudi Arabia', depth:'25,000 ft', status:'Active' },
      { code:'RIG002', name:'NABORS 1250-E',     type:'Electric',   comp:'CMP002', loc:'Permian Basin, TX, USA',     depth:'30,000 ft', status:'Active' },
      { code:'RIG003', name:'Patterson Rig #55', type:'SCR',        comp:'CMP003', loc:'DJ Basin, CO, USA',          depth:'20,000 ft', status:'Maintenance' },
      { code:'RIG004', name:'KJO Land Rig #3',   type:'AC Drive',   comp:'CMP004', loc:'Khafji Field, Kuwait',       depth:'18,000 ft', status:'Active' },
    ];
    const rigIds = {};
    for (const r of rigs) {
      const res = await client.query(
        `INSERT INTO rigs (rig_code,name,type,company_id,location,depth_capacity,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (rig_code) DO UPDATE SET name=EXCLUDED.name
         RETURNING id`,
        [r.code,r.name,r.type,companyIds[r.comp],r.loc,r.depth,r.status]
      );
      rigIds[r.code] = res.rows[0].id;
    }
    console.log('  ✔ Rigs seeded');

    // ── CONTRACTS ──────────────────────────────────────
    const contracts = [
      { no:'CON-2024-001', comp:'CMP001', rig:'RIG001', start:'2024-01-15', end:'2025-01-14', val:4800000, status:'Active' },
      { no:'CON-2024-002', comp:'CMP002', rig:'RIG002', start:'2024-03-01', end:'2025-03-01', val:3200000, status:'Active' },
      { no:'CON-2024-003', comp:'CMP004', rig:'RIG004', start:'2023-07-01', end:'2024-07-01', val:6100000, status:'Expired' },
      { no:'CON-2025-001', comp:'CMP003', rig:'RIG003', start:'2025-01-10', end:'2026-01-10', val:1950000, status:'Pending' },
    ];
    const contractIds = {};
    for (const c of contracts) {
      const r = await client.query(
        `INSERT INTO contracts (contract_no,company_id,rig_id,start_date,end_date,value_usd,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (contract_no) DO UPDATE SET status=EXCLUDED.status
         RETURNING id`,
        [c.no,companyIds[c.comp],rigIds[c.rig],c.start,c.end,c.val,c.status,userIds['admin@assetmgmt.com']]
      );
      contractIds[c.no] = r.rows[0].id;
    }
    console.log('  ✔ Contracts seeded');

    // ── ASSETS ─────────────────────────────────────────
    const assets = [
      { no:'AST-001', name:'Top Drive System',          cat:'Drilling Equipment', serial:'TD-7821',  comp:'CMP001', rig:'RIG001', contract:'CON-2024-001', loc:'Ghawar Field',  status:'Contracted', val:1200000, date:'2021-03-15', notes:'High-capacity 1000T top drive' },
      { no:'AST-002', name:'BOP Stack 18-3/4"',         cat:'Drilling Equipment', serial:'BOP-4422', comp:'CMP001', rig:'RIG001', contract:'CON-2024-001', loc:'Ghawar Field',  status:'Contracted', val:850000,  date:'2020-07-20', notes:'Cameron BOP Stack' },
      { no:'AST-003', name:'Mud Pumps (3x)',             cat:'Drilling Equipment', serial:'MP-1103',  comp:'CMP002', rig:'RIG002', contract:'CON-2024-002', loc:'Permian Basin', status:'Maintenance',val:620000,  date:'2019-11-05', notes:'National 14-P-220 pumps' },
      { no:'AST-004', name:"Derrick Structure 142'",    cat:'Drilling Equipment', serial:'DRK-0078', comp:'CMP001', rig:'RIG001', contract:'CON-2024-001', loc:'Ghawar Field',  status:'Active',     val:2100000, date:'2018-05-01', notes:'IRI 142ft mast structure' },
      { no:'AST-005', name:'CAT 3516 Generator Set',    cat:'Power Generation',   serial:'GEN-7712', comp:'CMP003', rig:'RIG003', contract:'CON-2025-001', loc:'DJ Basin',      status:'Active',     val:480000,  date:'2022-01-10', notes:'2000kW prime power generator' },
      { no:'AST-006', name:'Heavy-Duty Crew Bus',        cat:'Transportation',     serial:'TRN-0341', comp:'CMP004', rig:'RIG004', contract:'CON-2024-003', loc:'Khafji Field',  status:'Active',     val:95000,   date:'2023-02-28', notes:'40-seat crew transportation' },
      { no:'AST-007', name:'H2S Detection System',      cat:'Safety Equipment',   serial:'SFT-2291', comp:'CMP002', rig:'RIG002', contract:'CON-2024-002', loc:'Permian Basin', status:'Active',     val:75000,   date:'2022-06-15', notes:'Multi-point H2S gas detection' },
      { no:'AST-008', name:'Satellite VSAT System',     cat:'Communication',      serial:'COM-8811', comp:'CMP004', rig:'RIG004', contract:'CON-2024-003', loc:'Khafji Field',  status:'Active',     val:145000,  date:'2021-09-01', notes:'Hughes VSAT 1.8m dish' },
      { no:'AST-009', name:'Drilling Jars - Hydraulic', cat:'Drilling Equipment', serial:'JAR-3301', comp:'CMP001', rig:'RIG001', contract:'CON-2024-001', loc:'Ghawar Field',  status:'Active',     val:210000,  date:'2022-12-01', notes:'Hydraulic drilling jars set' },
      { no:'AST-010', name:'Casing Running Tool',       cat:'Drilling Equipment', serial:'CRT-9910', comp:'CMP002', rig:'RIG002', contract:'CON-2024-002', loc:'Permian Basin', status:'Inactive',   val:130000,  date:'2020-03-15', notes:'Hydraulic CRT for 13-3/8" casing' },
      { no:'AST-011', name:'Emergency Fire Suppression',cat:'Safety Equipment',   serial:'SFT-4451', comp:'CMP003', rig:'RIG003', contract:'CON-2025-001', loc:'DJ Basin',      status:'Active',     val:88000,   date:'2023-05-20', notes:'Dry chemical fire suppression' },
      { no:'AST-012', name:'Light Plant System',         cat:'Power Generation',   serial:'LGT-1102', comp:'CMP004', rig:'RIG004', contract:'CON-2024-003', loc:'Khafji Field',  status:'Maintenance',val:42000,   date:'2021-11-15', notes:'LED light plants x6' },
    ];
    for (const a of assets) {
      await client.query(
        `INSERT INTO assets (asset_no,name,category,serial_number,company_id,rig_id,contract_id,location,status,value_usd,acquisition_date,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (asset_no) DO UPDATE SET name=EXCLUDED.name`,
        [a.no,a.name,a.cat,a.serial,companyIds[a.comp],rigIds[a.rig],contractIds[a.contract],a.loc,a.status,a.val,a.date,a.notes,userIds['admin@assetmgmt.com']]
      );
    }
    console.log('  ✔ Assets seeded');

    // ── NOTIFICATIONS ──────────────────────────────────
    const notifs = [
      { title:'Contract Expiry Warning', msg:'ADC Rig #7 contract (CON-2024-001) expires in 15 days.',    type:'warning' },
      { title:'Maintenance Alert',       msg:'Asset AST-003 (Mud Pumps) requires scheduled maintenance.', type:'warning' },
      { title:'Asset Activated',         msg:'AST-009 (Drilling Jars) has been set to Active.',           type:'success' },
      { title:'New Contract Created',    msg:'Contract CON-2025-001 created for Patterson-UTI Energy.',   type:'info'    },
    ];
    for (const n of notifs) {
      await client.query(
        `INSERT INTO notifications (user_id,title,message,type) VALUES ($1,$2,$3,$4)`,
        [userIds['admin@assetmgmt.com'], n.title, n.msg, n.type]
      );
    }
    console.log('  ✔ Notifications seeded');

    await client.query('COMMIT');
    console.log('\n🎉  Seed complete! Default password for all users: Password123!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
