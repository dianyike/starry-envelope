import Link from 'next/link'
import { Meteors } from '@/components/ui/meteors'

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/starry-pier.png')" }}
      />
      <div className="absolute inset-0 bg-black/60" />

      {/* Meteors */}
      <Meteors number={20} angle={208} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-white/70 transition-colors hover:text-white"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回首頁
        </Link>

        <article className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-white">隱私政策</h1>
          <p className="text-white/60">最後更新日期：2025 年 1 月 6 日</p>

          <p className="text-white/80">
            「星夜信封」（以下簡稱「本服務」）重視您的隱私。本政策說明我們如何收集、使用和保護您的資料。
          </p>

          <h2 className="text-xl font-semibold text-white">1. 資料收集</h2>

          <h3 className="text-lg font-medium text-white/90">我們收集的資料</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-white/80">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="py-2 text-left">資料類型</th>
                  <th className="py-2 text-left">說明</th>
                  <th className="py-2 text-left">用途</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/10">
                  <td className="py-2">匿名識別碼</td>
                  <td className="py-2">自動產生的 UUID</td>
                  <td className="py-2">識別您的帳號</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-2">暱稱</td>
                  <td className="py-2">您自行設定（選填）</td>
                  <td className="py-2">顯示在瓶子上</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-2">縣市</td>
                  <td className="py-2">您自行設定（選填）</td>
                  <td className="py-2">同縣市瓶配對</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-2">瓶子內容</td>
                  <td className="py-2">您發送的訊息</td>
                  <td className="py-2">提供服務功能</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-2">互動記錄</td>
                  <td className="py-2">撈瓶、回覆、檢舉等</td>
                  <td className="py-2">提供服務功能</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-medium text-white/90">我們不收集的資料</h3>
          <ul className="text-white/80">
            <li>真實姓名</li>
            <li>電子郵件</li>
            <li>電話號碼</li>
            <li>精確地理位置</li>
            <li>其他可識別個人身份的資訊</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">2. 匿名機制</h2>
          <ul className="text-white/80">
            <li>本服務採用 Supabase 匿名登入</li>
            <li>無需提供任何個人資訊即可使用</li>
            <li>您的匿名識別碼儲存在瀏覽器中</li>
            <li>清除瀏覽器資料將無法恢復帳號</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">3. 資料使用</h2>
          <p className="text-white/80">我們使用您的資料僅用於：</p>
          <ul className="text-white/80">
            <li>提供漂流瓶服務功能</li>
            <li>處理檢舉和維護社群安全</li>
            <li>改善服務品質</li>
          </ul>
          <p className="text-white/80">我們<strong>不會</strong>：</p>
          <ul className="text-white/80">
            <li>將您的資料出售給第三方</li>
            <li>使用您的資料進行廣告投放</li>
            <li>與其他服務共享您的資料</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">4. 資料儲存</h2>
          <ul className="text-white/80">
            <li>資料儲存於 Supabase（AWS 基礎設施）</li>
            <li>伺服器位於亞太地區（ap-northeast-1）</li>
            <li>資料傳輸使用 HTTPS 加密</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">5. 資料保留</h2>
          <ul className="text-white/80">
            <li>瓶子和回覆：用戶刪除後即移除</li>
            <li>檢舉記錄：保留用於安全審查</li>
            <li>帳號資料：長期不活躍可能自動清除</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">6. Cookie 使用</h2>
          <p className="text-white/80">本服務使用必要的 Cookie 來：</p>
          <ul className="text-white/80">
            <li>維持您的登入狀態</li>
            <li>儲存匿名識別碼</li>
          </ul>
          <p className="text-white/80">我們不使用追蹤型或廣告型 Cookie。</p>

          <h2 className="text-xl font-semibold text-white">7. 您的權利</h2>
          <p className="text-white/80">您可以：</p>
          <ul className="text-white/80">
            <li>刪除您發送的瓶子和回覆</li>
            <li>清除瀏覽器資料以移除本地帳號</li>
            <li>透過 GitHub Issues 請求刪除您的資料</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">8. 兒童隱私</h2>
          <p className="text-white/80">
            本服務不針對 13 歲以下兒童。如果我們發現收集了兒童資料，將立即刪除。
          </p>

          <h2 className="text-xl font-semibold text-white">9. 政策變更</h2>
          <p className="text-white/80">
            隱私政策變更將在網站上公布。重大變更時，我們會在服務中通知用戶。
          </p>

          <h2 className="text-xl font-semibold text-white">聯絡我們</h2>
          <p className="text-white/80">
            如有隱私相關問題，請透過 GitHub Issues 聯繫我們。
          </p>
        </article>
      </div>
    </div>
  )
}
