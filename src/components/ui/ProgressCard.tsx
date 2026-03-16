interface ProgressRow {
  name: string
  recent30: number
  total: number
  isHighlight?: boolean
}

interface ProgressCardProps {
  title?: string
  rows: ProgressRow[]
}

/**
 * 담당자별 진행률을 표시하는 카드 컴포넌트.
 * 추후 실제 데이터 연동 시 rows prop으로 주입.
 */
export default function ProgressCard({
  title = '담당자별 진행률',
  rows,
}: ProgressCardProps) {
  return (
    <div style={{
      background: 'var(--toss-card-bg)',
      border: '1px solid var(--toss-border)',
      borderRadius: 'var(--toss-radius-card)',
      padding: '16px 20px',
      boxShadow: 'var(--toss-shadow-card)',
    }}>
      <p style={{
        fontWeight: 600,
        fontSize: 13,
        marginBottom: 12,
        color: 'var(--toss-text-primary)',
      }}>
        {title}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left',
              color: 'var(--toss-text-secondary)',
              fontWeight: 500,
              paddingBottom: 8,
              width: '50%',
            }} />
            <th style={{
              textAlign: 'right',
              color: 'var(--toss-text-secondary)',
              fontWeight: 500,
              paddingBottom: 8,
            }}>
              근 30일
            </th>
            <th style={{
              textAlign: 'right',
              color: 'var(--toss-text-secondary)',
              fontWeight: 500,
              paddingBottom: 8,
            }}>
              전체
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{
                padding: '5px 0',
                fontWeight: row.isHighlight ? 600 : 400,
                color: row.isHighlight ? 'var(--toss-text-primary)' : 'var(--toss-text-secondary)',
              }}>
                {row.name}
              </td>
              <td style={{
                textAlign: 'right',
                color: row.isHighlight ? 'var(--toss-blue)' : 'var(--toss-text-secondary)',
                fontWeight: row.isHighlight ? 600 : 400,
              }}>
                {row.recent30}%
              </td>
              <td style={{
                textAlign: 'right',
                color: 'var(--toss-text-secondary)',
              }}>
                {row.total}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
