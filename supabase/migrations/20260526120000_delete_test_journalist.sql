-- Hard-delete the test journalist account `nyadzayostan@gmail.com` and every
-- record that depends on it.
--
-- Ordering respects every FK constraint in the schema. In particular:
--   * articles.author_id  → profiles(id)   ON DELETE SET NULL
--       (deleting the auth user alone would leave orphan articles behind, so
--        we wipe the articles explicitly first)
--   * article_views.article_id   → articles(id) ON DELETE CASCADE
--   * article_shares.article_id  → articles(id) ON DELETE CASCADE
--       (the article delete cascades and clears these automatically)
--   * profiles.id  → auth.users(id) ON DELETE CASCADE
--       (the final auth.users delete cleans up the profile row)

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower('nyadzayostan@gmail.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth.users row matched nyadzayostan@gmail.com — nothing to delete.';
    RETURN;
  END IF;

  -- 1) Articles authored by this account. Cascades to article_views and
  --    article_shares via ON DELETE CASCADE on article_id.
  DELETE FROM public.articles WHERE author_id = v_user_id;

  -- 2) Any article_views still attributed via journalist_id (parent article
  --    already removed above; this catches stray rows whose parent FK was
  --    SET NULL by an earlier schema state).
  DELETE FROM public.article_views WHERE journalist_id = v_user_id;

  -- 3) article_shares has no direct journalist link; rows were removed via
  --    the article delete cascade above. No further action needed.

  -- 4) Revenue share history for this journalist (guarded with to_regclass
  --    so the migration stays portable to environments where the table has
  --    not been provisioned yet).
  IF to_regclass('public.journalist_revenue_shares') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.journalist_revenue_shares WHERE journalist_id = $1'
      USING v_user_id;
  END IF;

  -- 5) Profile row. Would also cascade from the auth.users delete below;
  --    explicit here so the deletion is unambiguous if FK behaviour ever
  --    changes.
  DELETE FROM public.profiles WHERE id = v_user_id;
END
$$;

-- 6) Finally, remove the Supabase auth.users row. profiles cascades via
--    ON DELETE CASCADE, so this is a no-op against the profile row if the
--    DO block above already removed it.
DELETE FROM auth.users
WHERE lower(email) = lower('nyadzayostan@gmail.com');
