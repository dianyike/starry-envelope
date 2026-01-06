# Changelog

所有重要變更都會記錄在此文件中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [1.9.1] - 2026-01-08

### Fixed

- **修復愛心數量同步錯誤**
  - 問題：點讚後顯示 0，取消變成 -1
  - 原因：`handleLike()` 成功時沒有使用伺服器返回的真實 `likesCount`
  - 修正：成功時用 `result.liked` 和 `result.likesCount` 同步本地狀態
- **優化愛心按鈕連點體驗**
  - 移除 `disabled={isLiking}` 讓 UI 立即響應
  - 保留 `isLiking` 檢查防止重複 API 呼叫
  - Optimistic update + 伺服器校正確保數據正確

---

## [1.9.0] - 2026-01-08

### Added

- **愛心點讚功能**
  - 瓶子內容下方顯示愛心按鈕與數量
  - 每人對同一瓶子只能點一次，可取消
  - 點讚動畫效果（Motion spring bounce）
  - 「我的瓶子」頁面顯示各瓶愛心數量
- **新增 Server Actions**
  - `toggleLikeBottle(bottleId)` - 點讚/取消點讚
  - `hasLikedBottle(bottleId)` - 檢查是否已點讚
- **新增互動類型**
  - `liked` - 愛心點讚（加入 `interaction_type` enum）
- **資料庫 Trigger**
  - `update_bottle_likes_count` - 自動維護 `bottles.likes_count` 快取欄位

### Fixed

- **修復 `fish_bottle` RPC `city` 欄位歧義**
  - RETURNS TABLE 的 `city` 與查詢中的 `b.city` 衝突
  - 將表別名從 `b` 改為 `bot`
- **修復 `unlock_secret_bottle` RPC `id` 欄位歧義**
  - 同樣的 RETURNS TABLE 欄位衝突問題
  - 新增 `likes_count` 到返回欄位

### Database Migrations

- `20250108_fix_fish_bottle_city_ambiguous.sql` - 修復 city 歧義
- `20250108_add_bottle_likes.sql` - 愛心功能（likes_count + trigger）
- `20250108_update_fish_bottle_add_likes_count.sql` - fish_bottle 返回 likes_count
- `20250108_fix_unlock_secret_bottle_ambiguous.sql` - 修復 id 歧義 + likes_count

---

## [1.8.0] - 2026-01-06

### Added

- **Terms and Privacy Pages**
  - `/terms` - Service terms page (Chinese)
  - `/privacy` - Privacy policy page (Chinese)
  - Footer links on home page (Terms, Privacy, GitHub)
- **Documentation Files**
  - `README.md` - Project introduction with cover image
  - `LICENSE` - MIT License
  - `TERMS.md` - Service terms (Chinese)
  - `PRIVACY.md` - Privacy policy (Chinese)
  - `.env.example` - Environment variables template

### Changed

- **Performance Optimization**
  - `getAuthUserId()` now accepts existing Supabase client to avoid duplicate connections
  - `getUserProfile()` uses `upsert` to reduce queries from 2 to 1
  - All server actions reuse the same Supabase client
  - Beach and Profile dialogs load significantly faster

### Removed

- `user.ts` wrapper function (now using `getAuthUserId()` directly from server.ts)

---

## [1.7.1] - 2026-01-07

### Changed

- **扔瓶子對話框自動帶入暱稱**
  - 開啟時自動填入個人資料的暱稱
  - 用戶仍可修改或清空使用「匿名」
  - 提交後重設為暱稱而非清空

### Fixed

- 修復 `updateProfile` TypeScript 類型錯誤（`null` vs `undefined`）

### Removed

- 清理空資料夾 `src/components/bottle`、`src/components/layout`

---

## [1.7.0] - 2026-01-07

### Added

- **同縣市瓶配對**
  - 用戶可在「個人資料」設定所在縣市
  - 撈瓶時優先配對同縣市的 `local` 瓶子
  - 未設定縣市則按普通瓶處理
- **傳遞瓶完整機制**
  - 撈到傳遞瓶顯示完整對話鏈（所有歷史回覆）
  - 回覆後瓶子自動繼續漂流，`relay_count` 累加
  - 使用 `current_holder_id` 追蹤當前傳遞者
  - 扔回海裡/厭惡時釋放 holder，讓瓶子繼續漂流
- **ProfileDialog 組件**
  - 暱稱設定
  - 縣市下拉選單（台灣 22 縣市）
  - 顯示剩餘漁網數量
- **新增 Server Actions**
  - `updateProfile(nickname, city)` - 更新個人資料
  - `replyToRelayBottle(bottleId, content)` - 傳遞瓶回覆
  - `getRelayBottleReplies(bottleId)` - 取得傳遞瓶對話鏈
- **新增 RPC 函數**
  - `relay_bottle_reply` - 傳遞瓶回覆（SECURITY DEFINER）
  - `release_relay_bottle` - 釋放傳遞瓶 holder

### Changed

- `fish_bottle` RPC 更新
  - 同縣市瓶優先配對（ORDER BY CASE）
  - 撈到傳遞瓶時設定 `current_holder_id`
- `FishBottleDialog` 支援傳遞瓶
  - 顯示對話鏈（歷史回覆）
  - 顯示已傳遞次數
  - 回覆按鈕文字改為「傳遞」
- `throwBackBottle`、`dislikeBottle` 修改
  - 傳遞瓶呼叫 `release_relay_bottle` RPC 釋放 holder
- 導航列新增「個人資料」選項

### Database Migrations

- `20250107_update_fish_bottle_for_local.sql` - 同縣市配對 + 傳遞瓶 holder 追蹤
- `20250107_add_relay_bottle_support.sql` - bottles 新增 `current_holder_id` 欄位 + RLS 更新
- `20250107_create_relay_bottle_rpc.sql` - 傳遞瓶回覆與釋放 RPC

---

## [1.6.0] - 2026-01-06

### Added

- **瓶子管理功能**
  - 收回瓶子：將漂流中的瓶子收回（`retrieved` 狀態）
  - 重新漂流：將已收回的瓶子重新放回海中
  - 刪除瓶子：永久刪除已收回的瓶子（含相關回覆與互動記錄）
  - 刪除前二次確認對話框（AlertDialog）
- **fish_bottle RPC 函數**：優化撈瓶子效能
  - 一次資料庫呼叫完成所有邏輯
  - 從 5-9 次往返減少到 1 次
  - 預期延遲從 1.5-20s 降至 100-300ms
- **撈瓶子排除機制**
  - 排除已標記「厭惡」的瓶子
  - 排除已「檢舉」的瓶子
  - 排除已「扔回海裡」的瓶子
- **漁網扣除優化**
  - 已撈過的瓶子不重複扣漁網
  - 暗號瓶每次都扣漁網
- **bottle_interactions 索引**
  - `idx_bottle_interactions_user_type` - 用戶互動類型查詢
  - `idx_bottle_interactions_bottle_id` - 瓶子互動記錄查詢
- **BottleStatus 新增 `retrieved` 狀態**
- **bottles DELETE RLS 政策**：只能刪除已收回的自己的瓶子
- **alert-dialog 組件**：shadcn/ui 確認對話框

### Changed

- Toast 通知位置從右下改為中上方
- `fishBottle` Server Action 重構為呼叫 RPC
- 「扔回海裡」與「繼續撈瓶子」明確區分
  - 扔回海裡：記錄互動，之後排除
  - 繼續撈瓶子：不記錄，可能再撈到但不扣漁網

### Fixed

- 修復標記厭惡/檢舉後仍會撈到同一瓶子的問題
- 修復撈到重複瓶子浪費漁網次數的問題

### Database Migrations

- `add_retrieved_status` - BottleStatus enum 新增 retrieved
- `add_bottle_interactions_index` - 互動記錄索引
- `create_fish_bottle_rpc` - 撈瓶子 RPC 函數
- `add_bottles_delete_policy` - 瓶子刪除 RLS 政策

---

## [1.5.0] - 2026-01-06

### Added

- **首頁標題特效**：新增響應式標題與副標題
  - 標題：「在宇宙與海之間，寄一封自己」
  - 副標題：「把你的心意裝瓶，讓海替你傳遞」
  - 使用 Highlighter 組件實現手繪標註效果（underline、highlight）
- **Highlighter 組件**：安裝 @magicui/highlighter
  - 基於 rough-notation 的手繪風格標註
  - 支援 highlight、underline、circle、box 等效果

### Changed

- 表情符號改為 Lucide 圖示
  - 🎣 → `FishingHook`（撈瓶子）
  - 🍾 → `BottleWine`（我的瓶子）
  - 🏝️ → `TreePalm`（海灘）

### Removed

- **獨立頁面移除**：刪除 `src/app/(main)/` 目錄
  - ~~`/throw`~~ → 使用 `ThrowBottleDialog`
  - ~~`/fish`~~ → 使用 `FishBottleDialog`
  - ~~`/my-bottles`~~ → 使用 `MyBottlesDialog`
  - ~~`/beach`~~ → 使用 `BeachDialog`
- **未使用元件清理**：
  - `ui/avatar.tsx`
  - `ui/dropdown-menu.tsx`
  - `ui/tabs.tsx`
  - `ui/sheet.tsx`
  - `ocean-waves.tsx`
  - `starry-effect.tsx`

### Dependencies

- 新增 `rough-notation`：手繪標註動畫庫

---

## [1.4.0] - 2026-01-06

### Added

- **StaggeredMenu 導覽列**：全新 GSAP 動畫導覽列
  - 毛玻璃效果（backdrop-blur）
  - 側邊滑出面板動畫
  - 項目編號（01, 02, 03, 04）淡入效果
  - Menu/Close 按鈕旋轉動畫
  - 點擊外部自動關閉
- **SparklesText 特效**：Logo「星夜信封」文字加上星星閃爍動畫
  - 使用 Motion (Framer Motion) 實現
  - 可自訂星星顏色和數量
- **Noto Sans TC 字體**：全站改用思源黑體繁體中文
- **台灣縣市選單**：同縣市瓶改為下拉選單
  - 限定台灣 22 縣市
  - 從自由輸入改為 Select 組件
- **Sheet 組件**：安裝 shadcn/ui sheet（側邊欄）

### Changed

- 所有頁面統一使用星空背景（`starry-pier.png`）
- Card 組件加上毛玻璃效果（`bg-white/90 backdrop-blur`）
- 導覽列響應式設計
  - 桌面版：固定在頂部的毛玻璃導覽列
  - 手機版：漢堡選單 + 全螢幕側邊面板
- 主內容區加上 `pt-24` 避免被導覽列遮擋

### Removed

- `navbar.tsx`：舊版導覽列已移除（功能整合至 `staggered-menu.tsx`）

### Dependencies

- 新增 `gsap`：GSAP 動畫庫
- 新增 `motion`：Framer Motion（SparklesText 使用）

---

## [1.3.0] - 2026-01-06

### Added

- 暗號瓶完整功能
  - 撈瓶子對話框新增暗號輸入欄位
  - 輸入暗號可搜尋對應的暗號瓶
  - 不輸入暗號則撈取普通瓶子（排除暗號瓶）
- `bottle_access` 授權表
  - 記錄用戶已解鎖的暗號瓶
  - RLS 僅允許 SELECT/DELETE 自己的記錄
  - INSERT 只能透過 RPC 執行
- `unlock_secret_bottle` RPC 函數
  - SECURITY DEFINER 繞過 RLS 驗證暗號
  - 驗證成功才寫入授權並回傳瓶子
  - 回傳欄位不含 `secret_code`
- zod 輸入驗證
  - `throwBottle`: 內容最多 500 字、名稱最多 20 字
  - `replyToBottle`: 內容最多 140 字
  - `reportBottle`: 原因最多 200 字
  - `fishBottle`: 暗號最多 50 字
- 資料庫效能索引
  - `idx_bottles_status_created_at` - fishBottle 查詢
  - `idx_bottles_secret_fishing` - 暗號瓶查詢（部分索引）
  - `idx_bottles_author_created_at` - getMyBottles 查詢
  - `idx_beach_user_created_at` - getBeachBottles 查詢
  - `idx_replies_unread` - getUnreadRepliesCount 查詢
  - `idx_replies_bottle_id` - markRepliesAsRead 查詢
- `supabase/migrations/` 目錄
  - 所有資料庫變更以 SQL 檔案記錄
  - 新環境可重現完整資料庫結構

### Changed

- 瓶子內容長度從 140 字改為 500 字
  - 後端 zod schema 限制 500 字
  - 前端 throw-bottle-dialog 和 /throw 頁面同步更新
- `fishBottle` 查詢改用明確欄位（不再 `select('*')`）
- `Bottle` 型別移除 `secret_code` 欄位
- bottles RLS 政策更新
  - 暗號瓶需有 `bottle_access` 記錄才可見

### Security

- 暗號瓶三層保護
  - RLS：暗號瓶無法被直接 SELECT
  - RPC：只有正確暗號才能建立授權
  - App：Server Action 不回傳 `secret_code`
- 移除 `bottle_access` INSERT policy
  - 防止用戶直接寫入繞過暗號驗證
- Server Actions 輸入驗證
  - 防止超長字串或不合法值

---

## [1.2.1] - 2026-01-06

### Changed

- `proxy.ts` 重構：負責建立匿名 session（非僅刷新）
  - 偵測無 session 時執行 `signInAnonymously()`
  - 解決 Server Component 無法寫 cookie 導致每次產生新用戶的問題
- `getAuthUserId()` 簡化為只讀取 session，不再建立

### Fixed

- 修復新用戶首次訪問時 session 漂移問題（每次請求產生新匿名用戶）
- 修復 `signInAnonymously()` 錯誤被靜默吞掉的問題

### Security

- 加入 `signInAnonymously()` 完整錯誤處理
  - 驗證返回的 `data.user` 存在
  - 根據請求類型（HTML/JSON）返回適當錯誤回應
  - 加入 `Cache-Control: no-store` 防止 CDN 快取錯誤頁面
- 友善錯誤頁面支援 `text/html`、`text/x-component`（RSC）、`*/*`

---

## [1.2.0] - 2026-01-06

### Added

- 首頁對話框模式
  - 所有功能（扔瓶子、撈瓶子、我的瓶子、海灘）改用 Dialog 在首頁開啟
  - 新增 `ThrowBottleDialog`、`FishBottleDialog`、`MyBottlesDialog`、`BeachDialog` 組件
- 毛玻璃導航列
  - iOS 風格 `backdrop-blur-xl` 效果
  - 半透明背景 + 圓角設計
- Supabase Auth 匿名登入
  - 使用 `signInAnonymously()` 取代自訂 Cookie
  - 身分可信，RLS 可用 `auth.uid()` 做限制
- 嚴格 RLS 政策
  - profiles: 只能讀寫自己的資料
  - bottles: 只能建立自己的；可讀漂流中或自己的瓶子
  - replies: 已認證用戶可插入；只有瓶子作者可讀取/更新
  - beach: 只能讀寫自己的
  - bottle_interactions: 只能建立/讀取自己的互動
  - reports: 只能建立/讀取自己的檢舉

### Changed

- 導航列按鈕改為控制對話框，不再導航到新頁面
- `proxy.ts` 改為刷新 Supabase Auth session
- `user.ts` 簡化為呼叫 `getAuthUserId()`
- 未讀計數查詢優化為單一 JOIN（原本兩次查詢）

### Removed

- 移除 `uuid` 套件（不再需要自行生成用戶 ID）
- 移除舊的 `bottle_user_id` Cookie 機制

### Security

- RLS 政策從 `true`（無限制）改為基於 `auth.uid()` 的嚴格限制
- 用戶身分由 Supabase Auth JWT 驗證，無法偽造

---

## [1.1.0] - 2026-01-05

### Added

- 「我的瓶子」頁面 (`/my-bottles`)
  - 查看自己扔出去的瓶子
  - 查看收到的回覆內容
  - 標記回覆為已讀
- 共用導航列元件 (`Navbar`)
  - 統一各頁面導航
  - 當前頁面高亮顯示
  - 未讀回覆通知紅點
- 回覆已讀狀態追蹤
  - `replies` 表新增 `is_read` 欄位
  - 自動計算未讀回覆數量
- shadcn/ui Accordion 組件

### Changed

- 「同城瓶」更名為「同縣市瓶」
- 各頁面改用共用 `Navbar` 元件

### Fixed

- 新增 `replies` 表 UPDATE RLS 政策（修復標記已讀無效問題）

---

## [1.0.0] - 2026-01-05

### Added

- 初始化專案：Next.js 16.1.1 + Tailwind CSS v4 + shadcn/ui
- Supabase 資料庫整合
  - `profiles` 用戶資料表
  - `bottles` 漂流瓶資料表
  - `replies` 回覆資料表
  - `beach` 用戶海灘資料表
  - `bottle_interactions` 互動記錄表
  - `reports` 檢舉記錄表
  - Row Level Security (RLS) 政策
  - 圖片儲存 bucket (`bottle-images`)
- 匿名用戶系統
  - Cookie 識別用戶 (`bottle_user_id`)
  - 自動建立用戶 profile
  - 每日 6 次撈瓶機會
- 核心功能頁面
  - 首頁 (`/`)
  - 扔瓶子 (`/throw`)
  - 撈瓶子 (`/fish`)
  - 我的海灘 (`/beach`)
- 8 種瓶子類型
  - 普通瓶、同縣市瓶、提問瓶、祝願瓶
  - 發洩瓶、真話瓶、暗號瓶、傳遞瓶
- 瓶子互動功能
  - 回覆瓶子
  - 扔回海里
  - 標記厭惡
  - 檢舉不當內容
- shadcn/ui 組件
  - Button, Card, Input, Textarea, Label
  - Avatar, Badge, Dialog, Dropdown Menu
  - Select, Tabs, Sonner (Toast)

### Changed

- 從 Supabase Auth 改為 Cookie 匿名用戶系統
- `middleware.ts` 改名為 `proxy.ts`（Next.js 16 規範）

### Security

- 資料庫啟用 Row Level Security
- Cookie 設定 `httpOnly` 和 `secure` 屬性
