-- Update user trigger to support customer signups
-- New signups default to 'customer' role unless they have an invitation
-- Admin/staff roles are assigned through invitations or manually

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT role_slug INTO user_role
  FROM public.invitations
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status = 'pending'
  LIMIT 1;

  -- If invitation found, use that role; otherwise default to 'customer'
  -- Exception: if no admins exist, make first user admin
  IF user_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE role_slug = 'admin') THEN
      user_role := 'customer';
    ELSE
      user_role := 'admin'; -- First user is admin
    END IF;
  END IF;

  -- Insert profile with determined role
  INSERT INTO public.profiles (id, email, role_slug, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger is already created, no need to recreate
