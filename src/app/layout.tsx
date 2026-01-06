import type { Metadata } from 'next'
import { Noto_Sans_TC } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const notoSansTC = Noto_Sans_TC({
  variable: '--font-noto-sans-tc',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  ),
  title: '星夜信封 - Starry Envelope',
  description: '在星空下的碼頭，等待來自遠方的信',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: '星夜信封 - Starry Envelope',
    description: '在星空下的碼頭，等待來自遠方的信',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary',
    title: '星夜信封 - Starry Envelope',
    description: '在星空下的碼頭，等待來自遠方的信',
    images: ['/logo.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-TW">
      <body className={`${notoSansTC.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
