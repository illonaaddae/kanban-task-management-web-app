import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '../DatePicker';

describe('DatePicker', () => {
  beforeEach(() => {
    // Fixed clock: "today" and the default month have to be predictable.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 7, 12, 0, 0)); // 7 August 2026, local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the placeholder when there is no date', () => {
    render(<DatePicker value="" onChange={vi.fn()} />);

    expect(screen.getByText('No due date')).toBeInTheDocument();
  });

  it('renders the stored value as the day the user picked, not the day before', () => {
    // `new Date('2026-08-07')` is UTC midnight, which is 6 August for anyone west
    // of Greenwich. The component builds the date from parts to avoid that.
    render(<DatePicker value="2026-08-07" onChange={vi.fn()} />);

    // The trigger's label carries the ISO value; the visible text is locale
    // formatted, so assert the day number rather than a fixed word order.
    expect(screen.getByRole('button', { name: 'Due date 2026-08-07' })).toBeInTheDocument();
    expect(screen.getByText(/\b7\b/)).toBeInTheDocument();
  });

  it('emits yyyy-mm-dd in local time for the day clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Set a due date' }));
    await user.click(screen.getByRole('button', { name: '20' }));

    // A UTC round-trip here would emit 2026-08-19.
    expect(onChange).toHaveBeenCalledWith('2026-08-20');
  });

  it('closes once a day is chosen', async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Set a due date' }));
    expect(screen.getByRole('dialog', { name: 'Choose a date' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '15' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears the date without opening the calendar', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-07" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Clear due date' }));

    expect(onChange).toHaveBeenCalledWith('');
    // A due date has to be removable, and doing so should not leave a calendar
    // hanging open over the form.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('walks backwards and forwards through months', async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-07" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Due date 2026-08-07' }));
    expect(screen.getByText('August 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('crosses a year boundary', async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-01-15" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Due date 2026-01-15' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByText('December 2025')).toBeInTheDocument();
  });

  it('offers Today and Clear shortcuts', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-20" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Due date 2026-08-20' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(onChange).toHaveBeenCalledWith('2026-08-07');
  });

  it('marks the selected day as pressed', async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-07" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Due date 2026-08-07' }));

    expect(screen.getByRole('button', { name: '7' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('closes on Escape without letting it reach an enclosing modal', async () => {
    const onOuterEscape = vi.fn();
    const user = userEvent.setup();

    render(
      <div onKeyDown={(event) => event.key === 'Escape' && onOuterEscape()}>
        <DatePicker value="" onChange={vi.fn()} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Set a due date' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // One press should shut the calendar, not the task form around it.
    expect(onOuterEscape).not.toHaveBeenCalled();
  });

  it('closes when clicking away', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DatePicker value="" onChange={vi.fn()} />
        <button type="button">elsewhere</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Set a due date' }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
