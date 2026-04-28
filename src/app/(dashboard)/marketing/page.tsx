import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'
import DBMarketingTab from './DBMarketingTab'
import CreativeTab from './CreativeTab'

type TabKey =
  | 'nms-channel' | 'nms-creative' | 'nms-dashboard'
  | 'cert-channel' | 'cert-creative' | 'cert-dashboard'
  | 'abroad-channel' | 'abroad-creative' | 'abroad-dashboard'

type DivKey = 'nms' | 'cert' | 'abroad'

const TAB_META: Record<TabKey, { division: string; divisionKey: DivKey; feature: string; kind: 'channel' | 'creative' | 'dashboard' }> = {
  'nms-channel':      { division: '학점은행제', divisionKey: 'nms',    feature: '채널별 성과', kind: 'channel' },
  'nms-creative':     { division: '학점은행제', divisionKey: 'nms',    feature: '소재별 성과', kind: 'creative' },
  'nms-dashboard':    { division: '학점은행제', divisionKey: 'nms',    feature: '대시보드',     kind: 'dashboard' },
  'cert-channel':     { division: '민간자격증', divisionKey: 'cert',   feature: '채널별 성과', kind: 'channel' },
  'cert-creative':    { division: '민간자격증', divisionKey: 'cert',   feature: '소재별 성과', kind: 'creative' },
  'cert-dashboard':   { division: '민간자격증', divisionKey: 'cert',   feature: '대시보드',     kind: 'dashboard' },
  'abroad-channel':   { division: '유학',      divisionKey: 'abroad', feature: '채널별 성과', kind: 'channel' },
  'abroad-creative':  { division: '유학',      divisionKey: 'abroad', feature: '소재별 성과', kind: 'creative' },
  'abroad-dashboard': { division: '유학',      divisionKey: 'abroad', feature: '대시보드',     kind: 'dashboard' },
}

const ALL_TABS = Object.keys(TAB_META) as TabKey[]

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export const metadata = { title: '마케팅개발본부' }

export default async function MarketingPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const resolved = await searchParams
  const rawTab = resolved.tab ?? 'nms-channel'
  const activeTab: TabKey = ALL_TABS.includes(rawTab as TabKey)
    ? (rawTab as TabKey)
    : 'nms-channel'
  const meta = TAB_META[activeTab]

  return (
    <div className={styles.page_wrap}>
      {/* 소재별 성과는 자체 헤더가 있어서 페이지 헤더 숨김 */}
      {meta.kind !== 'creative' && (
        <div className={styles.page_header}>
          <h1 className={styles.page_title}>
            <span className={styles.page_division}>{meta.division}</span>
            <span className={styles.page_feature}>{meta.feature}</span>
          </h1>
        </div>
      )}

      <div className={styles.tab_content}>
        {meta.kind === 'channel' && (
          <Suspense fallback={<div className={styles.loading}>데이터 로딩 중...</div>}>
            <DBMarketingTab division={meta.divisionKey} divisionLabel={meta.division} />
          </Suspense>
        )}
        {meta.kind === 'creative' && (
          <CreativeTab division={meta.division} />
        )}
        {meta.kind === 'dashboard' && (
          <div className={styles.placeholder}>
            <p className={styles.placeholder_emoji}>📊</p>
            <p className={styles.placeholder_title}>{meta.division} 대시보드</p>
            <p className={styles.placeholder_text}>준비 중인 페이지입니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
