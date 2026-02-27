// src/config/migrate.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./database');

const SQL = `

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(30) NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin','manager','editor','viewer')),
  department    VARCHAR(100),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_code  VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(80),
  country       VARCHAR(100),
  contact_name  VARCHAR(120),
  contact_email VARCHAR(200),
  contact_phone VARCHAR(40),
  status        VARCHAR(20) NOT NULL DEFAULT 'Active'
                  CHECK (status IN ('Active','Inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rigs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rig_code       VARCHAR(20) UNIQUE NOT NULL,
  name           VARCHAR(200) NOT NULL,
  type           VARCHAR(80),
  company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
  location       VARCHAR(200),
  depth_capacity VARCHAR(40),
  status         VARCHAR(30) NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active','Inactive','Maintenance','Retired')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_no   VARCHAR(40) UNIQUE NOT NULL,
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  rig_id        UUID REFERENCES rigs(id) ON DELETE SET NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  value_usd     NUMERIC(18,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'Pending'
                  CHECK (status IN ('Active','Expired','Pending','Cancelled')),
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_no         VARCHAR(30) UNIQUE NOT NULL,
  name             VARCHAR(200) NOT NULL,
  category         VARCHAR(80),
  serial_number    VARCHAR(100),
  status           VARCHAR(30) NOT NULL DEFAULT 'Active'
                     CHECK (status IN ('Active','Inactive','Maintenance','Contracted','Retired')),
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  rig_id           UUID REFERENCES rigs(id) ON DELETE SET NULL,
  contract_id      UUID REFERENCES contracts(id) ON DELETE SET NULL,
  location         VARCHAR(200),
  value_usd        NUMERIC(18,2) NOT NULL DEFAULT 0,
  acquisition_date DATE,
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES bom_items(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  part_no         VARCHAR(100),
  item_type       VARCHAR(20) NOT NULL DEFAULT 'Serialized'
                    CHECK (item_type IN ('Serialized','Bulk')),
  serial_number   VARCHAR(100),
  manufacturer    VARCHAR(150),
  quantity        NUMERIC(12,3) NOT NULL DEFAULT 1,
  uom             VARCHAR(20) NOT NULL DEFAULT 'EA',
  unit_cost_usd   NUMERIC(18,2) DEFAULT 0,
  lead_time_days  INTEGER DEFAULT 0,
  status          VARCHAR(30) NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active','Inactive','Obsolete','On Order')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bulk_no_serial
    CHECK (item_type != 'Bulk' OR serial_number IS NULL)
);

CREATE TABLE IF NOT EXISTS asset_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id     UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  action       VARCHAR(80) NOT NULL,
  field_name   VARCHAR(80),
  old_value    TEXT,
  new_value    TEXT,
  notes        TEXT,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  message    TEXT,
  type       VARCHAR(30) DEFAULT 'info'
               CHECK (type IN ('info','warning','success','error')),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  link       VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sent_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  recipients TEXT NOT NULL,
  subject    VARCHAR(300) NOT NULL,
  body       TEXT,
  alert_type VARCHAR(80),
  status     VARCHAR(20) DEFAULT 'sent',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_status    ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_company   ON assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_rig       ON assets(rig_id);
CREATE INDEX IF NOT EXISTS idx_assets_no        ON assets(asset_no);
CREATE INDEX IF NOT EXISTS idx_bom_asset        ON bom_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_bom_parent       ON bom_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_notif_user       ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','companies','rigs','contracts','assets','bom_items'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄  Running migrations...');
    await client.query(SQL);
    console.log('✅  All tables created successfully.');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
