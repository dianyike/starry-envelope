-- 未讀數量快取：在 bottles 表加入 unread_replies_count 欄位
-- 使用 trigger 自動維護，避免每次都做 JOIN 計數

-- 1. 新增 unread_replies_count 欄位
ALTER TABLE bottles
ADD COLUMN IF NOT EXISTS unread_replies_count INT NOT NULL DEFAULT 0;

-- 2. 初始化現有資料的未讀數量
UPDATE bottles b
SET unread_replies_count = (
  SELECT COUNT(*)
  FROM replies r
  WHERE r.bottle_id = b.id AND r.is_read = FALSE
);

-- 3. 建立索引加速未讀數量查詢
CREATE INDEX IF NOT EXISTS idx_bottles_author_unread
ON bottles (author_id, unread_replies_count)
WHERE unread_replies_count > 0;

-- 4. 建立 trigger function：維護未讀數量
CREATE OR REPLACE FUNCTION update_bottle_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 新回覆預設未讀
    IF NEW.is_read = FALSE THEN
      UPDATE bottles
      SET unread_replies_count = unread_replies_count + 1
      WHERE id = NEW.bottle_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- 標記已讀時減少計數
    IF OLD.is_read = FALSE AND NEW.is_read = TRUE THEN
      UPDATE bottles
      SET unread_replies_count = GREATEST(0, unread_replies_count - 1)
      WHERE id = NEW.bottle_id;
    -- 標記未讀時增加計數（理論上不會發生，但保險起見）
    ELSIF OLD.is_read = TRUE AND NEW.is_read = FALSE THEN
      UPDATE bottles
      SET unread_replies_count = unread_replies_count + 1
      WHERE id = NEW.bottle_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- 刪除未讀回覆時減少計數
    IF OLD.is_read = FALSE THEN
      UPDATE bottles
      SET unread_replies_count = GREATEST(0, unread_replies_count - 1)
      WHERE id = OLD.bottle_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 5. 建立 trigger
DROP TRIGGER IF EXISTS trigger_update_bottle_unread_count ON replies;
CREATE TRIGGER trigger_update_bottle_unread_count
  AFTER INSERT OR UPDATE OF is_read OR DELETE ON replies
  FOR EACH ROW
  EXECUTE FUNCTION update_bottle_unread_count();

-- 6. 建立快速取得未讀數量的 RPC（避免 JOIN）
CREATE OR REPLACE FUNCTION get_unread_replies_count()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(unread_replies_count), 0)::INT
  INTO v_count
  FROM bottles
  WHERE author_id = v_user_id;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unread_replies_count() TO authenticated;

COMMENT ON COLUMN bottles.unread_replies_count IS '未讀回覆數量快取，由 trigger 自動維護';
COMMENT ON FUNCTION update_bottle_unread_count() IS '自動維護 bottles.unread_replies_count';
COMMENT ON FUNCTION get_unread_replies_count() IS '快速取得用戶的總未讀數量（O(B) 而非 O(R)）';
