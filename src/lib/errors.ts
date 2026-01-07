/**
 * 資料庫錯誤清理
 * 將敏感的資料庫錯誤訊息轉換為安全的用戶友善訊息
 * 防止洩漏內部實作細節
 */

interface DbError {
  message: string
  code?: string
  details?: string
  hint?: string
}

// PostgreSQL 錯誤碼對應的安全訊息
const ERROR_CODE_MAP: Record<string, string> = {
  // 完整性約束違反
  '23505': '資料已存在',            // unique_violation
  '23503': '參考的資料不存在',       // foreign_key_violation
  '23502': '必填欄位未填寫',         // not_null_violation
  '23514': '資料驗證失敗',           // check_violation
  '23000': '資料完整性錯誤',         // integrity_constraint_violation

  // 權限錯誤
  '42501': '權限不足',              // insufficient_privilege
  '42000': '語法錯誤',              // syntax_error_or_access_rule_violation

  // 資源錯誤
  '53000': '系統資源不足',          // insufficient_resources
  '53100': '磁碟空間不足',          // disk_full
  '53200': '記憶體不足',            // out_of_memory
  '53300': '連線數過多',            // too_many_connections

  // 操作錯誤
  '40001': '交易衝突，請重試',       // serialization_failure
  '40P01': '發生死鎖，請重試',       // deadlock_detected

  // RLS 相關
  'PGRST301': '權限不足',           // RLS policy violation
}

// 常見錯誤訊息模式對應的安全訊息
const ERROR_MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/duplicate key/i, '資料已存在'],
  [/violates foreign key/i, '參考的資料不存在'],
  [/violates check constraint/i, '資料驗證失敗'],
  [/permission denied/i, '權限不足'],
  [/row-level security/i, '權限不足'],
  [/JWT expired/i, '登入已過期，請重新整理頁面'],
  [/not authenticated/i, '請先登入'],
  [/rate limit/i, '請求過於頻繁，請稍後再試'],
]

/**
 * 清理資料庫錯誤，返回安全的用戶友善訊息
 * @param error - 資料庫錯誤物件
 * @param fallback - 預設訊息（選填）
 * @returns 安全的錯誤訊息
 */
export function sanitizeDbError(
  error: DbError | { message: string },
  fallback = '操作失敗，請稍後再試'
): string {
  // 記錄完整錯誤到 console（生產環境應整合到監控系統）
  console.error('[DB Error]', {
    message: error.message,
    code: 'code' in error ? error.code : undefined,
    details: 'details' in error ? error.details : undefined,
    hint: 'hint' in error ? error.hint : undefined,
  })

  // 1. 先檢查錯誤碼
  if ('code' in error && error.code && ERROR_CODE_MAP[error.code]) {
    return ERROR_CODE_MAP[error.code]
  }

  // 2. 檢查錯誤訊息模式
  for (const [pattern, message] of ERROR_MESSAGE_PATTERNS) {
    if (pattern.test(error.message)) {
      return message
    }
  }

  // 3. 返回預設訊息（不洩漏原始錯誤）
  return fallback
}

/**
 * 專門處理 Supabase RPC 錯誤
 * 某些 RPC 會拋出自訂的錯誤訊息，這些是安全的可以直接顯示
 */
const SAFE_RPC_ERRORS = new Set([
  'No fishing nets remaining',
  'No bottles available',
  'Too many attempts. Please try again later.',
  'Not authenticated',
  'Not the current holder',
  'Content cannot be empty',
  'Content too long (max 140 characters)',
  'Bottle not found',
  'Not a relay bottle',
])

/**
 * 處理 RPC 錯誤
 * 對於已知的安全錯誤訊息，轉換為中文後返回
 * @param error - RPC 錯誤物件
 * @returns 安全的錯誤訊息
 */
export function sanitizeRpcError(
  error: { message: string },
  fallback = '操作失敗，請稍後再試'
): string {
  console.error('[RPC Error]', error.message)

  // 已知的安全錯誤訊息映射
  const rpcErrorMap: Record<string, string> = {
    'No fishing nets remaining': '今日漁網已用完，明天再來吧！',
    'No bottles available': '海裡沒有瓶子了，稍後再試試吧！',
    'Too many attempts. Please try again later.': '嘗試次數過多，請一小時後再試',
    'Not authenticated': '請先登入',
    'Not the current holder': '你不是當前傳遞者',
    'Content cannot be empty': '內容不能為空',
    'Content too long (max 140 characters)': '回覆最多 140 字',
    'Bottle not found': '找不到瓶子',
    'Not a relay bottle': '這不是傳遞瓶',
  }

  if (rpcErrorMap[error.message]) {
    return rpcErrorMap[error.message]
  }

  // 檢查是否為安全的錯誤訊息
  if (SAFE_RPC_ERRORS.has(error.message)) {
    return error.message
  }

  // 使用通用錯誤清理
  return sanitizeDbError(error, fallback)
}
