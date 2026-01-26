-- ============================================
-- Google Cloud SQL PostgreSQL Schema
-- CRM Database for KanvaPortal
-- ============================================

-- Drop tables if they exist (for clean migration)
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS prospects CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- ============================================
-- ACCOUNTS TABLE
-- ============================================
CREATE TABLE accounts (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  copper_id INTEGER,
  fishbowl_id VARCHAR(255),
  
  -- Core fields
  name VARCHAR(500) NOT NULL,
  account_number VARCHAR(255),
  website VARCHAR(500),
  phone VARCHAR(100),
  email VARCHAR(255),
  
  -- Address
  shipping_street TEXT,
  shipping_city VARCHAR(255),
  shipping_state VARCHAR(100),
  shipping_zip VARCHAR(50),
  billing_street TEXT,
  billing_city VARCHAR(255),
  billing_state VARCHAR(100),
  billing_zip VARCHAR(50),
  
  -- Classification (decoded from Copper IDs to names)
  account_type TEXT[], -- Array for multi-select
  region VARCHAR(255),
  segment VARCHAR(255),
  customer_priority VARCHAR(255),
  organization_level VARCHAR(255),
  business_model VARCHAR(255),
  
  -- Terms
  payment_terms VARCHAR(255),
  shipping_terms VARCHAR(255),
  carrier_name VARCHAR(255),
  
  -- Sales data
  sales_person VARCHAR(255),
  total_orders INTEGER,
  total_spent DECIMAL(12,2),
  last_order_date TIMESTAMP,
  first_order_date TIMESTAMP,
  
  -- Primary contact
  primary_contact_id VARCHAR(255),
  primary_contact_name VARCHAR(500),
  primary_contact_email VARCHAR(255),
  primary_contact_phone VARCHAR(100),
  
  -- Copper custom fields
  account_order_id VARCHAR(255),
  copper_url TEXT,
  contact_type VARCHAR(255),
  inactive_days INTEGER,
  interaction_count INTEGER,
  last_contacted TIMESTAMP,
  owned_by VARCHAR(255),
  owner_id INTEGER,
  
  -- Status
  status VARCHAR(50) NOT NULL,
  is_active_customer BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Indexes for common queries and filters
CREATE INDEX idx_accounts_name ON accounts(name);
CREATE INDEX idx_accounts_region ON accounts(region);
CREATE INDEX idx_accounts_segment ON accounts(segment);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_is_active ON accounts(is_active_customer);
CREATE INDEX idx_accounts_sales_person ON accounts(sales_person);
CREATE INDEX idx_accounts_state ON accounts(shipping_state);
CREATE INDEX idx_accounts_city ON accounts(shipping_city);
CREATE INDEX idx_accounts_account_type ON accounts USING GIN(account_type);
CREATE INDEX idx_accounts_created_at ON accounts(created_at);
CREATE INDEX idx_accounts_updated_at ON accounts(updated_at);

-- Full-text search index for name, email, phone
CREATE INDEX idx_accounts_search ON accounts USING gin(
  to_tsvector('english', 
    name || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(phone, '') || ' ' ||
    COALESCE(shipping_city, '') || ' ' ||
    COALESCE(shipping_state, '')
  )
);

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE contacts (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  copper_id INTEGER,
  
  -- Core fields
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  full_name VARCHAR(500) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(100),
  title VARCHAR(255),
  
  -- Account relationship
  account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE SET NULL,
  account_name VARCHAR(500),
  copper_id_company INTEGER,
  is_primary_contact BOOLEAN DEFAULT false,
  
  -- Address
  street TEXT,
  city VARCHAR(255),
  state VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_contacts_account_id ON contacts(account_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_name ON contacts(full_name);
CREATE INDEX idx_contacts_search ON contacts USING gin(
  to_tsvector('english', full_name || ' ' || COALESCE(email, ''))
);

-- ============================================
-- PROSPECTS TABLE
-- ============================================
CREATE TABLE prospects (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  copper_id INTEGER,
  
  -- Core fields
  name VARCHAR(500) NOT NULL,
  company_name VARCHAR(500),
  title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(100),
  
  -- Address
  street TEXT,
  city VARCHAR(255),
  state VARCHAR(100),
  postal_code VARCHAR(50),
  
  -- Classification
  account_type TEXT[],
  region VARCHAR(255),
  segment VARCHAR(255),
  lead_temperature VARCHAR(100),
  account_opportunity VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL,
  assignee_id VARCHAR(255),
  assignee_name VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  follow_up_date TIMESTAMP,
  notes TEXT,
  trade_show_name VARCHAR(255)
);

-- Indexes
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_assignee ON prospects(assignee_id);
CREATE INDEX idx_prospects_region ON prospects(region);
CREATE INDEX idx_prospects_search ON prospects USING gin(
  to_tsvector('english', name || ' ' || COALESCE(company_name, '') || ' ' || COALESCE(email, ''))
);

-- ============================================
-- DEALS TABLE
-- ============================================
CREATE TABLE deals (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  copper_id INTEGER,
  
  -- Core fields
  name VARCHAR(500) NOT NULL,
  value DECIMAL(12,2),
  probability INTEGER,
  stage VARCHAR(255),
  pipeline_id VARCHAR(255),
  
  -- Relationships
  account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE SET NULL,
  account_name VARCHAR(500),
  contact_id VARCHAR(255) REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name VARCHAR(500),
  
  -- Status
  status VARCHAR(50) NOT NULL,
  expected_close_date TIMESTAMP,
  won_date TIMESTAMP,
  lost_date TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Indexes
CREATE INDEX idx_deals_account_id ON deals(account_id);
CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_expected_close ON deals(expected_close_date);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANTS (adjust as needed)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
