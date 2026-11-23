-- Migration: 20261123094000_giver_merchant_brand_name.sql
-- Description: Allow anon and authenticated roles to read business_name on profiles for gift givers and sellers,
-- and expand profiles_public_seller_card_read policy to cover published/selected/completed gift givers.

-- 1. Column-scoped grant on business_name
GRANT SELECT (business_name) ON public.profiles TO anon, authenticated;

-- 2. Drop and re-create profiles_public_seller_card_read policy to include gift givers
DROP POLICY IF EXISTS profiles_public_seller_card_read ON public.profiles;

CREATE POLICY profiles_public_seller_card_read
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products pr
    WHERE pr.seller_id = profiles.id AND pr.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.gift_listings gl
    WHERE gl.giver_id = profiles.id AND gl.status IN ('published', 'applications_closed', 'selected', 'awarded', 'completed')
  )
);
