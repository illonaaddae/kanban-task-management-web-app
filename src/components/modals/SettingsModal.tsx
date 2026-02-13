import { Modal } from './Modal';
import { ThemeToggle } from '../ui/ThemeToggle';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className={styles.container}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Appearance</h3>
          
          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Theme</label>
              <p className={styles.settingDescription}>
                Choose between light and dark mode
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Preferences</h3>
          
          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Notifications</label>
              <p className={styles.settingDescription}>
                Receive notifications for task updates
              </p>
            </div>
            <label className={styles.switch}>
              <input type="checkbox" defaultChecked />
              <span className={styles.slider}></span>
            </label>
          </div>

          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <label className={styles.settingLabel}>Auto-save</label>
              <p className={styles.settingDescription}>
                Automatically save changes as you work
              </p>
            </div>
            <label className={styles.switch}>
              <input type="checkbox" defaultChecked />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
