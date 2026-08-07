import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { PATHS } from '../routes';
import { ThemeToggleButton } from '../components/ui/ThemeToggleButton';
import { DOC_SECTIONS, type DocBlock } from './docsContent';
import styles from './Docs.module.css';

/**
 * The documentation, as a page rather than anchors on the marketing copy.
 *
 * Public: somebody deciding whether to run this needs to read how it works before
 * signing up. Every section is deep-linkable, and the contents list highlights
 * whichever one is on screen so a long page still tells you where you are.
 */

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case 'text':
      return <p className={styles.paragraph}>{block.body}</p>;

    case 'note':
      return (
        <aside className={styles.note}>
          <span className={styles.noteLabel}>Worth knowing</span>
          <p>{block.body}</p>
        </aside>
      );

    case 'steps':
      return (
        <ol className={styles.steps}>
          {(block.lines ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      );

    case 'code':
      return (
        // One block rather than a line each, so it can be copied in one go.
        <pre className={styles.code}>
          <code>{(block.lines ?? []).join('\n')}</code>
        </pre>
      );

    case 'table':
      return (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{block.headings?.[0]}</th>
                <th scope="col">{block.headings?.[1]}</th>
              </tr>
            </thead>
            <tbody>
              {(block.rows ?? []).map(([left, right]) => (
                <tr key={left}>
                  <th scope="row">{left}</th>
                  <td>{right}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

export function Docs() {
  const [active, setActive] = useState(DOC_SECTIONS[0].id);

  /**
   * Highlights the section currently on screen.
   *
   * An observer rather than a scroll handler: it reports only when a boundary is
   * crossed, instead of running on every scroll event and recomputing offsets.
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      // Biased to the upper part of the viewport, so the highlight matches the
      // heading being read rather than one scrolling into the bottom.
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    for (const section of DOC_SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link to={PATHS.landing} className={styles.brand} aria-label="Home">
            <Logo />
          </Link>
          <span className={styles.navTitle}>Docs</span>
          <div className={styles.navActions}>
            <ThemeToggleButton />
            <Link to={PATHS.landing} className={styles.navLink}>
              Back to site
            </Link>
            <Link to={PATHS.login} className={styles.navCta}>
              Start free
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.contents} aria-label="Contents">
          <p className={styles.contentsLabel}>On this page</p>
          <ul>
            {DOC_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={active === section.id ? styles.contentsActive : undefined}
                  aria-current={active === section.id ? 'true' : undefined}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className={styles.content}>
          <header className={styles.intro}>
            <h1 className={styles.title}>Documentation</h1>
            <p className={styles.introBody}>
              How the app behaves, what the permissions actually mean, and how to run
              it yourself. Where something is deliberately limited, it says so.
            </p>
          </header>

          {DOC_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {section.title}
                {/* A quiet self-link, so a section can be pointed at directly. */}
                <a
                  href={`#${section.id}`}
                  className={styles.anchor}
                  aria-label={`Link to ${section.title}`}
                >
                  #
                </a>
              </h2>
              <p className={styles.summary}>{section.summary}</p>

              {section.blocks.map((block, index) => (
                <Block key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}

          <section className={styles.closing}>
            <h2 className={styles.sectionTitle}>Anything missing?</h2>
            <p className={styles.paragraph}>
              The repository README carries the full API reference, the deployment
              walkthrough and a Postman collection covering every endpoint.
            </p>
            <div className={styles.closingActions}>
              <a
                className={styles.navCta}
                href="https://github.com/illonaaddae/kanban-task-management-web-app#readme"
                target="_blank"
                rel="noreferrer noopener"
              >
                Read the README
              </a>
              <Link to={PATHS.login} className={styles.navLink}>
                Create an account
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Docs;
