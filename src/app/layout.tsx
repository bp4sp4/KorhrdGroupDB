import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: '한평생교육 - 학점은행제 통합 관리',
  description: '학점은행제 통합 관리 시스템',
  openGraph: {
    title: '한평생교육 - 학점은행제 통합 관리',
    description: '학점은행제 통합 관리 시스템',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '한평생교육 - 학점은행제 통합 관리',
    description: '학점은행제 통합 관리 시스템',
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
