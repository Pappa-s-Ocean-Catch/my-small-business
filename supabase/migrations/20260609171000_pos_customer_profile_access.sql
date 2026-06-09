-- Allow POS staff/admin sessions to find and create customer profiles.
-- A SECURITY DEFINER helper avoids recursive RLS when policies on profiles
-- need to check the current user's role stored in profiles.

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_slug
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

DROP POLICY IF EXISTS profiles_staff_admin_read ON public.profiles;
CREATE POLICY profiles_staff_admin_read
ON public.profiles
FOR SELECT
USING (
  public.current_profile_role() IN ('staff', 'admin')
  AND role_slug = 'customer'
);

DROP POLICY IF EXISTS profiles_staff_admin_insert_customer ON public.profiles;
CREATE POLICY profiles_staff_admin_insert_customer
ON public.profiles
FOR INSERT
WITH CHECK (
  public.current_profile_role() IN ('staff', 'admin')
  AND role_slug = 'customer'
);
