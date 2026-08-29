CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Drop existing policy if any
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;

CREATE POLICY "profiles_admin_read" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING ( public.is_admin() );
