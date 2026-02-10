import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NotFound } from '../NotFound';

function renderNotFound() {
  return render(
    <BrowserRouter>
      <NotFound />
    </BrowserRouter>
  );
}

describe('NotFound Component', () => {
  it('should render 404 message', () => {
    renderNotFound();

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('should render navigation buttons', () => {
    renderNotFound();

    expect(screen.getByRole('button', { name: /return to dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('should have working navigation buttons', async () => {
    const user = userEvent.setup();
    renderNotFound();

    const dashboardButton = screen.getByRole('button', { name: /return to dashboard/i });
    const backButton = screen.getByRole('button', { name: /go back/i });

    expect(dashboardButton).toBeEnabled();
    expect(backButton).toBeEnabled();

    // Click should not throw errors
    await user.click(dashboardButton);
    await user.click(backButton);
  });
});
