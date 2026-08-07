import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { Column } from "../components/board/Column";
import { EmptyBoard } from "../components/board/EmptyBoard";
import { EditBoardModal } from "../components/modals/EditBoardModal";
import { AddColumnModal } from "../components/modals/AddColumnModal";
import { useModal } from "../hooks/useModal";
import { useBoardDnd } from "../hooks/useBoardDnd";
import { useBoardPermissions } from "../hooks/useBoardPermissions";
import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader } from "../components/ui/Loader";
import styles from "./BoardView.module.css";

export function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const {
    boards,
    currentBoard,
    setCurrentBoard,
    boardLoading,
    boardError,
    fetchBoards,
    user,
  } = useStore(
    useShallow((state) => ({
      boards: state.boards,
      currentBoard: state.currentBoard,
      setCurrentBoard: state.setCurrentBoard,
      boardLoading: state.boardLoading,
      boardError: state.boardError,
      fetchBoards: state.fetchBoards,
      user: state.user,
    })),
  );
  const editModal = useModal();
  const columnModal = useModal();
  const { canEdit } = useBoardPermissions();
  const { activeId, setActiveId, sensors, handleDragEnd } =
    useBoardDnd(currentBoard);

  useEffect(() => {
    if (boardId && boards.length > 0) {
      const board = boards.find((b) => b.id === boardId);
      if (board && currentBoard?.id !== boardId) setCurrentBoard(board);
    }
  }, [boardId, boards, currentBoard, setCurrentBoard]);

  const handleAddColumn = () => {
    if (!canEdit || !currentBoard?.id) return;
    columnModal.open();
  };

  if (boardId && boards.length > 0 && !boards.find((b) => b.id === boardId)) {
    return <Navigate to="/" replace />;
  }

  // Only when there is no board to render yet. Previously any boardLoading —
  // including adding a column — blanked the whole board behind a spinner.
  if (boardLoading && !currentBoard) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Loader />
          <span>Loading board...</span>
        </div>
      </div>
    );
  }

  if (boardError) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>Could not load board data.</p>
          <span>{boardError}</span>
          {user && <button onClick={() => fetchBoards(user.id)}>Retry</button>}
        </div>
      </div>
    );
  }

  if (!currentBoard) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>
            No board selected. Choose a board from the sidebar to get started.
          </p>
        </div>
      </div>
    );
  }

  if (!currentBoard.columns?.length) {
    return (
      <div className={styles.container}>
        {canEdit ? (
          <EmptyBoard onAddColumn={handleAddColumn} />
        ) : (
          <div className={styles.empty}>
            <p>This board has no columns yet.</p>
            <span>You have view-only access, so you cannot add one.</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className={styles.container}>
        <SortableContext
          items={currentBoard.columns.map((_, i) => `column-${i}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div className={styles.board}>
            {currentBoard.columns.map((column, index) => (
              <Column
                key={`column-${index}`}
                column={column}
                columnIndex={index}
                boardId={currentBoard.id!}
              />
            ))}
            {canEdit && (
              <button className={styles.newColumn} onClick={handleAddColumn}>
                + New Column
              </button>
            )}
          </div>
        </SortableContext>
      </div>
      <DragOverlay>
        {activeId ? (
          <div className={styles.dragOverlay}>Dragging...</div>
        ) : null}
      </DragOverlay>
      {currentBoard.id && columnModal.isOpen && (
        <AddColumnModal
          isOpen={columnModal.isOpen}
          onClose={columnModal.close}
          boardId={currentBoard.id}
          existingNames={currentBoard.columns.map((column) => column.name)}
        />
      )}
      {currentBoard.id && (
        <EditBoardModal
          isOpen={editModal.isOpen}
          onClose={editModal.close}
          boardId={currentBoard.id}
        />
      )}
    </DndContext>
  );
}
