-- ============================================
-- FIX RLS POLICY FOR SAVED_FILTERS
-- ============================================
-- This updates the RLS policy to properly read company_id from JWT

-- First, let's update the user_company_id function to handle both cases
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    -- First try to get from top-level claims (if custom hook worked)
    current_setting('request.jwt.claims', true)::json ->> 'company_id',
    -- Then try user_metadata (fallback)
    current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id',
    -- Then try app_metadata (fallback)
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'
  )::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Users see their own and public filters" ON saved_filters;
DROP POLICY IF EXISTS "Users insert only to their company" ON saved_filters;
DROP POLICY IF EXISTS "Users update only their own filters" ON saved_filters;
DROP POLICY IF EXISTS "Users delete only their own filters" ON saved_filters;

-- Recreate policies with better error handling
CREATE POLICY "Users see their own and public filters"
ON saved_filters FOR SELECT
USING (
  company_id = public.user_company_id() AND 
  (user_id = auth.uid()::TEXT OR is_public = true)
);

CREATE POLICY "Users insert only to their company"
ON saved_filters FOR INSERT
WITH CHECK (
  -- Allow insert if company_id matches user's company
  company_id = public.user_company_id() AND 
  user_id = auth.uid()::TEXT
);

CREATE POLICY "Users update only their own filters"
ON saved_filters FOR UPDATE
USING (
  company_id = public.user_company_id() AND 
  user_id = auth.uid()::TEXT
);

CREATE POLICY "Users delete only their own filters"
ON saved_filters FOR DELETE
USING (
  company_id = public.user_company_id() AND 
  user_id = auth.uid()::TEXT
);

-- Test the function
SELECT public.user_company_id() as test_company_id;
