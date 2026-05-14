/*
  # Add service role policies for profiles table

  The registration API routes use the service role key to insert profiles
  immediately after Supabase Auth creates the user. The service role bypasses
  RLS by default, but these explicit policies document the intended access pattern.

  ## Changes
  - Add INSERT policy allowing service role to insert any profile row
  - Add UPDATE policy allowing service role to update any profile row
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role can insert profiles' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Service role can insert profiles"
      ON profiles FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role can update profiles' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Service role can update profiles"
      ON profiles FOR UPDATE
      TO service_role
      USING (true);
  END IF;
END $$;
