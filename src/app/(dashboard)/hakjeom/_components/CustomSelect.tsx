import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";

// ─── Custom Select Dropdown ──────────────────────────────────────────────────

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  fullWidth,
  style,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setOpen((v) => !v);
  };

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "선택";

  return (
    <div
      ref={ref}
      className={`${styles.customSelectWrap} ${fullWidth ? styles.customSelectFull : ""}`}
      style={style}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={styles.customSelectTrigger}
      >
        <span
          className={
            value ? styles.customSelectValue : styles.customSelectPlaceholder
          }
        >
          {displayLabel}
        </span>
        <svg
          className={`${styles.customSelectCaret} ${open ? styles.customSelectCaretOpen : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.customSelectDropdown} style={dropdownStyle}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.customSelectOption} ${opt.value === value ? styles.customSelectOptionActive : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
