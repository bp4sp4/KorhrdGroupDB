import PresenceBoard from "./PresenceBoard";
import styles from "./page.module.css";

export default function PresencePage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>직원 활동 현황</h1>
      <PresenceBoard />
    </div>
  );
}
