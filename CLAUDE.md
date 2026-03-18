# 프로젝트 코딩 규칙

## 스타일링

- **인라인 스타일 금지**: `style={{ }}` 사용 금지
- **CSS Module 사용**: 모든 스타일은 해당 컴포넌트/페이지의 `*.module.css` 파일에 작성
- 동적으로 런타임에 결정되는 값(색상, 위치, 크기 등)만 예외적으로 인라인 허용
  - 예: `style={{ width: `${percent}%` }}`, `style={{ background: dynamicColor }}`
- 새 페이지/컴포넌트 생성 시 같은 디렉토리에 `page.module.css` 또는 `Component.module.css` 함께 생성

## 기술 스택

- Next.js App Router
- TypeScript
- Supabase (supabaseAdmin for server-side)
- CSS Modules
