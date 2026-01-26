-- ============================================
-- FIX JWT CLAIMS TO INCLUDE COMPANY_ID
-- ============================================
-- This ensures company_id from user_metadata is included in JWT claims
-- Run this in Supabase SQL Editor

-- Create or replace the custom access token hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_metadata jsonb;
BEGIN
  -- Get the claims from the event
  claims := event->'claims';
  
  -- Get user metadata
  user_metadata := event->'user_metadata';
  
  -- Add company_id to claims if it exists in user_metadata
  IF user_metadata ? 'company_id' THEN
    claims := jsonb_set(claims, '{company_id}', user_metadata->'company_id');
  END IF;
  
  -- Add role to claims if it exists in user_metadata
  IF user_metadata ? 'role' THEN
    claims := jsonb_set(claims, '{role}', user_metadata->'role');
  END IF;
  
  -- Add full_name to claims if it exists in user_metadata
  IF user_metadata ? 'full_name' THEN
    claims := jsonb_set(claims, '{full_name}', user_metadata->'full_name');
  END IF;
  
  -- Update the event with modified claims
  event := jsonb_set(event, '{claims}', claims);
  
  RETURN event;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO postgres;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO anon;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO service_role;

-- Note: After running this SQL, you need to:
-- 1. Go to Supabase Dashboard > Authentication > Hooks
-- 2. Enable "Custom Access Token" hook
-- 3. Select the function: public.custom_access_token_hook
-- 4. Save
-- 5. Sign out and sign back in to get new JWT with company_id in claims
