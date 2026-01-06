-- 優化 fishBottle 查詢：以 user_id 和 interaction_type 篩選
CREATE INDEX IF NOT EXISTS idx_bottle_interactions_user_type
ON bottle_interactions (user_id, interaction_type);

-- 優化查詢特定瓶子的互動記錄
CREATE INDEX IF NOT EXISTS idx_bottle_interactions_bottle_id
ON bottle_interactions (bottle_id);
