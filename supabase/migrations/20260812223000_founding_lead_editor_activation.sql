-- Founding Lead Editor programme, stages 2 and 3: safe notification and response handling.

ALTER TABLE public.founding_lead_editor_memberships
  ADD COLUMN IF NOT EXISTS notification_claimed_at timestamptz;

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS lead_editor_qualifying boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.articles.lead_editor_qualifying IS
  'Whether a published article counts toward the five-article Founding Lead Editor threshold. Admins may exclude tests, duplicates or disqualified work.';

CREATE OR REPLACE FUNCTION public.respond_to_founding_lead_editor_invitation(
  p_journalist_id uuid,
  p_response text
)
RETURNS public.founding_lead_editor_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_membership public.founding_lead_editor_memberships;
  v_next_status text;
BEGIN
  IF p_response NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Invalid invitation response';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('founding-lead-editor-programme', 0));

  SELECT * INTO v_membership
  FROM public.founding_lead_editor_memberships
  WHERE journalist_id = p_journalist_id
  FOR UPDATE;

  IF NOT FOUND OR v_membership.status <> 'invited' THEN
    RAISE EXCEPTION 'No active invitation is available';
  END IF;

  IF v_membership.invitation_expires_at <= v_now THEN
    UPDATE public.founding_lead_editor_memberships
    SET status = 'expired', responded_at = v_now, updated_at = v_now
    WHERE id = v_membership.id
    RETURNING * INTO v_membership;
    RAISE EXCEPTION 'This invitation has expired';
  END IF;

  v_next_status := CASE WHEN p_response = 'accept' THEN 'accepted' ELSE 'declined' END;

  UPDATE public.founding_lead_editor_memberships
  SET status = v_next_status,
      responded_at = v_now,
      accepted_at = CASE WHEN p_response = 'accept' THEN v_now ELSE accepted_at END,
      updated_at = v_now
  WHERE id = v_membership.id
  RETURNING * INTO v_membership;

  INSERT INTO public.founding_lead_editor_audit_log (
    membership_id, journalist_id, event_type, from_status, to_status, actor_type, actor_id
  ) VALUES (
    v_membership.id, p_journalist_id,
    CASE WHEN p_response = 'accept' THEN 'invitation_accepted' ELSE 'invitation_declined' END,
    'invited', v_next_status, 'journalist', p_journalist_id
  );

  RETURN v_membership;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_founding_lead_editor_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_founding_lead_editor_invitation(uuid, text) TO service_role;

-- Expire stale offers and promote the earliest waitlisted writer while capacity exists.
CREATE OR REPLACE FUNCTION public.maintain_founding_lead_editor_invitations(
  p_max_places integer DEFAULT 10,
  p_invitation_days integer DEFAULT 14
)
RETURNS SETOF public.founding_lead_editor_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_reserved integer;
  v_membership public.founding_lead_editor_memberships;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('founding-lead-editor-programme', 0));

  UPDATE public.founding_lead_editor_memberships
  SET status = 'expired', responded_at = v_now, updated_at = v_now
  WHERE status = 'invited' AND invitation_expires_at <= v_now;

  SELECT count(*) INTO v_reserved
  FROM public.founding_lead_editor_memberships
  WHERE status = 'accepted'
     OR (status = 'invited' AND invitation_expires_at > v_now);

  WHILE v_reserved < p_max_places LOOP
    SELECT * INTO v_membership
    FROM public.founding_lead_editor_memberships
    WHERE status = 'waitlisted'
    ORDER BY qualified_at ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    EXIT WHEN NOT FOUND;

    UPDATE public.founding_lead_editor_memberships
    SET status = 'invited', invited_at = v_now,
        invitation_expires_at = v_now + make_interval(days => p_invitation_days),
        notification_claimed_at = NULL, updated_at = v_now
    WHERE id = v_membership.id
    RETURNING * INTO v_membership;

    INSERT INTO public.founding_lead_editor_audit_log (
      membership_id, journalist_id, event_type, from_status, to_status, details
    ) VALUES (
      v_membership.id, v_membership.journalist_id, 'waitlist_promoted',
      'waitlisted', 'invited', jsonb_build_object('invitation_days', p_invitation_days)
    );

    v_reserved := v_reserved + 1;
    RETURN NEXT v_membership;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_founding_lead_editor_invitations(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintain_founding_lead_editor_invitations(integer, integer) TO service_role;
