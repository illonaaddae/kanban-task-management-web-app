import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggleButton } from '../ThemeToggleButton';
import { renderWithProviders } from '../../../test/utils';

describe('ThemeToggleButton', () => {
  it('names the theme it switches to, and flips on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggleButton />);

    // The label is the outcome, not the current state: "dark" alone does not say
    // which of the two it means.
    const button = screen.getByRole('button', { name: /switch to (light|dark) theme/i });
    const before = button.getAttribute('aria-label');

    await user.click(button);

    expect(
      screen.getByRole('button', { name: /switch to (light|dark) theme/i }).getAttribute('aria-label'),
    ).not.toBe(before);
  });

  it('writes the theme onto the document, which is what the CSS reads', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggleButton />);

    await user.click(screen.getByRole('button', { name: /switch to/i }));

    expect(['light', 'dark']).toContain(
      document.documentElement.getAttribute('data-theme'),
    );
  });
});
