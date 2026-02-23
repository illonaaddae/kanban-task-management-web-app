import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { Column } from '../Column';
import type { Column as ColumnType } from '../../../types';

// Mock TaskCard to isolate Column tests
vi.mock('../TaskCard', () => ({
  TaskCard: ({ task }: { task: { title: string } }) => (
    <div data-testid="task-card">{task.title}</div>
  ),
}));

const mockColumn: ColumnType = {
  name: 'Todo',
  tasks: [
    { id: 't1', title: 'Task One', description: '', status: 'Todo', subtasks: [] },
    { id: 't2', title: 'Task Two', description: '', status: 'Todo', subtasks: [] },
  ],
};

function renderColumn(column = mockColumn, columnIndex = 0) {
  return render(
    <DndContext>
      <SortableContext items={[]}>
        <Column column={column} columnIndex={columnIndex} boardId="board-1" />
      </SortableContext>
    </DndContext>
  );
}

describe('Column', () => {
  it('renders the column name', () => {
    renderColumn();
    expect(screen.getByText(/todo/i)).toBeInTheDocument();
  });

  it('renders the task count in the column header', () => {
    renderColumn();
    // Column header shows "Todo (2)"
    expect(screen.getByText(/todo \(2\)/i)).toBeInTheDocument();
  });

  it('renders a TaskCard for each task', () => {
    renderColumn();
    const cards = screen.getAllByTestId('task-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByText('Task Two')).toBeInTheDocument();
  });

  it('renders 0 tasks for an empty column', () => {
    renderColumn({ name: 'Doing', tasks: [] });
    expect(screen.queryAllByTestId('task-card')).toHaveLength(0);
    expect(screen.getByText(/doing \(0\)/i)).toBeInTheDocument();
  });

  it('cycles column colors by index', () => {
    // Just ensure rendering doesn't throw for any index
    expect(() => renderColumn(mockColumn, 0)).not.toThrow();
    expect(() => renderColumn(mockColumn, 1)).not.toThrow();
    expect(() => renderColumn(mockColumn, 2)).not.toThrow();
    expect(() => renderColumn(mockColumn, 3)).not.toThrow(); // wraps back to index 0 color
  });
});
