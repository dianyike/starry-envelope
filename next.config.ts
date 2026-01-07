import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔒 SEC-004: 安全 HTTP 標頭配置
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 防止點擊劫持 (Clickjacking)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // 防止 MIME 類型嗅探
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // XSS 保護（瀏覽器內建）
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // 強制 HTTPS（生產環境，1 年有效期）
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          // 注意：使用較寬鬆的政策以相容 Next.js 和現有功能
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js 需要 unsafe-inline 和 unsafe-eval
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com",
              // Tailwind CSS 和動態樣式需要 unsafe-inline
              "style-src 'self' 'unsafe-inline'",
              // 允許 data: URI 用於圖片和字型
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              // Supabase 連線
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live https://va.vercel-scripts.com",
              // 禁止嵌入 iframe
              "frame-ancestors 'none'",
              // 表單提交目標
              "form-action 'self'",
              // 基礎 URI
              "base-uri 'self'",
            ].join('; '),
          },
          // Referrer 政策
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 權限政策（禁用不需要的瀏覽器功能）
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
