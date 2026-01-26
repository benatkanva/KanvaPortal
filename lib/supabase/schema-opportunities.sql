-- ============================================
-- OPPORTUNITIES TABLE (Opportunities from Copper)
-- ============================================
CREATE TABLE opportunities (
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
  status TEXT, -- 'Won', 'Lost', 'Open', etc.
  win_probability INTEGER, -- 0-100
  priority TEXT,
  loss_reason TEXT,
  
  -- Relationships
  account_id TEXT, -- Company ID from Copper
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
  converted_currency TEXT,
  currency TEXT,
  exchange_rate DECIMAL(10,4),
  
  -- Order/Project details
  so_number TEXT,
  account_order_id TEXT,
  customer_po TEXT,
  
  -- Shipping & Fulfillment
  shipping_amount DECIMAL(10,2),
  shipping_status TEXT,
  shipping_method TEXT,
  ship_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
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
  primary_products_ordered TEXT,
  
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
  organization_level TEXT,
  business_model TEXT,
  account_number TEXT,
  sale_type TEXT,
  
  -- Project fields
  project_category TEXT,
  priority_level TEXT,
  estimated_budget DECIMAL(12,2),
  target_completion_date TIMESTAMPTZ,
  
  -- Sync tracking
  sync_status TEXT,
  last_sync_date TIMESTAMPTZ,
  fishbowl_status TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX idx_opportunities_account_id ON opportunities(account_id);
CREATE INDEX idx_opportunities_owner_id ON opportunities(owner_id);
CREATE INDEX idx_opportunities_assignee_id ON opportunities(assignee_id);
CREATE INDEX idx_opportunities_pipeline ON opportunities(pipeline);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_close_date ON opportunities(close_date);
CREATE INDEX idx_opportunities_value ON opportunities(value);
CREATE INDEX idx_opportunities_copper_id ON opportunities(copper_id);
CREATE INDEX idx_opportunities_created_at ON opportunities(created_at);

-- Full-text search
CREATE INDEX idx_opportunities_search ON opportunities USING gin(
  to_tsvector('english', 
    name || ' ' || 
    COALESCE(details, '') || ' ' ||
    COALESCE(company_name, '') || ' ' ||
    COALESCE(primary_contact, '')
  )
);
