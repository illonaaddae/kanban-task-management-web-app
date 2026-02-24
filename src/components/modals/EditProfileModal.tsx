import { useState, useEffect } from 'react';
import { useStore } from '../../store/store';
import { authService } from '../../services/authService';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { AvatarUpload } from '../profile/AvatarUpload';
import toast from 'react-hot-toast';
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

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name); setAvatarFile(null); setAvatarPreview(null); setError(null);
    }
  }, [isOpen]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB'); toast.error('Image size must be less than 5MB'); return;
      }
      setAvatarFile(file); setError(null);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const updatedUser = await authService.updateProfile(name, avatarFile || undefined);
      setUser(updatedUser); toast.success('Profile updated successfully!'); onClose();
    } catch (err: any) {
      const message = err.message || 'Failed to update profile.';
      setError(message); toast.error(message);
    } finally { setLoading(false); }
  };

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    if (user?.avatar) return user.avatar;
    if (user?.name) return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=635FC7&color=fff&size=128`;
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <form onSubmit={handleSubmit} className={styles.container}>
        <AvatarUpload avatarUrl={getAvatarUrl()} userInitial={user?.name?.charAt(0).toUpperCase() || ''}
          avatarPreview={avatarPreview} loading={loading} onFileChange={handleAvatarChange}
          onRemovePreview={() => { setAvatarFile(null); setAvatarPreview(null); }} />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.formSection}>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name" disabled={loading} />
          <div className={styles.emailField}>
            <label className={styles.emailLabel}>Email</label>
            <p className={styles.emailValue}>{user?.email}</p>
            <p className={styles.emailHint}>Email cannot be changed</p>
          </div>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
