import styles from './Logo.module.css';

export function Logo() {
  return (
    <div className={styles.logo}>
      <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="6" height="25" rx="2" fill="#635FC7"/>
        <rect opacity="0.75" x="9" width="6" height="25" rx="2" fill="#635FC7"/>
        <rect opacity="0.5" x="18" width="6" height="25" rx="2" fill="#635FC7"/>
      </svg>
      <span className={styles.text}>kanban</span>
    </div>
  );
}
