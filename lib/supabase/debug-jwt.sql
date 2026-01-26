-- ============================================
-- DEBUG JWT CLAIMS
-- ============================================
-- Run this to see what's actually in your JWT token

-- Check what the user_company_id() function returns
SELECT public.user_company_id() as company_id_from_function;

-- Check raw JWT claims
SELECT current_setting('request.jwt.claims', true)::json as raw_jwt_claims;

-- Check if company_id is in user_metadata
SELECT 
  current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id' as company_id_from_user_metadata,
  current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id' as company_id_from_app_metadata,
  current_setting('request.jwt.claims', true)::json ->> 'company_id' as company_id_from_claims;

-- Check auth.uid()
SELECT auth.uid() as user_id;
