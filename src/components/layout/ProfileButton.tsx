import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/store';
import { SettingsModal } from '../modals/SettingsModal';
import { EditProfileModal } from '../modals/EditProfileModal';
import { ProfileDropdown } from './ProfileDropdown';
import styles from './ProfileButton.module.css';

export function ProfileButton() {
  const user = useStore((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getAvatarUrl = () => {
    if (user?.avatar) return user.avatar;
    if (user?.name) return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=635FC7&color=fff`;
    return null;
  };

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  if (!user) return null;
  const avatarUrl = getAvatarUrl();
  const initials = user.name.split(' ').map(p => p[0]).join('').toUpperCase().substring(0, 2);

  return (
    <>
      <div className={styles.container} ref={dropdownRef}>
        <button className={styles.profileButton} onClick={() => setIsOpen(!isOpen)}
          aria-label="User profile" aria-expanded={isOpen}>
          <div className={styles.avatar}>
            {avatarUrl ? <img src={avatarUrl} alt={user.name} /> : <span>{initials}</span>}
          </div>
          <span className={styles.name}>{user.name}</span>
          <svg className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
            width="10" height="7" viewBox="0 0 10 7" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
        {isOpen && (
          <ProfileDropdown
            onSettings={() => { setIsOpen(false); setShowSettings(true); }}
            onEditProfile={() => { setIsOpen(false); setShowEditProfile(true); }}
          />
        )}
      </div>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} />
    </>
  );
}
