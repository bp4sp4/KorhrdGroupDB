// 신한 거래내역에서 고정비 매칭 로직 (클라/서버 공용)

import fixedCostsData from '@/data/fixed-costs.json'

export interface FixedCost {
  day: number | null
  description: string
  amount: number
  note: string
  company: string
  autopay: boolean
}

export const FIXED_COSTS: FixedCost[] = fixedCostsData as FixedCost[]

const STOPWORDS = new Set([
  '주식회사', '주식', '회사', '한평생그룹', '한평생교육', '한평생', '에듀바이저스',
  '본사', '본점', '지사', '강남', '창동', '의정부', '방학동', '오피스',
  '임차료', '결제', '요금', '계산서', '선발행', '매월', '말일', '관리비', '익월',
  '한평', '한평생교육원', '한평생그룹교육', '학생관리팀', '민간', '업무폰',
])

export function extractKeywords(desc: string): string[] {
  const tokens = desc
    .split(/[\s\-()\[\].·_,/]+/)
    .map(t => t.trim())
    .filter(Boolean)
  const result: string[] = []
  for (const tk of tokens) {
    if (tk.length < 2) continue
    if (STOPWORDS.has(tk)) continue
    if (/^\d+$/.test(tk) && tk.length >= 8) continue
    result.push(tk)
  }
  return result
}

export interface TxLike {
  trdate: string
  accOut: string
  remark1?: string
  remark2?: string
  remark3?: string
}

export function matchFixedCost(tx: TxLike): FixedCost | null {
  const out = parseInt(tx.accOut)
  if (!out || out <= 0) return null
  const txDay = tx.trdate?.length >= 8 ? parseInt(tx.trdate.slice(6, 8)) : null
  const txText = [tx.remark1, tx.remark2, tx.remark3].filter(Boolean).join(' ').toLowerCase()

  const amountMatches = FIXED_COSTS.filter(f => f.amount === out)
  if (amountMatches.length === 0) return null

  const nameMatches = amountMatches
    .map(f => {
      const kws = extractKeywords(f.description)
      const hits = kws.filter(kw => txText.includes(kw.toLowerCase()))
      return { f, hits: hits.length, kws }
    })
    .filter(x => x.hits > 0)

  if (nameMatches.length === 0) return null

  nameMatches.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits
    if (txDay !== null) {
      const da = Math.abs((a.f.day ?? 99) - txDay)
      const db = Math.abs((b.f.day ?? 99) - txDay)
      return da - db
    }
    return 0
  })
  return nameMatches[0].f
}
