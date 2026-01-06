-- 漂流瓶愛心功能

-- 1. 新增 'liked' 到 interaction_type enum
ALTER TYPE interaction_type ADD VALUE IF NOT EXISTS 'liked';

-- 2. bottles 表新增 likes_count 欄位
ALTER TABLE bottles ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;

-- 3. 建立 trigger 自動更新 likes_count
CREATE OR REPLACE FUNCTION update_bottle_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'liked' THEN
    UPDATE bottles SET likes_count = likes_count + 1 WHERE id = NEW.bottle_id;
  ELSIF TG_OP = 'DELETE' AND OLD.interaction_type = 'liked' THEN
    UPDATE bottles SET likes_count = likes_count - 1 WHERE id = OLD.bottle_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_likes_count ON bottle_interactions;
CREATE TRIGGER trigger_update_likes_count
AFTER INSERT OR DELETE ON bottle_interactions
FOR EACH ROW
EXECUTE FUNCTION update_bottle_likes_count();

-- 4. 建立索引加速點讚查詢
CREATE INDEX IF NOT EXISTS idx_bottle_interactions_liked
ON bottle_interactions (bottle_id, user_id)
WHERE interaction_type = 'liked';

COMMENT ON COLUMN bottles.likes_count IS '愛心數量快取';
