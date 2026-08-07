import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Docs } from '../Docs';
import { DOC_SECTIONS } from '../docsContent';
import { PATHS } from '../../routes';

function renderDocs() {
  return render(
    <MemoryRouter initialEntries={[PATHS.docs]}>
      <Docs />
    </MemoryRouter>,
  );
}

describe('Docs', () => {
  it('renders every section with a linkable id', () => {
    renderDocs();

    for (const section of DOC_SECTIONS) {
      expect(
        screen.getByRole('heading', { level: 2, name: new RegExp(section.title, 'i') }),
        `${section.title} is missing`,
      ).toBeInTheDocument();
      // Deep links are the point of a docs page: each section must be addressable.
      expect(document.getElementById(section.id), `#${section.id} is missing`).not.toBeNull();
    }
  });

  it('lists every section in the contents', () => {
    renderDocs();

    const contents = screen.getByRole('navigation', { name: /contents/i });
    for (const section of DOC_SECTIONS) {
      expect(contents).toHaveTextContent(section.title);
    }
  });

  it('covers creating a team, which the landing steps once skipped', () => {
    renderDocs();

    // There is nobody to invite until a team exists; documentation that omits a
    // prerequisite sends the reader into a dead end.
    const teams = DOC_SECTIONS.find((s) => s.id === 'teams');
    expect(teams).toBeDefined();
    expect(document.body.textContent).toMatch(/create a team/i);
  });

  it('states the limitations rather than only the features', () => {
    renderDocs();

    const text = document.body.textContent ?? '';
    // Each of these is a real constraint a reader would otherwise discover the
    // hard way.
    expect(text).toMatch(/one column reports no completions/i);
    expect(text).toMatch(/works once/i);
    expect(text).toMatch(/never invented/i);
  });

  it('is reachable without an account', () => {
    // No auth gate: somebody deciding whether to run this reads it before signing up.
    renderDocs();
    expect(screen.getByRole('heading', { level: 1, name: /documentation/i })).toBeInTheDocument();
  });
});
