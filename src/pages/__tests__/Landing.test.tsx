import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Landing } from '../Landing';
import { useStore } from '../../store/store';
import { PATHS } from '../../routes';
import { ThemeProvider } from '../../context/ThemeContext';

function renderLanding() {
  // The nav carries a theme toggle, so the page needs the provider. Its own
  // MemoryRouter stays, because these tests assert on the signed-in redirect.
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[PATHS.landing]}>
        <Routes>
          <Route path={PATHS.landing} element={<Landing />} />
          <Route path={PATHS.dashboard} element={<p>dashboard reached</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Landing', () => {
  beforeEach(() => {
    useStore.setState({ isAuthenticated: false, loading: false, user: null });
  });

  it('shows the pitch and a sign-up route to a signed-out visitor', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // Two entry points, both landing on the auth page.
    const ctas = screen.getAllByRole('link', { name: /start free/i });
    expect(ctas.length).toBeGreaterThan(0);
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', PATHS.login));
  });

  it('sends a signed-in visitor straight to their boards', () => {
    useStore.setState({ isAuthenticated: true, loading: false });

    renderLanding();

    // Somebody already signed in wants their work, not the sales pitch.
    expect(screen.getByText('dashboard reached')).toBeInTheDocument();
  });

  it('waits for the session check before redirecting', () => {
    // Mid-check on a reload. Redirecting on an unresolved session would bounce a
    // signed-in user through the marketing page every time they refresh.
    useStore.setState({ isAuthenticated: false, loading: true });

    renderLanding();

    expect(screen.queryByText('dashboard reached')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('makes no claims it cannot back up', () => {
    renderLanding();

    // No invented certifications, customer logos or testimonials: the product is
    // real and small, and fabricated social proof is what a careful reader checks.
    const text = document.body.textContent ?? '';
    for (const claim of ['SOC 2', 'ISO 27001', 'HIPAA', 'trusted by', 'customers worldwide']) {
      expect(text).not.toContain(claim);
    }
  });

  it('links to the docs page and to the source', () => {
    renderLanding();

    // Docs are a real page now, not an anchor on this one.
    expect(screen.getByRole('link', { name: /^read the docs$/i })).toHaveAttribute(
      'href',
      PATHS.docs,
    );
    // Two of them: the docs section and the footer. Both must point at the repo.
    const apiLinks = screen.getAllByRole('link', { name: /api reference/i });
    expect(apiLinks.length).toBeGreaterThan(0);
    apiLinks.forEach((link) =>
      expect(link).toHaveAttribute('href', expect.stringContaining('github.com')),
    );
  });

  it('links the portfolio site, not a placeholder', () => {
    renderLanding();

    // Pinned, because a footer link that quietly rots is worse than an absent one:
    // it looks like a broken site rather than a missing one.
    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(links).toContain('https://oceaniccoder.dev');
  });
});
