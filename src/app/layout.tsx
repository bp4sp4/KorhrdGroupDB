import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://korhrd-group-db.vercel.app'),
  title: '한평생오피스',
  description: '한평생오피스 사내 업무 통합 관리 시스템',
  openGraph: {
    title: '한평생오피스 - 한평생오피스 사내 업무 통합 관리 시스템',
    description: '한평생오피스 사내 업무 통합 관리 시스템',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '한평생오피스 - 한평생오피스 사내 업무 통합 관리 시스템',
    description: '한평생오피스 사내 업무 통합 관리 시스템',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
