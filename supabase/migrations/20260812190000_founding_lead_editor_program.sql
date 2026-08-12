-- Founding Lead Editor programme, stage 1.
--
-- This migration creates the capped programme state and audit/feedback records.
-- It does not grant editorial permissions or change revenue calculations.

CREATE TABLE IF NOT EXISTS public.founding_lead_editor_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (
    status IN ('invited', 'accepted', 'declined', 'expired', 'waitlisted', 'revoked')
  ),
  qualifying_article_count integer NOT NULL DEFAULT 0 CHECK (qualifying_article_count >= 0),
  qualified_at timestamptz NOT NULL,
  invited_at timestamptz,
  invitation_expires_at timestamptz,
  responded_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  earnings_weight numeric(6,4) NOT NULL DEFAULT 1.0200 CHECK (earnings_weight >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status <> 'invited'
    OR (invited_at IS NOT NULL AND invitation_expires_at IS NOT NULL)
  ),
  CHECK (status <> 'accepted' OR accepted_at IS NOT NULL)
);

ALTER TABLE public.founding_lead_editor_memberships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_founding_lead_editor_memberships_status
  ON public.founding_lead_editor_memberships (status, qualified_at, created_at);

COMMENT ON TABLE public.founding_lead_editor_memberships IS
  'Server-managed membership state for the capped Founding Lead Editor programme. Stage 1 grants no permissions.';
COMMENT ON COLUMN public.founding_lead_editor_memberships.earnings_weight IS
  'Weight applied inside the existing writer pool after acceptance. 1.0200 means a 2% uplift, not two percentage points of total revenue.';

CREATE TABLE IF NOT EXISTS public.founding_lead_editor_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  membership_id uuid REFERENCES public.founding_lead_editor_memberships(id) ON DELETE SET NULL,
  journalist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'journalist', 'admin')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.founding_lead_editor_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_founding_lead_editor_audit_journalist
  ON public.founding_lead_editor_audit_log (journalist_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.journalist_communication_preferences (
  journalist_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  programme_updates boolean NOT NULL DEFAULT true,
  platform_updates boolean NOT NULL DEFAULT true,
  feedback_invitations boolean NOT NULL DEFAULT true,
  editorial_tips boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journalist_communication_preferences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.journalist_communication_preferences IS
  'Writer choices for non-transactional communications. Essential account, editorial-decision, security and payment messages are not controlled here.';

CREATE TABLE IF NOT EXISTS public.journalist_platform_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context text NOT NULL DEFAULT 'general',
  confidence_areas text[] NOT NULL DEFAULT '{}'::text[],
  support_requested text,
  ideas text,
  permission_to_follow_up boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'actioned', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journalist_platform_feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_journalist_platform_feedback_status
  ON public.journalist_platform_feedback (status, created_at DESC);

-- Atomically expire stale reservations, then invite an eligible writer or
-- place them on the waiting list. Accepted memberships and unexpired
-- invitations together consume the ten available places.
CREATE OR REPLACE FUNCTION public.reserve_founding_lead_editor_invitation(
  p_journalist_id uuid,
  p_qualifying_article_count integer,
  p_max_places integer DEFAULT 10,
  p_invitation_days integer DEFAULT 14
)
RETURNS public.founding_lead_editor_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_existing public.founding_lead_editor_memberships;
  v_membership public.founding_lead_editor_memberships;
  v_reserved integer;
  v_status text;
BEGIN
  IF p_qualifying_article_count < 5 THEN
    RAISE EXCEPTION 'Five qualifying published articles are required';
  END IF;
  IF p_max_places < 1 OR p_invitation_days < 1 THEN
    RAISE EXCEPTION 'Invalid programme configuration';
  END IF;

  -- A single programme-wide transaction lock prevents overbooking.
  PERFORM pg_advisory_xact_lock(hashtextextended('founding-lead-editor-programme', 0));

  UPDATE public.founding_lead_editor_memberships
  SET status = 'expired', updated_at = v_now
  WHERE status = 'invited'
    AND invitation_expires_at <= v_now;

  SELECT * INTO v_existing
  FROM public.founding_lead_editor_memberships
  WHERE journalist_id = p_journalist_id;

  -- Invitation is issued only once. Retries and republishing cannot create a
  -- duplicate offer or restore a declined/revoked membership.
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT count(*) INTO v_reserved
  FROM public.founding_lead_editor_memberships
  WHERE status = 'accepted'
     OR (status = 'invited' AND invitation_expires_at > v_now);

  v_status := CASE WHEN v_reserved < p_max_places THEN 'invited' ELSE 'waitlisted' END;

  INSERT INTO public.founding_lead_editor_memberships (
    journalist_id,
    status,
    qualifying_article_count,
    qualified_at,
    invited_at,
    invitation_expires_at
  ) VALUES (
    p_journalist_id,
    v_status,
    p_qualifying_article_count,
    v_now,
    CASE WHEN v_status = 'invited' THEN v_now END,
    CASE WHEN v_status = 'invited' THEN v_now + make_interval(days => p_invitation_days) END
  )
  RETURNING * INTO v_membership;

  INSERT INTO public.founding_lead_editor_audit_log (
    membership_id, journalist_id, event_type, to_status, details
  ) VALUES (
    v_membership.id,
    p_journalist_id,
    CASE WHEN v_status = 'invited' THEN 'invitation_reserved' ELSE 'waitlisted' END,
    v_status,
    jsonb_build_object(
      'qualifying_article_count', p_qualifying_article_count,
      'max_places', p_max_places,
      'invitation_days', p_invitation_days
    )
  );

  RETURN v_membership;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_founding_lead_editor_invitation(uuid, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_founding_lead_editor_invitation(uuid, integer, integer, integer) TO service_role;

INSERT INTO public.site_settings (key, value) VALUES
  ('founding_lead_editor_enabled', 'true'::jsonb),
  ('founding_lead_editor_max_places', '10'::jsonb),
  ('founding_lead_editor_required_articles', '5'::jsonb),
  ('founding_lead_editor_invitation_days', '14'::jsonb),
  ('founding_lead_editor_earnings_weight', '1.02'::jsonb)
ON CONFLICT (key) DO NOTHING;

