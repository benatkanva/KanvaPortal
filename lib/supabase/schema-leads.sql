-- ============================================
-- LEADS TABLE (Leads from Copper)
-- ============================================
CREATE TABLE leads (
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
  
  -- Company/Account info
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
  converted_currency TEXT,
  
  -- Ownership
  owned_by TEXT,
  owner_id INTEGER,
  assignee_id INTEGER,
  
  -- Dates & Activity
  last_status_at TIMESTAMPTZ,
  last_contacted TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  inactive_days INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  
  -- Classification
  region TEXT,
  segment TEXT,
  customer_priority TEXT,
  organization_level TEXT,
  business_model TEXT,
  account_type TEXT,
  product_categories_of_interest TEXT,
  
  -- Details
  details TEXT,
  prospect_notes TEXT,
  account_notes TEXT,
  
  -- Copper metadata
  copper_id INTEGER,
  copper_url TEXT,
  tags TEXT,
  currency TEXT,
  exchange_rate DECIMAL(10,4),
  
  -- Contact details
  phone_number TEXT,
  phone_number_type TEXT,
  phone_number_2 TEXT,
  phone_number_2_type TEXT,
  email_type TEXT,
  work_email TEXT,
  website TEXT,
  website_type TEXT,
  
  -- Social
  social TEXT,
  social_type TEXT,
  social_2 TEXT,
  social_2_type TEXT,
  social_3 TEXT,
  social_3_type TEXT,
  
  -- Additional fields
  account_order_id TEXT,
  sale_type TEXT,
  trade_show_name TEXT,
  parent_account TEXT,
  parent_account_number TEXT,
  secondary_contact_ids TEXT,
  secondary_contact_names TEXT,
  main_phone TEXT,
  account_opportunity TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_leads_name ON leads(name);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_account ON leads(account);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_owner_id ON leads(owner_id);
CREATE INDEX idx_leads_assignee_id ON leads(assignee_id);
CREATE INDEX idx_leads_region ON leads(region);
CREATE INDEX idx_leads_segment ON leads(segment);
CREATE INDEX idx_leads_lead_temperature ON leads(lead_temperature);
CREATE INDEX idx_leads_converted_at ON leads(converted_at);
CREATE INDEX idx_leads_copper_id ON leads(copper_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- Full-text search
CREATE INDEX idx_leads_search ON leads USING gin(
  to_tsvector('english', 
    name || ' ' || 
    COALESCE(email, '') || ' ' ||
    COALESCE(account, '') || ' ' ||
    COALESCE(company, '') || ' ' ||
    COALESCE(details, '')
  )
);
