import { ExternalLink } from 'lucide-react'
import styles from './page.module.css'

const LINK_GROUPS = [
  {
    category: '학점은행제',
    color: 'blue',
    links: [
      { label: '신청사이트', href: 'https://barosocial.vercel.app/', desc: '학점은행제 무료상담 신청' },
      { label: '맘카페 전용', href: 'https://korhrd-social-momcafe.vercel.app/', desc: '맘카페 전용 랜딩페이지' },
    ],
  },
  {
    category: '민간자격증',
    color: 'green',
    links: [
      { label: '당근/네이버/인스타', href: 'https://baroprivtecert.vercel.app/', desc: '채널별 무료상담 신청' },
      { label: '맘카페 전용', href: 'https://baro-privatecert-momcafe.vercel.app/', desc: '맘카페 전용 랜딩페이지' },
    ],
  },
  {
    category: '취업자격증',
    color: 'purple',
    links: [
      { label: '연계 신청', href: 'https://creditbridge-two.vercel.app/', desc: '취업자격증 연계 신청 서비스' },
      { label: '발급비 선납', href: 'https://creditprepayment.vercel.app/', desc: '취업자격증 발급비 선납' },
    ],
  },
  {
    category: '상담 · 취업',
    color: 'orange',
    links: [
      { label: '기본상담품', href: 'https://barobasic.vercel.app/', desc: '기본 상담 신청 페이지' },
      { label: '실습신청품', href: 'https://prikorhrd.vercel.app/', desc: '실습 신청 페이지' },
      { label: '취업신청품', href: 'https://barojob.vercel.app/', desc: '취업 신청 페이지' },
    ],
  },
  {
    category: '시스템',
    color: 'gray',
    links: [
      { label: '교육원 통합관리', href: 'https://education-system-one-nu.vercel.app/', desc: '교육원 통합 관리 시스템' },
    ],
  },
]

export default function LinksPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>링크모음</h1>
        <p className={styles.subtitle}>자주 사용하는 사이트 바로가기</p>
      </div>

      <div className={styles.groups}>
        {LINK_GROUPS.map((group) => (
          <div key={group.category} className={styles.group}>
            <div className={`${styles.groupHeader} ${styles[`color_${group.color}`]}`}>
              <span className={styles.groupCategory}>{group.category}</span>
              <span className={styles.groupCount}>{group.links.length}개</span>
            </div>
            <div className={styles.cards}>
              {group.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.card}
                >
                  <div className={styles.cardBody}>
                    <span className={styles.cardLabel}>{link.label}</span>
                    <span className={styles.cardDesc}>{link.desc}</span>
                    <span className={styles.cardUrl}>{link.href.replace('https://', '')}</span>
                  </div>
                  <ExternalLink size={14} className={styles.cardIcon} />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
