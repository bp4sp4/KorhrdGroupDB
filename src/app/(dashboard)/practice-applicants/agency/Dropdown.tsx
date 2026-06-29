"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./finder.module.css";

interface Option {
  value: string;
  label: string;
}

export default function Dropdown({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  wrapClassName,
}: {
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  wrapClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div
      className={`${styles.dd} ${wrapClassName ?? ""}`}
      ref={ref}
    >
      <button
        type="button"
        className={styles.ddButton}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span
          className={selectedLabel ? styles.ddValue : styles.ddPlaceholder}
        >
          {selectedLabel || placeholder}
        </span>
        <svg
          className={`${styles.ddArrow} ${open ? styles.ddArrowOpen : ""}`}
          width="11"
          height="11"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M12.5631 3.9063C12.3991 3.74226 12.1765 3.65011 11.9445 3.65011C11.7125 3.65011 11.49 3.74226 11.3259 3.9063L6.99465 8.23755L2.6634 3.90629C2.49837 3.74691 2.27734 3.65871 2.04792 3.6607C1.8185 3.6627 1.59904 3.75472 1.43681 3.91695C1.27457 4.07919 1.18255 4.29865 1.18056 4.52807C1.17857 4.75749 1.26676 4.97852 1.42615 5.14354L6.37602 10.0934C6.54011 10.2575 6.76263 10.3496 6.99465 10.3496C7.22667 10.3496 7.44919 10.2575 7.61327 10.0934L12.5631 5.14355C12.7272 4.97946 12.8193 4.75694 12.8193 4.52492C12.8193 4.2929 12.7272 4.07038 12.5631 3.9063Z"
            fill="#9AA0AC"
          />
        </svg>
      </button>
      {open && !disabled && (
        <ul className={styles.ddList}>
          {options.map((o) => (
            <li
              key={o.value}
              className={o.value === value ? styles.ddItemOn : styles.ddItem}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
