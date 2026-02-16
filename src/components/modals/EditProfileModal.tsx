import { useState } from 'react';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import styles from './EditProfileModal.module.css';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  if (isOpen && user && name !== user.name && !loading) {
    setName(user.name);
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      setAvatarFile(file);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      // Call auth service to update profile and upload avatar
      const updatedUser = await authService.updateProfile(name, avatarFile || undefined);
      
      // Update global store with new user data including avatar URL
      setUser(updatedUser);
      
      onClose();
    } catch (err: any) {
      console.error('Profile update failed:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    if (user?.avatar) return user.avatar;
    if (user?.name) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=635FC7&color=fff&size=128`;
    }
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <div className={styles.container}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarPreview}>
            {getAvatarUrl() ? (
              <img src={getAvatarUrl()!} alt="Profile" />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className={styles.avatarActions}>
            <label htmlFor="avatar-upload" className={`${styles.uploadButton} ${loading ? styles.disabled : ''}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11.3333 5.33333L8 2L4.66667 5.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 2V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Upload Photo
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className={styles.fileInput}
              disabled={loading}
            />
            {avatarPreview && (
              <button
                type="button"
                onClick={() => {
                  setAvatarFile(null);
                  setAvatarPreview(null);
                }}
                className={styles.removeButton}
                disabled={loading}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.formSection}>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            disabled={loading}
          />

          <div className={styles.emailField}>
            <label className={styles.emailLabel}>Email</label>
            <p className={styles.emailValue}>{user?.email}</p>
            <p className={styles.emailHint}>Email cannot be changed</p>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
