import { useParams, Navigate } from "react-router-dom";
import { useBoard } from "../queries/boards";
import { ApiError } from "../services/api";
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
  // The URL is the source of truth; the query owns the data and its own
  // loading and error state.
  const { data: currentBoard, isPending, error, refetch } = useBoard(boardId);
  const editModal = useModal();
  const columnModal = useModal();
  const { canEdit } = useBoardPermissions();
  const { activeId, setActiveId, sensors, handleDragEnd } =
    useBoardDnd(currentBoard ?? null);

  const handleAddColumn = () => {
    if (!canEdit || !currentBoard?.id) return;
    columnModal.open();
  };

  // The API answers 404 for a board that does not exist and 403 for one that
  // exists but is not shared with this user. Neither is worth a page of error
  // text — send them back to their own boards.
  if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
    return <Navigate to="/" replace />;
  }

  if (isPending) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Loader />
          <span>Loading board...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>Could not load board data.</p>
          <span>{error instanceof Error ? error.message : "Something went wrong"}</span>
          <button onClick={() => void refetch()}>Retry</button>
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
