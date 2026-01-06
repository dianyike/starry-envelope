-- 建立解鎖暗號瓶的 RPC 函數
-- SECURITY DEFINER 讓函數以創建者權限執行，繞過 RLS 來驗證暗號
CREATE OR REPLACE FUNCTION unlock_secret_bottle(code TEXT)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  author_name TEXT,
  content TEXT,
  image_url TEXT,
  bottle_type bottle_type,
  city TEXT,
  is_pushable BOOLEAN,
  relay_count INTEGER,
  status bottle_status,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_bottle_id UUID;
  current_user_id UUID;
BEGIN
  -- 取得當前用戶 ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 找到符合暗號的漂流中暗號瓶（排除自己的）
  SELECT b.id INTO target_bottle_id
  FROM bottles b
  WHERE b.bottle_type = 'secret'
    AND b.status = 'floating'
    AND b.secret_code = code
    AND b.author_id <> current_user_id
  ORDER BY b.created_at DESC
  LIMIT 1;

  -- 如果沒找到，回傳空結果
  IF target_bottle_id IS NULL THEN
    RETURN;
  END IF;

  -- 建立授權記錄（如果已存在則忽略）
  INSERT INTO bottle_access (user_id, bottle_id)
  VALUES (current_user_id, target_bottle_id)
  ON CONFLICT (user_id, bottle_id) DO NOTHING;

  -- 回傳瓶子（不含 secret_code）
  RETURN QUERY
  SELECT
    b.id,
    b.author_id,
    b.author_name,
    b.content,
    b.image_url,
    b.bottle_type,
    b.city,
    b.is_pushable,
    b.relay_count,
    b.status,
    b.created_at
  FROM bottles b
  WHERE b.id = target_bottle_id;
END;
$$;

-- 只允許已認證用戶呼叫此函數
REVOKE ALL ON FUNCTION unlock_secret_bottle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unlock_secret_bottle(TEXT) TO authenticated;
