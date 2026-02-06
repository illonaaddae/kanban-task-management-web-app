import { useState } from 'react';
import { useBoard } from '../../context/BoardContext';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AddBoardModal } from '../modals/AddBoardModal';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { boards, activeBoard, setActiveBoard } = useBoard();
  const [showAddBoardModal, setShowAddBoardModal] = useState(false);
  
  if (!isOpen) {
    return (
      <button className={styles.showButton} onClick={onToggle} aria-label="Show sidebar">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
          <path d="M15.8154 7.38587L9.06541 0.635867C8.80208 0.37253 8.37708 0.37253 8.11374 0.635867C7.85041 0.899201 7.85041 1.3242 8.11374 1.58753L13.5271 7.00003H0.666748C0.298748 7.00003 0.000415802 7.29837 0.000415802 7.66637C0.000415802 8.03437 0.298748 8.3327 0.666748 8.3327H13.5271L8.11374 13.746C7.85041 14.0094 7.85041 14.4344 8.11374 14.6977C8.24541 14.8294 8.42291 14.896 8.59958 14.896C8.77624 14.896 8.95374 14.8294 9.08541 14.6977L15.8354 7.94771C16.0987 7.68437 16.0987 7.2592 15.8154 6.99587V7.38587Z"/>
        </svg>
      </button>
    );
  }
  
  return (
    <>
    <aside className={styles.sidebar}>
      <Logo />
      
      <div className={styles.boardSection}>
        <h2 className={styles.boardsHeading}>ALL BOARDS ({boards.length})</h2>
        
        <nav className={styles.boardList}>
          {boards.map((board, index) => (
            <button
              key={index}
              className={`${styles.boardItem} ${activeBoard === index ? styles.active : ''}`}
              onClick={() => setActiveBoard(index)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0.945312 2.10938C0.945312 1.15859 1.71641 0.3875 2.66719 0.3875H6.11094C7.06172 0.3875 7.83281 1.15859 7.83281 2.10938V13.8906C7.83281 14.8414 7.06172 15.6125 6.11094 15.6125H2.66719C1.71641 15.6125 0.945312 14.8414 0.945312 13.8906V2.10938ZM9.88906 2.10938C9.88906 1.15859 10.6602 0.3875 11.6109 0.3875H13.3328C14.2836 0.3875 15.0547 1.15859 15.0547 2.10938V7.16406C15.0547 8.11484 14.2836 8.88594 13.3328 8.88594H11.6109C10.6602 8.88594 9.88906 8.11484 9.88906 7.16406V2.10938Z"/>
              </svg>
              <span>{board.name}</span>
            </button>
          ))}
          
          <button 
            className={styles.createBoard}
            onClick={() => setShowAddBoardModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0.945312 2.10938C0.945312 1.15859 1.71641 0.3875 2.66719 0.3875H6.11094C7.06172 0.3875 7.83281 1.15859 7.83281 2.10938V13.8906C7.83281 14.8414 7.06172 15.6125 6.11094 15.6125H2.66719C1.71641 15.6125 0.945312 14.8414 0.945312 13.8906V2.10938ZM9.88906 2.10938C9.88906 1.15859 10.6602 0.3875 11.6109 0.3875H13.3328C14.2836 0.3875 15.0547 1.15859 15.0547 2.10938V7.16406C15.0547 8.11484 14.2836 8.88594 13.3328 8.88594H11.6109C10.6602 8.88594 9.88906 8.11484 9.88906 7.16406V2.10938Z"/>
            </svg>
            <span>+ Create New Board</span>
          </button>
        </nav>
      </div>
      
      <div className={styles.bottomSection}>
        <ThemeToggle />
        
        <button className={styles.hideButton} onClick={onToggle}>
          <svg width="18" height="16" viewBox="0 0 18 16" fill="currentColor">
            <path d="M8.58447 2.77778C13.7062 2.77778 17.0254 8.14815 17.2142 8.48148C17.4254 8.85185 17.4254 9.32593 17.2142 9.66667C17.0254 9.99259 13.7062 15.3333 8.58447 15.3333C3.4627 15.3333 0.143478 10 -0.0453216 9.66667C-0.280545 9.26667 -0.280545 8.77778 -0.0453216 8.44444C0.143478 8.07407 3.4627 2.77778 8.58447 2.77778ZM8.58447 13.1111C11.3885 13.1111 14.0797 10.6667 15.3326 8.55556C14.0797 6.44444 11.3885 4 8.58447 4C5.78041 4 3.08923 6.44444 1.83635 8.55556C3.08923 10.6667 5.78041 13.1111 8.58447 13.1111ZM8.58447 11.5556C6.92716 11.5556 5.58447 10.2222 5.58447 8.55556C5.58447 6.88889 6.92716 5.55556 8.58447 5.55556C10.2418 5.55556 11.5845 6.88889 11.5845 8.55556C11.5845 10.2222 10.2418 11.5556 8.58447 11.5556ZM8.58447 10C9.36216 10 9.98447 9.37778 9.98447 8.55556C9.98447 7.73333 9.36216 7.11111 8.58447 7.11111C7.80678 7.11111 7.18447 7.73333 7.18447 8.55556C7.18447 9.37778 7.80678 10 8.58447 10Z"/>
          </svg>
          <span>Hide Sidebar</span>
        </button>
      </div>
    </aside>
    
    <AddBoardModal 
      isOpen={showAddBoardModal}
      onClose={() => setShowAddBoardModal(false)}
    />
    </>
  );
}
