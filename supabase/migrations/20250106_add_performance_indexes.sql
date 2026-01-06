-- 優化 fishBottle 查詢：以 status 和 created_at 篩選排序
CREATE INDEX IF NOT EXISTS idx_bottles_status_created_at
ON bottles (status, created_at DESC);

-- 優化 fishBottle 暗號瓶查詢：以 bottle_type, status, secret_code 篩選
CREATE INDEX IF NOT EXISTS idx_bottles_secret_fishing
ON bottles (bottle_type, status, secret_code)
WHERE bottle_type = 'secret';

-- 優化 getMyBottles 查詢：以 author_id 和 created_at 篩選排序
CREATE INDEX IF NOT EXISTS idx_bottles_author_created_at
ON bottles (author_id, created_at DESC);

-- 優化 getBeachBottles 查詢：以 user_id 和 created_at 篩選排序
CREATE INDEX IF NOT EXISTS idx_beach_user_created_at
ON beach (user_id, created_at DESC);

-- 優化 getUnreadRepliesCount 查詢：以 is_read 和 bottle_id 篩選
CREATE INDEX IF NOT EXISTS idx_replies_unread
ON replies (bottle_id, is_read)
WHERE is_read = false;

-- 優化 markRepliesAsRead 查詢：以 bottle_id 篩選
CREATE INDEX IF NOT EXISTS idx_replies_bottle_id
ON replies (bottle_id);
