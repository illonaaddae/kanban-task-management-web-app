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
          <path d="M16.25 10C16.25 10.625 16.125 11.1875 15.9375 11.6875L17.5 12.8125C17.625 12.9375 17.6875 13.125 17.625 13.3125C17.5625 13.5 17.4375 13.625 17.25 13.6875L15.6875 14.4375C15.5 14.5 15.3125 14.4375 15.1875 14.3125L13.625 13.1875C13.125 13.5625 12.5625 13.875 11.9375 14.0625V15.625C11.9375 15.8125 11.8125 16 11.625 16.0625C11.4375 16.125 11.25 16.0625 11.125 15.9375L10 14.375C9.375 14.375 8.8125 14.25 8.3125 14.0625L6.8125 15.625C6.6875 15.75 6.5 15.8125 6.3125 15.75C6.125 15.6875 6 15.5625 5.9375 15.375L5.1875 13.8125C5.125 13.625 5.1875 13.4375 5.3125 13.3125L6.4375 11.75C6.0625 11.25 5.75 10.6875 5.5625 10.0625H4C3.8125 10.0625 3.625 9.9375 3.5625 9.75C3.5 9.5625 3.5625 9.375 3.6875 9.25L5.25 7.6875C5.25 7.0625 5.375 6.5 5.5625 6L4 4.4375C3.875 4.3125 3.8125 4.125 3.875 3.9375C3.9375 3.75 4.0625 3.625 4.25 3.5625L5.8125 2.8125C6 2.75 6.1875 2.8125 6.3125 2.9375L7.875 4.0625C8.375 3.6875 8.9375 3.375 9.5625 3.1875V1.625C9.5625 1.4375 9.6875 1.25 9.875 1.1875C10.0625 1.125 10.25 1.1875 10.375 1.3125L11.5 2.875C12.125 2.875 12.6875 3 13.1875 3.1875L14.6875 1.625C14.8125 1.5 15 1.4375 15.1875 1.5C15.375 1.5625 15.5 1.6875 15.5625 1.875L16.3125 3.4375C16.375 3.625 16.3125 3.8125 16.1875 3.9375L15.0625 5.5C15.4375 6 15.75 6.5625 15.9375 7.1875H17.5C17.6875 7.1875 17.875 7.3125 17.9375 7.5C18 7.6875 17.9375 7.875 17.8125 8L16.25 9.5625V10Z" stroke="currentColor" strokeWidth="1.5"/>
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
