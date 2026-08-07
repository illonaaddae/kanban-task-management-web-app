import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { PATHS } from '../routes';
import { Logo } from '../components/ui/Logo';
import { InviteArt, PermissionsArt, TeamBoardArt } from './landingArt';
import styles from './Landing.module.css';

/**
 * The public front door.
 *
 * Deliberately has no fabricated social proof: no customer logos, no compliance
 * badges, no invented testimonial with a percentage attached to an anonymous VP.
 * The product is real and small, and claiming otherwise is the fastest way to
 * lose a reader who looks twice. Everything below is either a feature that exists
 * or a fact about the stack.
 */

const FEATURES = [
  {
    number: '01',
    title: 'Boards that survive a refresh',
    body: 'Drag a card between columns and the position is persisted server-side, rebalancing both columns in one write. Reload, or open the board on another device, and the order is exactly where you left it.',
    points: ['Columns and tasks as first-class records', 'Subtasks with completion tracking', 'Due dates and assignees'],
  },
  {
    number: '02',
    title: 'Teams, not just sharing',
    body: 'Invite people by email address, whether or not they have an account yet. Put a board in a team and every member can reach it without a separate invitation each time.',
    points: ['One-time invitation links, single use', 'Roles: owner, admin, member', 'Board access follows team membership'],
  },
  {
    number: '03',
    title: 'Permissions you can reason about',
    body: 'Two independent levels. A global role, and a per-board role resolved on every request: owner, then any explicit invitation, then team membership. The explicit grant wins, so one person can be held read-only on a board their whole team edits.',
    points: ['401 and 403 kept distinct', 'Existence resolved before permission', 'Viewer mode enforced by the API, not the UI'],
  },
  {
    number: '04',
    title: 'A record of what happened',
    body: 'Every change is logged with who made it: cards moved, columns renamed or deleted, roles changed, people added. Grouped by day and filterable, so the feed answers questions instead of scrolling.',
    points: ['Per-person progress on any board', 'Team-wide analytics for admins', 'Overdue and completion tracking'],
  },
];

/**
 * The real order of operations.
 *
 * An earlier draft went straight from "make a board" to "invite your team", which
 * skipped the step that makes inviting possible: there is nobody to invite until a
 * team exists. Steps that leave out a prerequisite are worse than no steps, because
 * the reader follows them and gets stuck.
 */
const STEPS = [
  {
    title: 'Create an account',
    body: 'Email and password, or Google. Nothing to configure and no card.',
    aside: 'About a minute',
  },
  {
    title: 'Make a board',
    body: 'Name it and name its columns. Two is the minimum that means anything, because the last column counts as done.',
    aside: 'Todo, Doing, Done',
  },
  {
    title: 'Create a team',
    body: 'From Teams in the sidebar. A team is the people you work with, and it is what invitations belong to.',
    aside: 'Or describe it and let the assistant draft it',
  },
  {
    title: 'Add the board and invite people',
    body: 'Put the board in the team, then invite by email address. Every member reaches it without a separate invitation each time.',
    aside: 'They do not need an account yet',
  },
  {
    title: 'Assign and track',
    body: 'Give tasks owners and due dates. Progress, overdue counts and team analytics follow on their own.',
    aside: 'Nothing to maintain',
  },
];

const STACK = [
  'React 19', 'TypeScript', 'Vite', 'TanStack Query', 'dnd-kit',
  'Express 5', 'MongoDB', 'Mongoose', 'Zod', 'JWT',
];

const DOCS = [
  {
    title: 'Getting started',
    body: 'Clone the repo, install both halves, copy the env template and run the seed. Three accounts and a demo board with real content, ready to sign in to.',
    items: ['npm install at the root and in server/', 'cp server/.env.example server/.env', 'npm run seed'],
  },
  {
    title: 'The API',
    body: 'A REST API over boards, columns, tasks, teams and invitations. Consistent envelopes, precise status codes, and a Postman collection that chains a login token through every request.',
    items: ['Layered: routes, controllers, services, repositories', 'Zod validation with structured error details', 'GET /health for platform checks'],
  },
  {
    title: 'Self-hosting',
    body: 'The API runs anywhere Node does; it is deployed to Azure App Service with Render kept as a fallback. The frontend is a static Vite build.',
    items: ['MongoDB Atlas or any Mongo instance', 'Email delivery is optional', 'Google sign-in is optional'],
  },
];

export function Landing() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const sessionLoading = useStore((state) => state.loading);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Somebody already signed in wants their boards, not the sales pitch. Waits for
  // the session check so a reload does not flash the marketing page first.
  if (!sessionLoading && isAuthenticated) {
    return <Navigate to={PATHS.dashboard} replace />;
  }

  return (
    <div className={styles.page}>
      <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <Logo />
          <nav className={styles.navLinks} aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <Link to={PATHS.docs}>Docs</Link>
          </nav>
          <div className={styles.navActions}>
            <Link to={PATHS.login} className={styles.navSignIn}>
              Sign in
            </Link>
            <Link to={PATHS.login} className={styles.navCta}>
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>Open source kanban</p>
            <h1 className={styles.heroTitle}>
              Your team&rsquo;s work, <span className={styles.gradient}>in one place</span>.
            </h1>
            <p className={styles.heroBody}>
              Boards, teams and permissions that hold up. Drag a card and the order
              persists. Invite a teammate by email and they can pick up work on any
              board the team owns.
            </p>

            <div className={styles.heroActions}>
              <Link to={PATHS.login} className={styles.primaryCta}>
                Start free
              </Link>
              <a href="#how" className={styles.secondaryCta}>
                See how it works
              </a>
            </div>

            <p className={styles.heroNote}>
              No card required. Sign in with Google or an email address.
            </p>
          </div>

          {/* A drawn approximation of the board, not a screenshot: it stays honest
              when the UI changes, weighs nothing, and themes with the page. */}
          <div className={styles.heroArt} aria-hidden="true">
            <div className={styles.mockWindow}>
              <div className={styles.mockBar}>
                <span /><span /><span />
              </div>
              <div className={styles.mockBoard}>
                {[
                  { name: 'Todo', cards: 3, tone: styles.toneTodo },
                  { name: 'Doing', cards: 2, tone: styles.toneDoing },
                  { name: 'Done', cards: 4, tone: styles.toneDone },
                ].map((column) => (
                  <div key={column.name} className={styles.mockColumn}>
                    <div className={styles.mockColumnHead}>
                      <span className={`${styles.mockDot} ${column.tone}`} />
                      {column.name}
                    </div>
                    {Array.from({ length: column.cards }, (_, i) => (
                      <div key={i} className={styles.mockCard}>
                        <span className={styles.mockLine} style={{ width: `${65 + ((i * 11) % 30)}%` }} />
                        <span className={styles.mockLineSmall} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.stackStrip} aria-label="Built with">
          <p className={styles.stackLabel}>Built with</p>
          <ul className={styles.stackList}>
            {STACK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section id="features" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>What it actually does</h2>
            <p className={styles.sectionBody}>
              Four things, each of them finished rather than sketched.
            </p>
          </div>

          <div className={styles.features}>
            {FEATURES.map((feature) => (
              <article key={feature.number} className={styles.feature}>
                <span className={styles.featureNumber}>{feature.number}</span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureBody}>{feature.body}</p>
                <ul className={styles.featurePoints}>
                  {feature.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.illustrated}>
            <article className={styles.featureWide}>
              <div>
                <h3 className={styles.featureTitle}>Work belongs to somebody</h3>
                <p className={styles.featureBody}>
                  Every card can carry an assignee and a due date, and dragging one
                  between columns persists immediately. The board is the same for
                  everyone looking at it.
                </p>
              </div>
              <TeamBoardArt />
            </article>

            <article className={styles.featureWide}>
              <div>
                <h3 className={styles.featureTitle}>Access resolves in one order</h3>
                <p className={styles.featureBody}>
                  Owner first, then anyone invited to that board specifically, then
                  membership of the board&rsquo;s team. The explicit grant wins, which
                  is how one person stays read-only on a board their team edits.
                </p>
              </div>
              <PermissionsArt />
            </article>

            <article className={styles.featureWide}>
              <div>
                <h3 className={styles.featureTitle}>Invite an address, not an account</h3>
                <p className={styles.featureBody}>
                  Send an invitation to anyone, whether or not they have signed up.
                  The link works once, expires, and can be revoked before it is used.
                </p>
              </div>
              <InviteArt />
            </article>
          </div>
        </section>

        <section id="how" className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>From nothing to a team tracking work</h2>
            <p className={styles.sectionBody}>
              Five steps, in the order they actually happen. No manual required.
            </p>
          </div>

          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                {/* The numeral is the visual anchor, so the sequence reads as a
                    sequence rather than as four similar paragraphs. */}
                <span className={styles.stepNumber} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {/* The text is one column beside the numeral. Without this wrapper
                    the title, body and aside became three flex siblings of the
                    numeral and sat side by side in narrow strips. */}
                <div className={styles.stepText}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepBody}>{step.body}</p>
                  <p className={styles.stepAside}>{step.aside}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="docs" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Docs and guides</h2>
            <p className={styles.sectionBody}>
              Everything needed to run it yourself. The repository README carries the
              full API reference and the deployment walkthrough.
            </p>
          </div>

          <div className={styles.docs}>
            {DOCS.map((doc) => (
              <article key={doc.title} className={styles.doc}>
                <h3 className={styles.docTitle}>{doc.title}</h3>
                <p className={styles.docBody}>{doc.body}</p>
                <ul className={styles.docList}>
                  {doc.items.map((item) => (
                    <li key={item}>
                      <code>{item}</code>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className={styles.docsActions}>
            <Link className={styles.primaryCta} to={PATHS.docs}>
              Read the docs
            </Link>
            <a
              className={styles.docsLink}
              href="https://github.com/illonaaddae/kanban-task-management-web-app#readme"
              target="_blank"
              rel="noreferrer noopener"
            >
              API reference on GitHub
            </a>
          </div>
        </section>

        <section className={styles.closing}>
          <h2 className={styles.closingTitle}>Start with one board</h2>
          <p className={styles.closingBody}>
            Create an account, make a board, invite whoever you work with. It takes
            about a minute, and everything above is included.
          </p>
          <div className={styles.heroActions}>
            <Link to={PATHS.login} className={styles.primaryCta}>
              Start free
            </Link>
            <Link to={PATHS.login} className={styles.secondaryCta}>
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Logo />
            <p>A kanban board with teams, permissions and an audit trail.</p>
          </div>

          <div className={styles.footerCols}>
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <Link to={PATHS.login}>Sign in</Link>
            </div>
            <div>
              <h4>Docs</h4>
              <Link to={`${PATHS.docs}#getting-started`}>Getting started</Link>
              <Link to={`${PATHS.docs}#permissions`}>Permissions</Link>
              <Link to={`${PATHS.docs}#self-hosting`}>Running it yourself</Link>
              <a
                href="https://github.com/illonaaddae/kanban-task-management-web-app#readme"
                target="_blank"
                rel="noreferrer noopener"
              >
                API reference
              </a>
              <a
                href="https://github.com/illonaaddae/kanban-task-management-web-app/tree/main/postman"
                target="_blank"
                rel="noreferrer noopener"
              >
                Postman collection
              </a>
            </div>
            <div>
              {/* A portfolio project should say who built it. Only links that are
                  verified are here: a placeholder URL in a footer is worse than an
                  absent one, because it looks like a broken site. */}
              <h4>Built by</h4>
              <a
                href="https://github.com/illonaaddae"
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub profile
              </a>
            </div>

            <div>
              <h4>Project</h4>
              <a
                href="https://github.com/illonaaddae/kanban-task-management-web-app"
                target="_blank"
                rel="noreferrer noopener"
              >
                Source
              </a>
              <a
                href="https://github.com/illonaaddae/kanban-task-management-web-app/issues"
                target="_blank"
                rel="noreferrer noopener"
              >
                Issues
              </a>
            </div>
          </div>
        </div>

        <p className={styles.footerNote}>
          Built by Illona Addae. Design based on the Frontend Mentor kanban brief.
        </p>
      </footer>
    </div>
  );
}

export default Landing;
