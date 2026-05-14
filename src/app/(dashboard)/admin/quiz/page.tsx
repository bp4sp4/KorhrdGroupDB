'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, RotateCcw, BookOpen, Shuffle } from 'lucide-react'
import styles from './page.module.css'
import {
  QUIZ_ITEMS,
  CATEGORY_LABELS,
  REFERENCE_ITEMS,
  type QuizCategory,
  type QuizItem,
} from './quizData'

type Mode = 'quiz' | 'reference'
type ResultMap = Record<number, 'known' | 'unknown' | undefined>
type AnswerMap = Record<number, string>

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuizPage() {
  const [mode, setMode] = useState<Mode>('quiz')
  const [filter, setFilter] = useState<QuizCategory | 'all'>('all')
  const [order, setOrder] = useState<QuizItem[]>(QUIZ_ITEMS)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<ResultMap>({})
  const [userAnswers, setUserAnswers] = useState<AnswerMap>({})

  const filtered = useMemo(
    () => (filter === 'all' ? order : order.filter((q) => q.category === filter)),
    [order, filter],
  )

  const current = filtered[index]
  const total = filtered.length

  const stats = useMemo(() => {
    const known = filtered.filter((q) => results[q.id] === 'known').length
    const unknown = filtered.filter((q) => results[q.id] === 'unknown').length
    return { known, unknown, remaining: total - known - unknown }
  }, [filtered, results, total])

  const go = (delta: number) => {
    setRevealed(false)
    setIndex((i) => Math.min(Math.max(i + delta, 0), total - 1))
  }

  const mark = (id: number, value: 'known' | 'unknown') => {
    setResults((r) => ({ ...r, [id]: value }))
    if (index < total - 1) go(1)
  }

  const reset = () => {
    setResults({})
    setUserAnswers({})
    setIndex(0)
    setRevealed(false)
    setOrder(QUIZ_ITEMS)
  }

  const handleShuffle = () => {
    setOrder(shuffle(QUIZ_ITEMS))
    setIndex(0)
    setRevealed(false)
  }

  const changeFilter = (next: QuizCategory | 'all') => {
    setFilter(next)
    setIndex(0)
    setRevealed(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>실사 대비 Q&amp;A 연습</h1>
          <p className={styles.subtitle}>
            교육원 실사 예상 질문 17개. 카드를 보고 답변을 떠올린 뒤 "정답 보기"로 확인하세요.
          </p>
        </div>
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'quiz' ? styles.modeTabActive : ''}`}
            onClick={() => setMode('quiz')}
          >
            문제 풀기
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'reference' ? styles.modeTabActive : ''}`}
            onClick={() => setMode('reference')}
          >
            <BookOpen size={14} /> 참고자료
          </button>
        </div>
      </div>

      {mode === 'quiz' ? (
        <>
          <div className={styles.toolbar}>
            <div className={styles.filterGroup}>
              <button
                type="button"
                className={`${styles.filterChip} ${filter === 'all' ? styles.filterChipActive : ''}`}
                onClick={() => changeFilter('all')}
              >
                전체 ({QUIZ_ITEMS.length})
              </button>
              {(Object.keys(CATEGORY_LABELS) as QuizCategory[]).map((cat) => {
                const count = QUIZ_ITEMS.filter((q) => q.category === cat).length
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`${styles.filterChip} ${filter === cat ? styles.filterChipActive : ''}`}
                    onClick={() => changeFilter(cat)}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                )
              })}
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.actionBtn} onClick={handleShuffle}>
                <Shuffle size={14} /> 섞기
              </button>
              <button type="button" className={styles.actionBtn} onClick={reset}>
                <RotateCcw size={14} /> 초기화
              </button>
            </div>
          </div>

          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${total > 0 ? ((index + 1) / total) * 100 : 0}%` }}
            />
          </div>
          <div className={styles.statsRow}>
            <span>{total > 0 ? `${index + 1} / ${total}` : '문제 없음'}</span>
            <span className={styles.statKnown}>아는 문제 {stats.known}</span>
            <span className={styles.statUnknown}>모르는 문제 {stats.unknown}</span>
            <span>남음 {stats.remaining}</span>
          </div>

          {current ? (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.categoryBadge}>{CATEGORY_LABELS[current.category]}</span>
                <span className={styles.qNumber}>Q{current.id}</span>
              </div>

              <h2 className={styles.question}>{current.question}</h2>

              <div className={styles.keywords}>
                <span className={styles.keywordsLabel}>핵심 키워드:</span>
                {current.keywords.map((k) => (
                  <span key={k} className={styles.keywordChip}>
                    {k}
                  </span>
                ))}
              </div>

              <div className={styles.userAnswerSection}>
                <label htmlFor={`answer-${current.id}`} className={styles.userAnswerLabel}>
                  내 답변
                  <span className={styles.charCount}>
                    {(userAnswers[current.id] ?? '').length}자
                  </span>
                </label>
                <textarea
                  id={`answer-${current.id}`}
                  className={styles.userAnswerInput}
                  placeholder="여기에 답변을 작성해보세요. 작성 후 아래 '정답 확인' 버튼을 누르면 모범답안과 비교할 수 있습니다."
                  value={userAnswers[current.id] ?? ''}
                  onChange={(e) =>
                    setUserAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))
                  }
                  rows={5}
                />
              </div>

              <button
                type="button"
                className={styles.revealBtn}
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                {revealed ? '정답 숨기기' : '정답 확인'}
              </button>

              {revealed && (
                <div className={styles.compareGrid}>
                  {userAnswers[current.id]?.trim() && (
                    <div className={styles.userAnswerBox}>
                      <div className={styles.userAnswerHeader}>내 답변</div>
                      <p className={styles.compareText}>{userAnswers[current.id]}</p>
                    </div>
                  )}
                  <div className={styles.answerBox}>
                    <div className={styles.answerLabel}>모범 답안</div>
                    <p className={styles.answerText}>{current.answer}</p>
                    <div className={styles.keywordCheck}>
                      <span className={styles.keywordCheckLabel}>키워드 체크:</span>
                      {current.keywords.map((k) => {
                        const ua = (userAnswers[current.id] ?? '').toLowerCase()
                        const hit = k
                          .toLowerCase()
                          .split(/[\s/·,()]+/)
                          .filter((t) => t.length > 1)
                          .some((t) => ua.includes(t))
                        return (
                          <span
                            key={k}
                            className={`${styles.keywordCheckChip} ${hit ? styles.keywordHit : styles.keywordMiss}`}
                          >
                            {hit ? '✓' : '·'} {k}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.markRow}>
                <button
                  type="button"
                  className={`${styles.markBtn} ${styles.markUnknown} ${
                    results[current.id] === 'unknown' ? styles.markBtnActive : ''
                  }`}
                  onClick={() => mark(current.id, 'unknown')}
                >
                  모름 / 다시 보기
                </button>
                <button
                  type="button"
                  className={`${styles.markBtn} ${styles.markKnown} ${
                    results[current.id] === 'known' ? styles.markBtnActive : ''
                  }`}
                  onClick={() => mark(current.id, 'known')}
                >
                  완벽히 알아요
                </button>
              </div>

              <div className={styles.navRow}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => go(-1)}
                  disabled={index === 0}
                >
                  <ChevronLeft size={16} /> 이전
                </button>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => go(1)}
                  disabled={index === total - 1}
                >
                  다음 <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>해당 카테고리에 문제가 없습니다.</div>
          )}
        </>
      ) : (
        <div className={styles.refGrid}>
          {REFERENCE_ITEMS.map((ref) => (
            <div key={ref.title} className={styles.refCard}>
              <h3 className={styles.refTitle}>{ref.title}</h3>
              <ul className={styles.refList}>
                {ref.content.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
