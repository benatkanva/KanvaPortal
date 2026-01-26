-- ============================================
-- FIX ACTIVE CUSTOMER STATUS
-- ============================================
-- Active customers are those with a Fishbowl ID (in Fishbowl system)
-- Run this in Supabase SQL Editor

-- Update is_active_customer based on fishbowl_id
UPDATE accounts 
SET is_active_customer = (fishbowl_id IS NOT NULL)
WHERE company_id = 'kanva-botanicals';

-- Verify the update
SELECT 
  COUNT(*) FILTER (WHERE is_active_customer = true) as active_customers,
  COUNT(*) FILTER (WHERE is_active_customer = false) as non_active,
  COUNT(*) FILTER (WHERE fishbowl_id IS NOT NULL) as has_fishbowl_id,
  COUNT(*) as total
FROM accounts 
WHERE company_id = 'kanva-botanicals';

-- Show sample of active customers
SELECT 
  name,
  fishbowl_id,
  is_active_customer,
  status
FROM accounts 
WHERE company_id = 'kanva-botanicals' 
  AND is_active_customer = true
LIMIT 10;
