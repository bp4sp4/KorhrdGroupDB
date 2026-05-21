import styles from "../page.module.css";

export function StatusBadge({
  status,
  styleMap,
  displayLabel,
}: {
  status: string;
  styleMap: Record<string, { background: string; color: string }>;
  displayLabel?: string;
}) {
  const lookupKey = status.startsWith("기타(") ? "기타" : status;
  const s = styleMap[lookupKey] ?? { background: "#F3F4F6", color: "#6B7684" };
  return (
    <span
      className={styles.statusBadge}
      style={{ background: s.background, color: s.color }}
    >
      {displayLabel ?? status}
    </span>
  );
}
