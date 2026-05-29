"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./CategorySelect.module.css";

type Props = {
  value: string;
  options: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
};

export default function CategorySelect({
  value,
  options,
  placeholder = "업무 분류 선택",
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 레거시 자유입력 값이 옵션에 없으면 함께 노출해 유실 방지
  const allOptions =
    value !== "" && !options.includes(value) ? [...options, value] : options;

  // data-no-drag: 부모 행의 onDragStart 가 이 영역에서 시작된 드래그를 무시하도록
  return (
    <div className={styles.root} ref={rootRef} data-no-drag>
      <button
        type="button"
        draggable={false}
        className={`${styles.trigger} ${value === "" ? styles.placeholder : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.label}>{value || placeholder}</span>
        <ChevronDown size={12} className={styles.icon} />
      </button>
      {open && (
        <div className={styles.menu} role="listbox">
          {allOptions.map((opt) => (
            <button
              type="button"
              key={opt}
              role="option"
              aria-selected={opt === value}
              className={`${styles.option} ${opt === value ? styles.optionActive : ""}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
