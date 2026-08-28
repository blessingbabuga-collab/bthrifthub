-- Create policy for admins to update all profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles 
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Protect role and is_verified fields from being updated by normal users
CREATE OR REPLACE FUNCTION public.protect_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Only check if an existing row is being updated
  IF TG_OP = 'UPDATE' THEN
    -- Check if the current user is an admin
    SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
    
    IF v_is_admin IS NOT TRUE THEN
      -- User is not an admin, they cannot change 'role' or 'is_verified'
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Not authorized to change role';
      END IF;
      
      IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
        RAISE EXCEPTION 'Not authorized to change verification status';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_security ON public.profiles;
CREATE TRIGGER enforce_profile_security
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_admin_fields();

