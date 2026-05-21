import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "../page.module.css";
import type { ConsultationStatus } from "../_types";
import { COUNSEL_SUB, COUNSEL_SUB_LABEL } from "../_constants";

export function StatusSelect({
  value,
  onChange,
  options,
  styleMap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  styleMap: Record<string, { background: string; color: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const [pos, setPos] = useState({ top: -9999, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  // 렌더 직후(페인트 전) 실제 높이로 배지 바로 위에 위치
  useLayoutEffect(() => {
    if (!open || !dropdownRef.current) return;
    const dropH = dropdownRef.current.offsetHeight;
    setPos({
      top: Math.max(8, anchor.top - dropH - 4),
      left: anchor.left,
    });
  }, [open, anchor]);

  const isCounselValue = COUNSEL_SUB.includes(value as ConsultationStatus);
  const s = styleMap[value] ?? { background: "#F3F4F6", color: "#6B7684" };
  const displayLabel = isCounselValue
    ? `상담완료 · ${COUNSEL_SUB_LABEL[value]}`
    : value;

  // 상담완료-* 제외한 옵션, 상담대기 뒤에 '상담완료' 그룹 슬롯 삽입
  const baseOptions = options.filter(
    (o) => !COUNSEL_SUB.includes(o as ConsultationStatus),
  );
  const insertIdx = baseOptions.indexOf("상담대기") + 1;
  const beforeCounsel = baseOptions.slice(0, insertIdx);
  const afterCounsel = baseOptions.slice(insertIdx);

  return (
    <>
      <span
        className={styles.statusBadgeBtn}
        style={{ background: s.background, color: s.color }}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          if (open) {
            setOpen(false);
            return;
          }
          setAnchor({ top: rect.top, left: rect.left });
          setPos({ top: -9999, left: rect.left });
          setOpen(true);
        }}
      >
        {displayLabel}
      </span>
      {open && (
        <div
          ref={dropdownRef}
          className={styles.statusSelectDropdown}
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {beforeCounsel.map((opt) => {
            const st = styleMap[opt] ?? {
              background: "#F3F4F6",
              color: "#6B7684",
            };
            return (
              <div
                key={opt}
                className={`${styles.statusSelectOption}${value === opt ? ` ${styles.statusSelectOptionActive}` : ""}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                <span
                  className={styles.statusSelectDot}
                  style={{ background: st.color }}
                />
                {opt}
                {value === opt && (
                  <span
                    style={{
                      marginLeft: "auto",
                      color: st.color,
                      fontSize: 11,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}

          {/* 상담완료 → 호버 시 우측 플라이아웃 */}
          <div
            className={`${styles.statusSelectOption} ${styles.statusSelectGroup}`}
          >
            <span
              className={styles.statusSelectDot}
              style={{ background: "#0277BD" }}
            />
            상담완료
            <span style={{ marginLeft: "auto", fontSize: 10 }}>▶</span>
            <div className={styles.statusSelectFlyout}>
              {COUNSEL_SUB.map((opt) => {
                const st = styleMap[opt] ?? {
                  background: "#F3F4F6",
                  color: "#6B7684",
                };
                return (
                  <div
                    key={opt}
                    className={`${styles.statusSelectOption}${value === opt ? ` ${styles.statusSelectOptionActive}` : ""}`}
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    <span
                      className={styles.statusSelectDot}
                      style={{ background: st.color }}
                    />
                    {COUNSEL_SUB_LABEL[opt]}
                    {value === opt && (
                      <span
                        style={{
                          marginLeft: "auto",
                          color: st.color,
                          fontSize: 11,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {afterCounsel.map((opt) => {
            const st = styleMap[opt] ?? {
              background: "#F3F4F6",
              color: "#6B7684",
            };
            return (
              <div
                key={opt}
                className={`${styles.statusSelectOption}${value === opt ? ` ${styles.statusSelectOptionActive}` : ""}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                <span
                  className={styles.statusSelectDot}
                  style={{ background: st.color }}
                />
                {opt}
                {value === opt && (
                  <span
                    style={{
                      marginLeft: "auto",
                      color: st.color,
                      fontSize: 11,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
