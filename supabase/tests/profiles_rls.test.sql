-- RLS tests for public.profiles
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/profiles_rls.test.sql
-- Wraps everything in a transaction and ROLLBACKs so no data persists.

BEGIN;

-- Fixed UUIDs for deterministic assertions
-- u_seller_active: has an ACTIVE product   -> profile should be publicly visible
-- u_seller_inactive: only INACTIVE product -> profile should be hidden from others
-- u_buyer: no products                     -> profile should be hidden from others
-- u_viewer: signed-in viewer used for "authenticated" assertions

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seller_active@test.local',   '', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seller_inactive@test.local', '', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'buyer@test.local',           '', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@test.local',          '', now(), now());

INSERT INTO public.profiles (id, username, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'seller_active',   'Active Seller'),
  ('22222222-2222-2222-2222-222222222222', 'seller_inactive', 'Inactive Seller'),
  ('33333333-3333-3333-3333-333333333333', 'buyer',           'Just A Buyer'),
  ('44444444-4444-4444-4444-444444444444', 'viewer',          'Signed In Viewer');

INSERT INTO public.products (seller_id, title, price, image_url, category, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Active listing',   1000, 'x', 'Streetwear', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Inactive listing', 1000, 'x', 'Streetwear', 'sold');

-- Helper: assert a condition, raise on failure
CREATE OR REPLACE FUNCTION pg_temp.assert(cond boolean, msg text) RETURNS void AS $$
BEGIN
  IF NOT cond THEN RAISE EXCEPTION 'RLS TEST FAILED: %', msg; END IF;
END $$ LANGUAGE plpgsql;

-- ============================================================
-- 1) ANON: can only see profiles of sellers with active products
-- ============================================================
SET LOCAL role anon;

DO $$
DECLARE
  v_active_visible    boolean;
  v_inactive_visible  boolean;
  v_buyer_visible     boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') INTO v_active_visible;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222') INTO v_inactive_visible;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333') INTO v_buyer_visible;

  PERFORM pg_temp.assert(v_active_visible,        'anon should see profiles of sellers with active listings');
  PERFORM pg_temp.assert(NOT v_inactive_visible,  'anon must NOT see profiles whose only listings are inactive');
  PERFORM pg_temp.assert(NOT v_buyer_visible,     'anon must NOT see profiles of users without any active listings');
END $$;

RESET role;

-- ============================================================
-- 2) AUTHENTICATED (as viewer): own profile + active sellers only
-- ============================================================
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

DO $$
DECLARE
  v_self_visible      boolean;
  v_active_visible    boolean;
  v_inactive_visible  boolean;
  v_buyer_visible     boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444') INTO v_self_visible;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') INTO v_active_visible;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222') INTO v_inactive_visible;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333') INTO v_buyer_visible;

  PERFORM pg_temp.assert(v_self_visible,         'authenticated user must be able to read their own profile');
  PERFORM pg_temp.assert(v_active_visible,       'authenticated user should see profiles of sellers with active listings');
  PERFORM pg_temp.assert(NOT v_inactive_visible, 'authenticated user must NOT see profiles whose only listings are inactive');
  PERFORM pg_temp.assert(NOT v_buyer_visible,    'authenticated user must NOT see profiles of unrelated non-sellers');
END $$;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 3) AUTHENTICATED (as the inactive seller): can still read OWN profile
--    even though policy #2 (seller_read) would exclude them
-- ============================================================
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE v_self_visible boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222') INTO v_self_visible;
  PERFORM pg_temp.assert(v_self_visible, 'inactive-only seller must still be able to read own profile');
END $$;

RESET role;
RESET request.jwt.claims;

-- ============================================================
-- 4) Listing transition: when an active product becomes inactive,
--    the seller's profile must stop being publicly visible
-- ============================================================
UPDATE public.products SET status = 'sold'
  WHERE seller_id = '11111111-1111-1111-1111-111111111111';

SET LOCAL role anon;

DO $$
DECLARE v_visible boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') INTO v_visible;
  PERFORM pg_temp.assert(NOT v_visible, 'seller profile must become hidden once they have no active listings');
END $$;

RESET role;

-- All assertions passed if we got here
SELECT 'profiles RLS tests: OK' AS result;

ROLLBACK;