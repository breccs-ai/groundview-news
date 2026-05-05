/*
  # Fix RLS INSERT policies for subscribers and contact_messages

  ## Changes
  - Drop the unrestricted INSERT policies that used WITH CHECK (true)
  - Replace with policies that validate required fields are non-empty
    - subscribers: email must be non-empty
    - contact_messages: name, email, and message must all be non-empty

  ## Security
  - Inserts are still open to anonymous users (required for public forms)
  - But data must pass field validation, preventing empty/junk submissions
*/

DROP POLICY IF EXISTS "Anyone can subscribe" ON subscribers;
CREATE POLICY "Anyone can subscribe with valid email"
  ON subscribers FOR INSERT
  WITH CHECK (
    email IS NOT NULL AND
    length(trim(email)) > 0
  );

DROP POLICY IF EXISTS "Anyone can submit contact message" ON contact_messages;
CREATE POLICY "Anyone can submit contact message with required fields"
  ON contact_messages FOR INSERT
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0 AND
    email IS NOT NULL AND length(trim(email)) > 0 AND
    message IS NOT NULL AND length(trim(message)) > 0
  );
