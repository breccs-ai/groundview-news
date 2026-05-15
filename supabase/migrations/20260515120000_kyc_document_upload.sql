-- KYC document upload columns and private storage bucket for advertiser verification.

ALTER TABLE public.advertiser_profiles
  ADD COLUMN IF NOT EXISTS kyc_document_url text,
  ADD COLUMN IF NOT EXISTS kyc_document_name text,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by text;

UPDATE public.advertiser_profiles
SET kyc_status = 'pending'
WHERE kyc_status IS NULL;

-- Private bucket for identity documents (not publicly accessible).
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Advertisers can upload own KYC documents" ON storage.objects;
CREATE POLICY "Advertisers can upload own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Service role can read KYC documents" ON storage.objects;
CREATE POLICY "Service role can read KYC documents"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'kyc-documents');
