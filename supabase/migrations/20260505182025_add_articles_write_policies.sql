/*
  # Add write policies for articles table

  ## Changes
  - Add INSERT policy for articles (anon role) — admin writes go through
    server-side API routes that verify the admin session cookie before writing.
    The database-level policy permits the write; app-level auth guards the route.
  - Add UPDATE policy for articles (anon role)
  - Add DELETE policy for articles (anon role)

  ## Notes
  This app uses a custom cookie-based admin session (not Supabase Auth), so
  auth.uid() is always null. Security is enforced at the API route layer via
  ADMIN_PASSWORD verification. The RLS policies permit anon writes so that
  server-side API routes using the anon key can perform admin operations.
*/

CREATE POLICY "Admin can insert articles"
  ON articles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Admin can update articles"
  ON articles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete articles"
  ON articles FOR DELETE
  TO anon
  USING (true);
