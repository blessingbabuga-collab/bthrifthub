-- Drop the policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Instead of a policy on profiles, we will create a SECURITY DEFINER function
-- that allows admins to update roles and verification status.

CREATE OR REPLACE FUNCTION public.admin_update_user(target_user_id uuid, new_role text, new_is_verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Verify caller is admin
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Perform the update (since it's SECURITY DEFINER, it bypasses RLS)
  UPDATE public.profiles 
  SET role = new_role, is_verified = new_is_verified
  WHERE id = target_user_id;
END;
$$;
