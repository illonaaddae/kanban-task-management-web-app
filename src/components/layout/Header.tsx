import { useState, useMemo } from 'react';
import { useBoards } from '../../queries/boards';
import { useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';
import { BoardSelectorModal } from '../modals/BoardSelectorModal';
import { AddTaskModal } from '../modals/AddTaskModal';
import { EditBoardModal } from '../modals/EditBoardModal';
import { DeleteBoardModal } from '../modals/DeleteBoardModal';
import { BoardActionsMenu } from './BoardActionsMenu';
import { ProfileButton } from './ProfileButton';
import { ShareModal } from '../modals/ShareModal';
import { ActivityPanel } from '../board/ActivityPanel';
import { ChatPanel } from '../board/ChatPanel';
import { useBoardPermissions } from '../../hooks/useBoardPermissions';
import { useAiStatus } from '../../queries/orgs';
import { HamburgerButton } from '../ui/HamburgerButton';
import { useKanbanStore } from '../../store/kanbanStore';
import styles from './Header.module.css';
import { PATHS } from '../../routes';

export function Header() {
  const location = useLocation();

  const { data: boards = [] } = useBoards();
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditBoard, setShowEditBoard] = useState(false);
  const [showDeleteBoard, setShowDeleteBoard] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const { canEdit, canManageBoard } = useBoardPermissions();
  const { data: aiStatus } = useAiStatus();
  const isSidebarOpen = useKanbanStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useKanbanStore((state) => state.setSidebarOpen);

  const boardId = useMemo(
    () => location.pathname.match(/^\/board\/([^/]+)$/)?.[1] ?? null,
    [location.pathname]
  );
  const currentBoard = useMemo(
    () => (boardId ? boards.find(b => b.id === boardId) ?? null : null),
    [boardId, boards]
  );
  const isOnBoardView = !!currentBoard;

  const pageTitle = useMemo(() => {
    if (location.pathname === PATHS.dashboard) return 'Dashboard';
    if (location.pathname === PATHS.teams) return 'Teams';
    if (location.pathname === PATHS.myTasks) return 'My Tasks';
    if (location.pathname === '/admin') return 'Admin Panel';
    return currentBoard?.name || 'Kanban Board';
  }, [location.pathname, currentBoard]);

  return (
    <>
      <header className={styles.header}>
        {/* Shown only below 1025px (see HamburgerButton.module.css), where the
            sidebar is a drawer. It was the only way to reach the board list,
            create-board and theme toggle on a phone - and the component existed
            unused until now. */}
        <HamburgerButton
          isOpen={isSidebarOpen}
          onClick={() => setSidebarOpen(!isSidebarOpen)}
        />

        <button className={styles.titleButton} onClick={() => setShowBoardSelector(true)} aria-label="Select board">
          <h1 className={styles.title}>{pageTitle}</h1>
          <svg className={styles.chevron} width="10" height="7" viewBox="0 0 10 7" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
        <div className={styles.actions}>
          {isOnBoardView && (
            <>
              {/* Read-only for viewers: no create affordance at all. The API
                  refuses them too, so this is convenience, not the control. */}
              {/* Sharing was previously only reachable from the overflow menu,
                  where nobody found it. It is the entry point for assigning
                  work to teammates, so it earns a visible button. */}
              {/* Editors only, and only with a key configured: a reply can offer a
                  change, and a viewer has nothing to do with one. The `/` command
                  bar is the same feature without the transcript. */}
              {canEdit && aiStatus?.enabled && (
                <button
                  className={styles.askButton}
                  onClick={() => setShowChat(true)}
                  title="Ask about this board"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>Ask</span>
                </button>
              )}
              {canManageBoard && (
                <button
                  className={styles.shareButton}
                  onClick={() => setShowShare(true)}
                  title="Invite people to this board"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  <span>Share</span>
                </button>
              )}
              {canEdit && (
                <Button className={styles.addTaskButton} onClick={() => setShowAddTask(true)}>
                  + Add New Task
                </Button>
              )}
              {!canEdit && <span className={styles.readOnlyBadge}>View only</span>}
              <BoardActionsMenu
                canEdit={canEdit}
                canManageBoard={canManageBoard}
                onEditBoard={() => setShowEditBoard(true)}
                onDeleteBoard={() => setShowDeleteBoard(true)}
                onShareBoard={() => setShowShare(true)}
                onViewActivity={() => setShowActivity(true)}
              />
            </>
          )}
          <ProfileButton />
        </div>
      </header>
      <BoardSelectorModal isOpen={showBoardSelector} onClose={() => setShowBoardSelector(false)} activeBoardId={boardId || undefined} />
      {isOnBoardView && showAddTask && <AddTaskModal isOpen={showAddTask} boardId={boardId!} onClose={() => setShowAddTask(false)} />}
      {isOnBoardView && showEditBoard && <EditBoardModal isOpen={showEditBoard} boardId={boardId!} onClose={() => setShowEditBoard(false)} />}
      {isOnBoardView && showDeleteBoard && (
        <DeleteBoardModal isOpen={showDeleteBoard} boardId={boardId!} onClose={() => setShowDeleteBoard(false)} boardName={currentBoard.name} />
      )}
      {isOnBoardView && canManageBoard && showShare && (
        <ShareModal isOpen={showShare} boardId={boardId!} boardName={currentBoard.name} onClose={() => setShowShare(false)} />
      )}
      {/* Mounted only while open, so page and filter reset on every open without an
          effect setting state for a panel nobody can see yet. */}
      {isOnBoardView && showActivity && (
        <ActivityPanel isOpen boardId={boardId!} onClose={() => setShowActivity(false)} />
      )}
      {/* Also mounted only while open, so closing it discards the transcript rather
          than leaving a stale conversation about a board that has since changed. */}
      {isOnBoardView && showChat && (
        <ChatPanel isOpen boardId={boardId!} onClose={() => setShowChat(false)} />
      )}
    </>
  );
}
