import { useStore } from '../../store/store';
import styles from './ProfileButton.module.css';

interface ProfileDropdownProps {
  onSettings: () => void;
  onEditProfile: () => void;
}

export function ProfileDropdown({ onSettings, onEditProfile }: ProfileDropdownProps) {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);

  if (!user) return null;

  return (
    <div className={styles.dropdown}>
      <div className={styles.userInfo}>
        <p className={styles.userName}>{user.name}</p>
        <p className={styles.userEmail}>{user.email}</p>
      </div>
      <div className={styles.divider} />
      <button className={styles.menuButton} onClick={onSettings}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <span>Settings</span>
      </button>
      <button className={styles.menuButton} onClick={onEditProfile}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 10C12.0711 10 13.75 8.32107 13.75 6.25C13.75 4.17893 12.0711 2.5 10 2.5C7.92893 2.5 6.25 4.17893 6.25 6.25C6.25 8.32107 7.92893 10 10 10Z" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M17.5 17.5C17.5 14.7386 14.1421 12.5 10 12.5C5.85786 12.5 2.5 14.7386 2.5 17.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <span>Edit Profile</span>
      </button>
      <div className={styles.divider} />
      <button onClick={() => logout()} className={styles.logoutButton}>Sign Out</button>
    </div>
  );
}
