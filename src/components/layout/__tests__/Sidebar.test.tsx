import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { renderWithProviders } from '../../../test/utils';
import * as boardQueries from '../../../queries/boards';

// `useBoards` is gated on `tokenStore.isAuthenticated`, so against the real hook
// the list stays empty in tests. Stub the hook — the board list is the fixture
// here, not the thing under test.
vi.mock('../../../queries/boards');

/**
 * Points `matchMedia` at one breakpoint answer for the duration of a test.
 * jsdom has no layout, so this is the only way to exercise behaviour that
 * differs between the desktop sidebar and the mobile drawer.
 */
function stubViewport(isNarrow: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isNarrow,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe('Sidebar', () => {
  beforeEach(() => {
    // Only `data` is read here; asserting the full UseQueryResult shape would be
    // 25 fields of noise.
    vi.mocked(boardQueries.useBoards).mockReturnValue({
      data: [{ id: 'b1', name: 'Platform Launch', columns: [] }],
    } as unknown as ReturnType<typeof boardQueries.useBoards>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not collapse itself when a board is opened on a desktop', async () => {
    stubViewport(false);
    const onToggle = vi.fn();
    renderWithProviders(<Sidebar isOpen onToggle={onToggle} />);

    fireEvent.click(await screen.findByText('Platform Launch'));

    // The sidebar is a column of the desktop layout — navigating within it is
    // not a reason to take it away.
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('dismisses itself when a board is opened in the mobile drawer', async () => {
    stubViewport(true);
    const onToggle = vi.fn();
    renderWithProviders(<Sidebar isOpen onToggle={onToggle} />);

    fireEvent.click(await screen.findByText('Platform Launch'));

    // The drawer covers the board it just navigated to.
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers a way back to the dashboard from the board list heading', async () => {
    stubViewport(false);
    renderWithProviders(<Sidebar isOpen onToggle={vi.fn()} />);

    const heading = await screen.findByText(/ALL BOARDS \(1\)/);
    expect(heading.closest('a')).toHaveAttribute('href', '/');
  });
});
