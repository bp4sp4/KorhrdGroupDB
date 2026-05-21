// ─── 검색어 하이라이트 ──────────────────────────────────────────────────────

export function Highlight({
  text,
  query,
}: {
  text: string | null;
  query: string;
}) {
  if (!query || !text) return <>{text ?? "-"}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const hasDirectMatch = parts.length > 1;
  if (hasDirectMatch) {
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              style={{
                background: "#FFE500",
                color: "inherit",
                borderRadius: 2,
                padding: "0 1px",
              }}
            >
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    );
  }
  // 하이픈 제거 후 매칭 (전화번호 등)
  const textClean = text.replace(/-/g, "");
  const queryClean = query.replace(/-/g, "");
  if (
    queryClean &&
    textClean.toLowerCase().includes(queryClean.toLowerCase())
  ) {
    // 원본 text에서 하이픈 포함 위치 계산
    const cleanIdx = textClean.toLowerCase().indexOf(queryClean.toLowerCase());
    let origStart = 0,
      cleanCount = 0;
    for (let i = 0; i < text.length && cleanCount < cleanIdx; i++) {
      if (text[i] !== "-") cleanCount++;
      origStart = i + 1;
    }
    let origEnd = origStart,
      matched = 0;
    for (
      let i = origStart;
      i < text.length && matched < queryClean.length;
      i++
    ) {
      if (text[i] !== "-") matched++;
      origEnd = i + 1;
    }
    return (
      <>
        {text.slice(0, origStart)}
        <mark
          style={{
            background: "#FFE500",
            color: "inherit",
            borderRadius: 2,
            padding: "0 1px",
          }}
        >
          {text.slice(origStart, origEnd)}
        </mark>
        {text.slice(origEnd)}
      </>
    );
  }
  return <>{text}</>;
}
