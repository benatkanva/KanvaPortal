-- ============================================
-- PEOPLE TABLE (Contacts from Copper)
-- ============================================
CREATE TABLE people (
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
  account_id TEXT, -- Foreign key to accounts table
  
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
  
  -- Custom fields (from Copper cf_ fields)
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

-- Indexes
CREATE INDEX idx_people_company_id ON people(company_id);
CREATE INDEX idx_people_account_id ON people(account_id);
CREATE INDEX idx_people_name ON people(name);
CREATE INDEX idx_people_email ON people(email);
CREATE INDEX idx_people_company_name ON people(company_name);
CREATE INDEX idx_people_copper_id ON people(copper_id);
CREATE INDEX idx_people_assignee_id ON people(assignee_id);
CREATE INDEX idx_people_created_at ON people(created_at);

-- Full-text search
CREATE INDEX idx_people_search ON people USING gin(
  to_tsvector('english', 
    name || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(company_name, '') || ' ' ||
    COALESCE(title, '')
  )
);

-- Foreign key to accounts (if needed)
-- ALTER TABLE people ADD CONSTRAINT fk_people_account FOREIGN KEY (account_id) REFERENCES accounts(id);
