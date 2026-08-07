import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts, type Shortcut } from '../../hooks/useKeyboardShortcuts';
import { ShortcutsModal } from '../ui/ShortcutsModal';
import { AddBoardModal } from '../modals/AddBoardModal';
import { AddTaskModal } from '../modals/AddTaskModal';
import { AddColumnModal } from '../modals/AddColumnModal';
import { BoardSelectorModal } from '../modals/BoardSelectorModal';
import { useBoards } from '../../queries/boards';
import { useBoardPermissions, useRouteBoardId } from '../../hooks/useBoardPermissions';
import toast from 'react-hot-toast';

/**
 * App-wide keyboard shortcuts, and the dialogs they open.
 *
 * Lives beside the layout rather than inside Header because two of these work on
 * any page, and Header only renders the board-specific ones.
 *
 * Board-scoped shortcuts refuse rather than doing nothing silently: pressing N on
 * the dashboard says why instead of leaving the user wondering whether the key
 * registered.
 */
export function AppShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const boardId = useRouteBoardId();
  const { canEdit } = useBoardPermissions();
  const { data: boards = [] } = useBoards();

  const [dialog, setDialog] = useState<
    'none' | 'board' | 'task' | 'column' | 'switcher' | 'help'
  >('none');
  const close = () => setDialog('none');

  const board = boards.find((candidate) => candidate.id === boardId);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        key: 'b',
        description: 'New board',
        run: () => setDialog('board'),
      },
      {
        key: 'n',
        description: 'New task',
        run: () => {
          if (!boardId) {
            toast('Open a board first, then press N to add a task');
            return;
          }
          if (!canEdit) {
            toast.error('You have view-only access to this board');
            return;
          }
          setDialog('task');
        },
      },
      {
        key: 'c',
        description: 'New column',
        run: () => {
          if (!boardId) {
            toast('Open a board first, then press C to add a column');
            return;
          }
          if (!canEdit) {
            toast.error('You have view-only access to this board');
            return;
          }
          setDialog('column');
        },
      },
      // Single keys rather than the two-key "g then d" sequences a cheatsheet
      // draft promised: one keystroke is simpler to implement *and* to remember,
      // and the cheatsheet now says what actually happens.
      { key: 'd', description: 'Dashboard', run: () => navigate('/') },
      { key: 't', description: 'Teams', run: () => navigate('/teams') },
      { key: 'm', description: 'My tasks', run: () => navigate('/my-tasks') },
      { key: '/', description: 'Switch board', run: () => setDialog('switcher') },
      { key: '?', description: 'Shortcuts', run: () => setDialog('help') },
    ],
    [boardId, canEdit, navigate],
  );

  // Suppressed while any of these dialogs is open, so a keystroke cannot stack a
  // second one on top of the first.
  useKeyboardShortcuts(shortcuts, dialog === 'none');

  return (
    <>
      {dialog === 'board' && <AddBoardModal isOpen onClose={close} />}
      {dialog === 'task' && boardId && (
        <AddTaskModal isOpen boardId={boardId} onClose={close} />
      )}
      {dialog === 'column' && boardId && (
        <AddColumnModal
          isOpen
          boardId={boardId}
          existingNames={(board?.columns ?? []).map((column) => column.name)}
          onClose={close}
        />
      )}
      {dialog === 'switcher' && (
        <BoardSelectorModal isOpen onClose={close} activeBoardId={boardId} />
      )}
      {dialog === 'help' && <ShortcutsModal isOpen onClose={close} />}

      {/* `pathname` is read so the hook re-evaluates on navigation; the shortcuts
          themselves depend on which board is open. */}
      <span hidden data-route={pathname} />
    </>
  );
}
