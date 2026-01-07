-- Merge duplicate permissive policies to improve performance
-- Multiple permissive policies for same role/action are suboptimal

-- ============================================
-- BOTTLE_INTERACTIONS: Merge INSERT policies
-- Keep interactions_insert_own (has IS NOT NULL check)
-- Remove interactions_insert_self (redundant)
-- ============================================

DROP POLICY IF EXISTS "interactions_insert_self" ON public.bottle_interactions;

-- ============================================
-- BOTTLE_INTERACTIONS: Merge DELETE policies
-- Keep interactions_delete_bottle_author (uses EXISTS, better performance)
-- Remove bottle_interactions_delete_by_bottle_owner (uses IN, redundant)
-- ============================================

DROP POLICY IF EXISTS "bottle_interactions_delete_by_bottle_owner" ON public.bottle_interactions;

-- ============================================
-- BOTTLES: Merge SELECT policies
-- Keep bottles_select_policy (includes relay bottle support)
-- Remove bottles_select_with_secret_protection (subset of above)
-- ============================================

DROP POLICY IF EXISTS "bottles_select_with_secret_protection" ON public.bottles;

-- ============================================
-- REPLIES: Merge SELECT policies
-- Keep replies_select_policy (handles relay/non-relay distinction)
-- Remove replies_select_bottle_owner (covered by replies_select_policy)
-- ============================================

DROP POLICY IF EXISTS "replies_select_bottle_owner" ON public.replies;

-- ============================================
-- Remove duplicate indexes
-- ============================================

-- bottle_interactions: idx_bottle_interactions_bottle_id and idx_interactions_bottle are identical
DROP INDEX IF EXISTS idx_interactions_bottle;

-- replies: idx_replies_bottle and idx_replies_bottle_id are identical
DROP INDEX IF EXISTS idx_replies_bottle;

-- ============================================
-- Fix function search_path for update_bottle_likes_count
-- ============================================

CREATE OR REPLACE FUNCTION public.update_bottle_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'liked' THEN
    UPDATE bottles SET likes_count = likes_count + 1 WHERE id = NEW.bottle_id;
  ELSIF TG_OP = 'DELETE' AND OLD.interaction_type = 'liked' THEN
    UPDATE bottles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.bottle_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.interaction_type = 'liked' AND NEW.interaction_type <> 'liked' THEN
      UPDATE bottles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.bottle_id;
    ELSIF OLD.interaction_type <> 'liked' AND NEW.interaction_type = 'liked' THEN
      UPDATE bottles SET likes_count = likes_count + 1 WHERE id = NEW.bottle_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
