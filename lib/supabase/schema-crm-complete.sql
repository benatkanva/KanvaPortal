-- ============================================
-- COMPLETE CRM SCHEMA MIGRATION
-- Run this to create all CRM tables in Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PEOPLE TABLE (Contacts from Copper)
-- ============================================
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'copper',
  
  -- Core identity
  first_name TEXT,
  last_name TEXT,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  
  -- Company association
  company_name TEXT,
  account_id TEXT,
  
  -- Address
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Contact details
  phone_numbers JSONB DEFAULT '[]'::jsonb,
  emails JSONB DEFAULT '[]'::jsonb,
  websites JSONB DEFAULT '[]'::jsonb,
  socials JSONB DEFAULT '[]'::jsonb,
  
  -- Copper metadata
  copper_id INTEGER,
  contact_type_id INTEGER,
  assignee_id INTEGER,
  owner_id INTEGER,
  interaction_count INTEGER DEFAULT 0,
  
  -- Custom fields
  region TEXT,
  segment TEXT,
  account_type TEXT[],
  customer_priority TEXT,
  organization_level TEXT,
  account_number TEXT,
  account_order_id TEXT,
  
  -- Tracking
  date_created TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  synced_from_copper_api_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_company_id ON people(company_id);
CREATE INDEX IF NOT EXISTS idx_people_account_id ON people(account_id);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);
CREATE INDEX IF NOT EXISTS idx_people_company_name ON people(company_name);
CREATE INDEX IF NOT EXISTS idx_people_copper_id ON people(copper_id);
CREATE INDEX IF NOT EXISTS idx_people_created_at ON people(created_at);
CREATE INDEX IF NOT EXISTS idx_people_search ON people USING gin(
  to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company_name, '') || ' ' || COALESCE(title, ''))
);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'copper',
  
  -- Core fields
  name TEXT NOT NULL,
  details TEXT,
  status TEXT,
  priority TEXT,
  
  -- Relationships
  related_to_type TEXT,
  related_to_id TEXT,
  account_id TEXT,
  person_id TEXT,
  opportunity_id TEXT,
  
  -- Ownership
  owner TEXT,
  owner_id INTEGER,
  assignee_id INTEGER,
  
  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reminder_date TIMESTAMPTZ,
  
  -- Copper metadata
  copper_id INTEGER,
  tags TEXT,
  
  -- Custom fields
  account_number TEXT,
  account_order_id TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_person_id ON tasks(person_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_copper_id ON tasks(copper_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- ============================================
-- OPPORTUNITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'copper',
  
  -- Core fields
  name TEXT NOT NULL,
  details TEXT,
  value DECIMAL(12,2),
  
  -- Pipeline & Status
  pipeline TEXT,
  stage TEXT,
  status TEXT,
  win_probability INTEGER,
  priority TEXT,
  loss_reason TEXT,
  
  -- Relationships
  account_id TEXT,
  company_name TEXT,
  primary_contact TEXT,
  primary_contact_id TEXT,
  
  -- Ownership
  owner TEXT,
  owner_id INTEGER,
  assignee_id INTEGER,
  
  -- Dates
  close_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  lead_created_at TIMESTAMPTZ,
  last_stage_at TIMESTAMPTZ,
  days_in_stage INTEGER,
  inactive_days INTEGER,
  
  -- Financial details
  converted_value DECIMAL(12,2),
  currency TEXT,
  exchange_rate DECIMAL(10,4),
  
  -- Order details
  so_number TEXT,
  account_order_id TEXT,
  customer_po TEXT,
  
  -- Shipping
  shipping_amount DECIMAL(12,2),
  shipping_status TEXT,
  shipping_method TEXT,
  ship_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  tracking_number TEXT,
  carrier TEXT,
  
  -- Financial breakdown
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  discount_amount DECIMAL(12,2),
  order_total DECIMAL(12,2),
  
  -- Payment
  payment_terms TEXT,
  payment_status TEXT,
  
  -- Products
  products_involved TEXT,
  
  -- Copper metadata
  copper_id INTEGER,
  copper_url TEXT,
  tags TEXT,
  interaction_count INTEGER DEFAULT 0,
  last_contacted TIMESTAMPTZ,
  
  -- Custom fields
  region TEXT,
  segment TEXT,
  account_type TEXT,
  customer_priority TEXT,
  business_model TEXT,
  account_number TEXT,
  sale_type TEXT,
  
  -- Sync tracking
  sync_status TEXT,
  fishbowl_status TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_account_id ON opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_close_date ON opportunities(close_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_copper_id ON opportunities(copper_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at);

-- ============================================
-- LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'copper',
  
  -- Core identity
  first_name TEXT,
  last_name TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  
  -- Company/Account
  account TEXT,
  company TEXT,
  account_number TEXT,
  
  -- Address
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Lead details
  status TEXT,
  lead_temperature TEXT,
  value DECIMAL(12,2),
  
  -- Conversion tracking
  converted_at TIMESTAMPTZ,
  converted_contact_id TEXT,
  converted_opportunity_id TEXT,
  converted_value DECIMAL(12,2),
  
  -- Ownership
  owned_by TEXT,
  owner_id INTEGER,
  
  -- Activity
  last_status_at TIMESTAMPTZ,
  last_contacted TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  inactive_days INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  
  -- Classification
  region TEXT,
  segment TEXT,
  customer_priority TEXT,
  business_model TEXT,
  account_type TEXT,
  
  -- Details
  details TEXT,
  prospect_notes TEXT,
  
  -- Copper metadata
  copper_id INTEGER,
  copper_url TEXT,
  tags TEXT,
  
  -- Contact details
  work_email TEXT,
  website TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_region ON leads(region);
CREATE INDEX IF NOT EXISTS idx_leads_copper_id ON leads(copper_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- ============================================
-- FOREIGN KEY RELATIONSHIPS (optional)
-- ============================================
-- Uncomment these after all data is migrated

-- ALTER TABLE people ADD CONSTRAINT fk_people_account 
--   FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

-- ALTER TABLE tasks ADD CONSTRAINT fk_tasks_account 
--   FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- ALTER TABLE tasks ADD CONSTRAINT fk_tasks_person 
--   FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;

-- ALTER TABLE tasks ADD CONSTRAINT fk_tasks_opportunity 
--   FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE;

-- ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_account 
--   FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

-- ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_person 
--   FOREIGN KEY (primary_contact_id) REFERENCES people(id) ON DELETE SET NULL;
