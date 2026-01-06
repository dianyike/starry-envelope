import Link from 'next/link'
import { Meteors } from '@/components/ui/meteors'

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-white">服務條款</h1>
          <p className="text-white/60">最後更新日期：2025 年 1 月 6 日</p>

          <p className="text-white/80">
            歡迎使用「星夜信封」（以下簡稱「本服務」）。使用本服務即表示您同意以下條款。
          </p>

          <h2 className="text-xl font-semibold text-white">1. 服務說明</h2>
          <p className="text-white/80">
            本服務是一個匿名漂流瓶平台，讓用戶可以匿名發送和接收訊息。
          </p>

          <h2 className="text-xl font-semibold text-white">2. 使用規範</h2>
          <p className="text-white/80">使用本服務時，您同意：</p>
          <ul className="text-white/80">
            <li><strong>不發送違法內容</strong> - 包括但不限於：色情、暴力、恐嚇、詐騙、仇恨言論</li>
            <li><strong>不騷擾他人</strong> - 不發送騷擾、霸凌或惡意攻擊的訊息</li>
            <li><strong>不散布個人資訊</strong> - 不發送他人的個人資料、聯絡方式</li>
            <li><strong>不進行商業行為</strong> - 不發送廣告、推銷或其他商業訊息</li>
            <li><strong>不濫用系統</strong> - 不使用自動化工具大量發送訊息</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">3. 內容責任</h2>
          <ul className="text-white/80">
            <li>用戶對自己發送的內容負完全責任</li>
            <li>我們不對用戶發送的內容進行事先審查</li>
            <li>我們保留刪除違規內容的權利</li>
            <li>嚴重違規者可能被永久禁止使用本服務</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">4. 檢舉機制</h2>
          <ul className="text-white/80">
            <li>用戶可以檢舉不當內容</li>
            <li>我們會審查檢舉並採取適當措施</li>
            <li>檢舉功能僅供正當使用，不得濫用</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">5. 免責聲明</h2>
          <ul className="text-white/80">
            <li>本服務按「現狀」提供，不提供任何明示或暗示的保證</li>
            <li>我們不保證服務不中斷或無錯誤</li>
            <li>我們不對用戶之間的互動負責</li>
            <li>我們不對因使用本服務造成的任何損失負責</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">6. 服務變更</h2>
          <ul className="text-white/80">
            <li>我們保留隨時修改、暫停或終止服務的權利</li>
            <li>條款變更將在網站上公布，繼續使用即表示同意新條款</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">7. 智慧財產權</h2>
          <ul className="text-white/80">
            <li>本服務的程式碼採用 MIT 授權開源</li>
            <li>用戶發送的內容，其著作權歸原作者所有</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">8. 適用法律</h2>
          <p className="text-white/80">
            本條款受中華民國法律管轄。
          </p>

          <h2 className="text-xl font-semibold text-white">聯絡我們</h2>
          <p className="text-white/80">
            如有任何問題，請透過 GitHub Issues 聯繫我們。
          </p>
        </article>
      </div>
    </div>
  )
}
