-- Round-robin journalist application approval assignments.

CREATE TABLE public.journalist_approval_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_journalist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approver_journalist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  status text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'completed', 'expired', 'escalated', 'cancelled')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  completed_at timestamptz,
  decision text CHECK (decision IS NULL OR decision IN ('approve', 'reject')),
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journalist_approval_assignments ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX journalist_one_active_approval_assignment
  ON public.journalist_approval_assignments (application_journalist_id)
  WHERE status = 'assigned';

CREATE UNIQUE INDEX journalist_one_attempt_per_lead
  ON public.journalist_approval_assignments (application_journalist_id, approver_journalist_id)
  WHERE approver_journalist_id IS NOT NULL;

CREATE INDEX journalist_approval_assignments_due
  ON public.journalist_approval_assignments (status, due_at);

COMMENT ON TABLE public.journalist_approval_assignments IS
  'Server-only, auditable application assignments. At most one lead owns an application at a time.';

CREATE OR REPLACE FUNCTION public.assign_journalist_application(
  p_application_journalist_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS public.journalist_approval_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.journalist_approval_assignments;
  v_assignment public.journalist_approval_assignments;
  v_approver uuid;
  v_attempt integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('journalist-approval:' || p_application_journalist_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('journalist-approval-round-robin', 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_application_journalist_id AND subscription_status = 'pending_approval'
  ) THEN
    RAISE EXCEPTION 'Application is not pending approval';
  END IF;

  SELECT * INTO v_current
  FROM public.journalist_approval_assignments
  WHERE application_journalist_id = p_application_journalist_id
    AND status = 'assigned'
  FOR UPDATE;

  IF FOUND AND v_current.due_at > p_now THEN
    RETURN v_current;
  END IF;

  IF FOUND THEN
    UPDATE public.journalist_approval_assignments
    SET status = 'expired'
    WHERE id = v_current.id;
  END IF;

  SELECT count(*)::integer + 1 INTO v_attempt
  FROM public.journalist_approval_assignments
  WHERE application_journalist_id = p_application_journalist_id
    AND approver_journalist_id IS NOT NULL;

  IF v_attempt <= 3 THEN
    SELECT m.journalist_id INTO v_approver
    FROM public.founding_lead_editor_memberships m
    JOIN public.profiles p ON p.id = m.journalist_id
    WHERE m.status = 'accepted'
      AND p.subscription_status = 'active'
      AND m.journalist_id <> p_application_journalist_id
      AND NOT EXISTS (
        SELECT 1 FROM public.journalist_approval_assignments used
        WHERE used.application_journalist_id = p_application_journalist_id
          AND used.approver_journalist_id = m.journalist_id
      )
    ORDER BY (
      SELECT max(previous.assigned_at)
      FROM public.journalist_approval_assignments previous
      WHERE previous.approver_journalist_id = m.journalist_id
    ) ASC NULLS FIRST, m.accepted_at ASC, m.journalist_id ASC
    LIMIT 1;
  END IF;

  IF v_approver IS NULL THEN
    INSERT INTO public.journalist_approval_assignments (
      application_journalist_id, attempt_number, status, assigned_at, due_at, escalated_at
    ) VALUES (
      p_application_journalist_id, least(greatest(v_attempt, 1), 3), 'escalated', p_now, p_now, p_now
    ) RETURNING * INTO v_assignment;
  ELSE
    INSERT INTO public.journalist_approval_assignments (
      application_journalist_id, approver_journalist_id, attempt_number, assigned_at, due_at
    ) VALUES (
      p_application_journalist_id, v_approver, v_attempt, p_now, p_now + interval '24 hours'
    ) RETURNING * INTO v_assignment;
  END IF;

  RETURN v_assignment;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_journalist_application(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_journalist_application(uuid, timestamptz) TO service_role;
