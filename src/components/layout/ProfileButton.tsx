import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/store';
import { ThemeToggle } from '../ui/ThemeToggle';
import styles from './ProfileButton.module.css';

export function ProfileButton() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarUrl = () => {
    if (user?.avatar) return user.avatar;
    // Fallback to UI Avatars if no specific avatar
    if (user?.name) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=635FC7&color=fff`;
    }
    return null;
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!user) return null;

  const avatarUrl = getAvatarUrl();

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        className={styles.profileButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User profile"
        aria-expanded={isOpen}
      >
        <div className={styles.avatar}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={user.name} />
          ) : (
            <span>{getInitials(user.name)}</span>
          )}
        </div>
        <span className={styles.name}>{user.name}</span>
        <svg 
          className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
          width="10" height="7" 
          viewBox="0 0 10 7" 
          fill="none"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <p className={styles.userEmail}>{user.email}</p>
          </div>
          
          <div className={styles.divider} />
          
          <div className={styles.menuItem}>
            <span>Theme</span>
            <ThemeToggle />
          </div>
          
          <div className={styles.divider} />
          
          <button onClick={() => logout()} className={styles.logoutButton}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
