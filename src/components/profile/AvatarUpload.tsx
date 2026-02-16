import styles from '../modals/EditProfileModal.module.css';

interface AvatarUploadProps {
  avatarUrl: string | null;
  userInitial: string;
  avatarPreview: string | null;
  loading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePreview: () => void;
}

export function AvatarUpload({
  avatarUrl, userInitial, avatarPreview, loading, onFileChange, onRemovePreview
}: AvatarUploadProps) {
  return (
    <div className={styles.avatarSection}>
      <div className={styles.avatarPreview}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile" />
        ) : (
          <div className={styles.avatarPlaceholder}>{userInitial}</div>
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
        <input id="avatar-upload" type="file" accept="image/*" onChange={onFileChange}
          className={styles.fileInput} disabled={loading} />
        {avatarPreview && (
          <button type="button" onClick={onRemovePreview}
            className={styles.removeButton} disabled={loading}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
