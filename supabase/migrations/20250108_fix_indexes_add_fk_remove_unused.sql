-- Fix index issues: add missing FK indexes, remove unused indexes

-- ============================================
-- ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================

-- replies.author_id foreign key
CREATE INDEX IF NOT EXISTS idx_replies_author_id ON public.replies(author_id);

-- reports.reporter_id foreign key
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);

-- bottles.current_holder_id foreign key
CREATE INDEX IF NOT EXISTS idx_bottles_current_holder_id ON public.bottles(current_holder_id);

-- ============================================
-- REMOVE UNUSED INDEXES
-- These indexes have never been used and add overhead
-- ============================================

-- bottle_interactions unused indexes
DROP INDEX IF EXISTS idx_bottle_interactions_exclusion;
DROP INDEX IF EXISTS idx_bottle_interactions_user_type;
DROP INDEX IF EXISTS idx_bottle_interactions_liked;

-- bottles unused indexes
DROP INDEX IF EXISTS idx_bottles_local_city;
DROP INDEX IF EXISTS idx_bottles_floating_general;
DROP INDEX IF EXISTS idx_bottles_city;
DROP INDEX IF EXISTS idx_bottles_secret_code;
DROP INDEX IF EXISTS idx_bottles_author_unread;
DROP INDEX IF EXISTS idx_bottles_current_holder;
DROP INDEX IF EXISTS idx_bottles_relay_floating;
DROP INDEX IF EXISTS idx_bottles_type;

-- secret_code_attempts unused index
DROP INDEX IF EXISTS idx_secret_code_attempts_time;

-- bottle_access unused index
DROP INDEX IF EXISTS idx_bottle_access_user_bottle;
