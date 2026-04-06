export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'email' | 'tel' | 'textarea' | 'select'
  required?: boolean
  options?: { value: string; label: string }[]
}

/** onChange 없으면 읽기 전용, 있으면 편집 모드 */
export interface DocBodyProps {
  content: Record<string, unknown>
  onChange?: (key: string, value: string) => void
}

export interface DocTemplateConfig {
  id: string
  /** 문서 타입 식별 함수 */
  match: (doc: { document_type: string; category?: string }) => boolean
  /** 유효성 검사용 필드 정의 */
  fields: FieldDef[]
  /** 폼/상세 통합 렌더러 (onChange 유무로 모드 구분) */
  BodySection: React.FC<DocBodyProps>
  /** true 이면 파일첨부 UI 표시 */
  supportsAttachments?: boolean
}
