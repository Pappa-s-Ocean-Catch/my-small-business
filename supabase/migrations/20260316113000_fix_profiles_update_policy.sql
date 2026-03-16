-- Ensure customers can update their own profile (full_name, phone, etc.)
-- Fixes issue where UPDATE appears successful but no rows are actually
-- modified due to missing RLS policy on public.profiles.

-- IMPORTANT:
-- RLS controls *which rows* can be updated. To prevent customers/staff from
-- updating sensitive columns (e.g. role_slug), we also restrict UPDATE
-- privileges to only allowed columns.

-- Only allow authenticated users to update safe profile fields.
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone) ON TABLE public.profiles TO authenticated;

-- Allow backend/admin server code (service role) to manage roles.
-- IMPORTANT: Do NOT do role updates from the browser client; use a server action/API route.
GRANT UPDATE (role_slug) ON TABLE public.profiles TO service_role;

DO $$
BEGIN
  -- Create SELECT policy if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;

  -- Create UPDATE policy if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;

