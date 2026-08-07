import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('closes from the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose} title="Add New Board">
        <p>body</p>
      </Modal>,
    );

    // On a phone the modal is edge-to-edge, so there is no "outside" to tap -
    // without this button, changing your mind left you stuck.
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and on a click outside', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose}>
        <p>body</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // The overlay is the backdrop; the dialog itself stops propagation.
    const overlay = document.querySelector('div[class*="overlay"]');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(container).toBeTruthy();
  });

  it('does not close when the content itself is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose}>
        <p>body text</p>
      </Modal>,
    );

    await user.click(screen.getByText('body text'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('is announced as a modal dialog', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Settings">
        <p>body</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={vi.fn()} title="Trapped">
        <input aria-label="first" />
        <button type="button">last</button>
      </Modal>,
    );

    const first = screen.getByLabelText('first');
    const last = screen.getByRole('button', { name: 'last' });

    // Focus lands on the first field, not the close button: the point of opening a
    // form is to fill it in.
    expect(first).toHaveFocus();

    await user.tab();
    expect(last).toHaveFocus();

    // Wrapping matters: without it Tab walks into the page behind the overlay,
    // where a screen reader reads controls the user cannot see.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
  });

  it('wraps backwards too', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={vi.fn()} title="Trapped">
        <input aria-label="only" />
      </Modal>,
    );

    await user.tab({ shift: true });
    // From the first control, Shift+Tab goes to the last one in the dialog.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('hands focus back to whatever opened it', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            opener
          </button>
          {open && (
            <Modal isOpen onClose={() => setOpen(false)} title="Temp">
              <p>body</p>
            </Modal>
          )}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'opener' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // Otherwise a keyboard user is dumped at the top of the document.
    expect(opener).toHaveFocus();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden">
        <p>body</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
