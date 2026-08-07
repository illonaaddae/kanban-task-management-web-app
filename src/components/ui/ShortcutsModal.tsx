import { Modal } from '../modals/Modal';
import styles from './ShortcutsModal.module.css';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GROUPS = [
  {
    title: 'Create',
    items: [
      { keys: ['N'], label: 'New task on this board' },
      { keys: ['B'], label: 'New board' },
      { keys: ['C'], label: 'New column on this board' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['D'], label: 'Dashboard' },
      { keys: ['T'], label: 'Teams' },
      { keys: ['M'], label: 'My tasks' },
    ],
  },
  {
    title: 'Everywhere',
    items: [
      { keys: ['/'], label: 'Ask for a change on this board' },
      { keys: ['K'], label: 'Switch board' },
      { keys: ['?'], label: 'This list' },
      { keys: ['Esc'], label: 'Close a dialog' },
    ],
  },
];

/** The cheatsheet behind "?". A shortcut nobody can discover is not a feature. */
export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts">
      <h2 className={styles.title}>Keyboard shortcuts</h2>
      <p className={styles.subtitle}>
        These work when you are not typing in a field, and while no dialog is open.
      </p>

      <div className={styles.groups}>
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <ul className={styles.list}>
              {group.items.map((item) => (
                <li key={item.label} className={styles.row}>
                  <span className={styles.label}>{item.label}</span>
                  <span className={styles.keys}>
                    {item.keys.map((key) => (
                      <kbd key={key} className={styles.key}>
                        {key}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
