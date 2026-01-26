-- ============================================
-- UPDATE ACCOUNT STATUS BASED ON FISHBOWL DATA
-- ============================================
-- Set status to 'customer' for active Fishbowl customers
-- Set status to 'prospect' for non-Fishbowl accounts
-- Run this in Supabase SQL Editor

-- Update accounts with Fishbowl IDs to 'customer' status
UPDATE accounts 
SET status = 'customer'
WHERE company_id = 'kanva-botanicals'
  AND fishbowl_id IS NOT NULL
  AND is_active_customer = true;

-- Update accounts without Fishbowl IDs to 'prospect' status
UPDATE accounts 
SET status = 'prospect'
WHERE company_id = 'kanva-botanicals'
  AND fishbowl_id IS NULL
  AND is_active_customer = false;

-- Verify the update
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE is_active_customer = true) as active_customers,
  COUNT(*) FILTER (WHERE fishbowl_id IS NOT NULL) as has_fishbowl_id
FROM accounts 
WHERE company_id = 'kanva-botanicals'
GROUP BY status
ORDER BY count DESC;

-- Show sample of each status
SELECT 
  name,
  status,
  is_active_customer,
  fishbowl_id,
  source
FROM accounts 
WHERE company_id = 'kanva-botanicals'
ORDER BY status, name
LIMIT 20;
