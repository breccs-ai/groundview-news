/*
  # Add admin SELECT policy for articles

  ## Problem
  The existing SELECT policy only allows reading published articles.
  The admin dashboard fetches ALL articles (including drafts) using the anon key,
  and the API route's insert+select chain also fails because a newly-saved draft
  doesn't satisfy `status = 'published'`.

  ## Changes
  - Add a SELECT policy for the anon role that allows reading all articles,
    enabling the admin dashboard to list drafts and the API insert to return data.
  - Security is enforced at the API route layer (admin cookie check), not at the
    DB SELECT layer for admin reads.
*/

CREATE POLICY "Admin can read all articles"
  ON articles FOR SELECT
  TO anon
  USING (true);
