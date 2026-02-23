import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { TaskCard } from '../TaskCard';
import type { Task } from '../../../types';

// Mock the ViewTaskModal so we don't need the full store in these tests
vi.mock('../../modals/ViewTaskModal', () => ({
  ViewTaskModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="view-task-modal">Task Modal</div> : null,
}));

const mockTask: Task = {
  id: 'task-1',
  title: 'Design new login page',
  description: 'Create wireframes and final mockups',
  status: 'Todo',
  subtasks: [
    { title: 'Wireframes', isCompleted: true },
    { title: 'Mockups', isCompleted: false },
    { title: 'Review', isCompleted: false },
  ],
};

function renderTaskCard(task = mockTask) {
  return render(
    <DndContext>
      <TaskCard task={task} columnIndex={0} taskIndex={0} boardId="board-1" />
    </DndContext>
  );
}

describe('TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the task title', () => {
    renderTaskCard();
    expect(screen.getByText('Design new login page')).toBeInTheDocument();
  });

  it('renders correct completed subtask count', () => {
    renderTaskCard();
    expect(screen.getByText('1 of 3 subtasks')).toBeInTheDocument();
  });

  it('renders "0 of 0 subtasks" when task has no subtasks', () => {
    renderTaskCard({ ...mockTask, subtasks: [] });
    expect(screen.getByText('0 of 0 subtasks')).toBeInTheDocument();
  });

  it('renders "3 of 3 subtasks" when all subtasks are completed', () => {
    const allDone: Task = {
      ...mockTask,
      subtasks: mockTask.subtasks.map(st => ({ ...st, isCompleted: true })),
    };
    renderTaskCard(allDone);
    expect(screen.getByText('3 of 3 subtasks')).toBeInTheDocument();
  });

  it('opens the ViewTaskModal when clicked', () => {
    const { container } = renderTaskCard();
    const card = container.querySelector('[role="button"]') as HTMLElement;
    // Use fireEvent to bypass dnd-kit's pointer-down drag detection
    fireEvent.click(card);
    expect(screen.getByTestId('view-task-modal')).toBeInTheDocument();
  });
});
