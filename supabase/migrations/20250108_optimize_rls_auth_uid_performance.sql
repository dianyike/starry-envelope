-- Optimize RLS policies: replace auth.uid() with (select auth.uid())
-- This prevents re-evaluation for each row, improving query performance

-- ============================================
-- PROFILES TABLE (3 policies)
-- ============================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id);

-- ============================================
-- BOTTLES TABLE (5 policies)
-- ============================================

DROP POLICY IF EXISTS "bottles_insert_self" ON public.bottles;
CREATE POLICY "bottles_insert_self" ON public.bottles
  FOR INSERT WITH CHECK ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "bottles_update_policy" ON public.bottles;
CREATE POLICY "bottles_update_policy" ON public.bottles
  FOR UPDATE
  USING (author_id = (select auth.uid()))
  WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "bottles_delete_own" ON public.bottles;
CREATE POLICY "bottles_delete_own" ON public.bottles
  FOR DELETE USING (author_id = (select auth.uid()) AND status = 'retrieved');

DROP POLICY IF EXISTS "bottles_select_policy" ON public.bottles;
CREATE POLICY "bottles_select_policy" ON public.bottles
  FOR SELECT USING (
    author_id = (select auth.uid())
    OR (status = 'floating' AND bottle_type <> 'secret')
    OR (bottle_type = 'secret' AND EXISTS (
      SELECT 1 FROM bottle_access
      WHERE bottle_access.bottle_id = bottles.id
      AND bottle_access.user_id = (select auth.uid())
    ))
    OR (bottle_type = 'relay' AND current_holder_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "bottles_select_with_secret_protection" ON public.bottles;
CREATE POLICY "bottles_select_with_secret_protection" ON public.bottles
  FOR SELECT USING (
    author_id = (select auth.uid())
    OR (status = 'floating' AND bottle_type <> 'secret')
    OR (bottle_type = 'secret' AND EXISTS (
      SELECT 1 FROM bottle_access
      WHERE bottle_access.bottle_id = bottles.id
      AND bottle_access.user_id = (select auth.uid())
    ))
  );

-- ============================================
-- REPLIES TABLE (5 policies)
-- ============================================

DROP POLICY IF EXISTS "replies_select_bottle_owner" ON public.replies;
CREATE POLICY "replies_select_bottle_owner" ON public.replies
  FOR SELECT USING (
    bottle_id IN (
      SELECT bottles.id FROM bottles
      WHERE bottles.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "replies_select_policy" ON public.replies;
CREATE POLICY "replies_select_policy" ON public.replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bottles b
      WHERE b.id = replies.bottle_id
      AND b.author_id = (select auth.uid())
      AND b.bottle_type <> 'relay'
    )
    OR EXISTS (
      SELECT 1 FROM bottles b
      WHERE b.id = replies.bottle_id
      AND b.bottle_type = 'relay'
      AND b.current_holder_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM bottles b
      WHERE b.id = replies.bottle_id
      AND b.bottle_type = 'relay'
      AND b.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "replies_insert_must_have_picked" ON public.replies;
CREATE POLICY "replies_insert_must_have_picked" ON public.replies
  FOR INSERT WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = author_id
    AND EXISTS (
      SELECT 1 FROM bottle_interactions bi
      WHERE bi.bottle_id = replies.bottle_id
      AND bi.user_id = (select auth.uid())
      AND bi.interaction_type = 'picked'
    )
  );

DROP POLICY IF EXISTS "replies_update_bottle_owner" ON public.replies;
CREATE POLICY "replies_update_bottle_owner" ON public.replies
  FOR UPDATE USING (
    bottle_id IN (
      SELECT bottles.id FROM bottles
      WHERE bottles.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "replies_delete_by_bottle_owner" ON public.replies;
CREATE POLICY "replies_delete_by_bottle_owner" ON public.replies
  FOR DELETE USING (
    bottle_id IN (
      SELECT bottles.id FROM bottles
      WHERE bottles.author_id = (select auth.uid())
    )
  );

-- ============================================
-- BEACH TABLE (4 policies)
-- ============================================

DROP POLICY IF EXISTS "beach_select_own" ON public.beach;
CREATE POLICY "beach_select_own" ON public.beach
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "beach_insert_own" ON public.beach;
CREATE POLICY "beach_insert_own" ON public.beach
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "beach_update_own" ON public.beach;
CREATE POLICY "beach_update_own" ON public.beach
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "beach_delete_own" ON public.beach;
CREATE POLICY "beach_delete_own" ON public.beach
  FOR DELETE USING (user_id = (select auth.uid()));

-- ============================================
-- BOTTLE_INTERACTIONS TABLE (5 policies)
-- ============================================

DROP POLICY IF EXISTS "interactions_select_own" ON public.bottle_interactions;
CREATE POLICY "interactions_select_own" ON public.bottle_interactions
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "interactions_insert_own" ON public.bottle_interactions;
CREATE POLICY "interactions_insert_own" ON public.bottle_interactions
  FOR INSERT WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "interactions_insert_self" ON public.bottle_interactions;
CREATE POLICY "interactions_insert_self" ON public.bottle_interactions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "interactions_delete_bottle_author" ON public.bottle_interactions;
CREATE POLICY "interactions_delete_bottle_author" ON public.bottle_interactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bottles b
      WHERE b.id = bottle_interactions.bottle_id
      AND b.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "bottle_interactions_delete_by_bottle_owner" ON public.bottle_interactions;
CREATE POLICY "bottle_interactions_delete_by_bottle_owner" ON public.bottle_interactions
  FOR DELETE USING (
    bottle_id IN (
      SELECT bottles.id FROM bottles
      WHERE bottles.author_id = (select auth.uid())
    )
  );

-- ============================================
-- BOTTLE_ACCESS TABLE (2 policies)
-- ============================================

DROP POLICY IF EXISTS "Users can view own access" ON public.bottle_access;
CREATE POLICY "Users can view own access" ON public.bottle_access
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own access" ON public.bottle_access;
CREATE POLICY "Users can delete own access" ON public.bottle_access
  FOR DELETE USING (user_id = (select auth.uid()));

-- ============================================
-- REPORTS TABLE (2 policies)
-- ============================================

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING (reporter_id = (select auth.uid()));

DROP POLICY IF EXISTS "reports_insert_self" ON public.reports;
CREATE POLICY "reports_insert_self" ON public.reports
  FOR INSERT WITH CHECK ((select auth.uid()) = reporter_id);

-- ============================================
-- SECRET_CODE_ATTEMPTS TABLE (1 policy)
-- ============================================

DROP POLICY IF EXISTS "attempts_select_own" ON public.secret_code_attempts;
CREATE POLICY "attempts_select_own" ON public.secret_code_attempts
  FOR SELECT USING (user_id = (select auth.uid()));
