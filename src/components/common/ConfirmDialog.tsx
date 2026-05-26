"use client";

import { useEffect } from "react";
import styles from "./ConfirmDialog.module.css";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** confirm 버튼을 빨간색(위험 액션)으로 표시 */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 재사용 가능한 confirm 다이얼로그.
 * 메인(title) + 보조(description) 텍스트 + 취소/확인 두 버튼.
 * - Esc → 취소
 * - 오버레이 클릭 → 취소
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "확인",
  cancelText = "취소",
  danger,
  onConfirm,
  onCancel,
}: Props) {
  // Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-desc" : undefined}
      >
        <h3 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h3>
        {description && (
          <p id="confirm-dialog-desc" className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${styles.confirmBtn} ${danger ? styles.confirmBtnDanger : ""}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
