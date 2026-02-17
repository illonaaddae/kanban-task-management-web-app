import { Modal } from './Modal';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useStore } from '../../store/store';
import { seedDemoData } from '../../utils/seedData';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const user = useStore((state) => state.user);
  const fetchBoards = useStore((state) => state.fetchBoards);

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

          <div className={styles.divider} style={{ margin: '20px 0' }} />
          
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Danger Zone</h3>
            <div className={styles.setting}>
              <div className={styles.settingInfo}>
                <label className={styles.settingLabel}>Demo Data</label>
                <p className={styles.settingDescription}>
                  Populate account with sample board & tasks
                </p>
              </div>
              <button 
                type="button"
                onClick={async () => {
                  if (!user) {
                    const currentUser = useStore.getState().user;
                    if (!currentUser) {
                      alert('You must be logged in to populate data');
                      return;
                    }
                    try {
                      const success = await seedDemoData(currentUser.id);
                      if (success) {
                        await useStore.getState().fetchBoards(currentUser.id);
                        onClose();
                      }
                    } catch (e) {
                      console.error('Seed error:', e);
                      alert('Failed to seed data');
                    }
                    return;
                  }
                  
                  try {
                    const success = await seedDemoData(user.id);
                    if (success) {
                        await fetchBoards(user.id);
                        onClose();
                    }
                  } catch (e) {
                    console.error('Seed button error:', e);
                    alert('Error: ' + (e instanceof Error ? e.message : 'Unknown error'));
                  }
                }}
                className={styles.seedButton}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                Populate Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
