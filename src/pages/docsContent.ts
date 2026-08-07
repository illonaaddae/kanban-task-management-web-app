/**
 * The documentation, as data.
 *
 * Content lives apart from the page that renders it so the navigation, the section
 * order and the deep links are all derived from one list rather than kept in step by
 * hand. Adding a section means adding an entry.
 *
 * Everything here describes behaviour that exists. Where a limitation is real it is
 * stated: documentation that oversells is worse than none, because it costs the
 * reader time before they find out.
 */

export interface DocBlock {
  kind: 'text' | 'steps' | 'code' | 'table' | 'note';
  /** `text` and `note` take a single string; the rest take lines or rows. */
  body?: string;
  lines?: string[];
  rows?: Array<[string, string]>;
  /** Column headings for a table. */
  headings?: [string, string];
}

export interface DocSection {
  /** Also the URL fragment, so every section is linkable. */
  id: string;
  title: string;
  summary: string;
  blocks: DocBlock[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'Create an account and get a board with work on it.',
    blocks: [
      {
        kind: 'steps',
        lines: [
          'Sign up with an email address and password, or use Google.',
          'Create a board and name its columns. Two is the minimum that means anything, because the last column is treated as done.',
          'Add tasks. A task needs only a title; description, subtasks, a due date and an assignee are all optional.',
          'Drag cards between columns. The order persists server-side, so a refresh or another device shows the same board.',
        ],
      },
      {
        kind: 'note',
        body: 'The last column by position counts as done, whatever it is called. Rename it freely; move a card into it to mark work finished.',
      },
    ],
  },
  {
    id: 'boards',
    title: 'Boards and columns',
    summary: 'How the board is structured and what each piece does.',
    blocks: [
      {
        kind: 'text',
        body: 'A board holds columns; columns hold tasks. Columns and tasks are separate records with their own order, so renaming a column keeps its tasks and deleting one takes its tasks with it.',
      },
      {
        kind: 'table',
        headings: ['Action', 'What happens'],
        rows: [
          ['Rename a column', 'Every task in it has its status updated to match, so nothing points at a name that no longer exists'],
          ['Delete a column', 'Its tasks are deleted with it and the remaining columns close the gap. The activity feed records how many tasks went'],
          ['Reorder columns', 'Positions are rewritten in one request, which must list exactly the board\'s columns'],
          ['Move a task', 'Both affected columns are rebalanced in a single write, and the task\'s status is set to the new column'],
        ],
      },
      {
        kind: 'note',
        body: 'A board with one column reports no completions at all. With a single column there is nothing for "done" to mean, so counting everything as finished would simply be wrong.',
      },
    ],
  },
  {
    id: 'teams',
    title: 'Teams and invitations',
    summary: 'Bring people in, including people with no account yet.',
    blocks: [
      {
        kind: 'text',
        body: 'A team is the people you work with. Invite by email address rather than by finding an existing user, which is what makes it possible to add somebody before they have signed up.',
      },
      {
        kind: 'steps',
        lines: [
          'Open Teams from the sidebar and create a team.',
          'Invite an address. If email is configured they receive a link; either way you can copy the link and send it yourself.',
          'Create a board in the team, or move an existing board into it. Every member can then reach that board without a separate invitation.',
          'Assign work to teammates. On a team board they are offered in the assignee list directly.',
        ],
      },
      {
        kind: 'table',
        headings: ['Team role', 'Can do'],
        rows: [
          ['Owner', 'Everything, including renaming and deleting the team'],
          ['Admin', 'Invite, revoke, change member roles, read team analytics'],
          ['Member', 'See the team and its boards, and leave'],
        ],
      },
      {
        kind: 'note',
        body: 'An invitation link works once and expires. Accepting it requires signing in with the address it was sent to, so forwarding the link to somebody else does not let them in.',
      },
    ],
  },
  {
    id: 'permissions',
    title: 'Permissions',
    summary: 'Who can do what, and in which order it is decided.',
    blocks: [
      {
        kind: 'text',
        body: 'Access to a board is resolved on every request, most specific first: the owner, then anyone invited to that board, then membership of the board\'s team. The first match wins.',
      },
      {
        kind: 'table',
        headings: ['Board role', 'Can do'],
        rows: [
          ['Owner', 'Rename, share, delete, plus everything an editor can'],
          ['Editor', 'Create, edit, move and delete tasks and columns'],
          ['Viewer', 'Read the board and its activity, and nothing else'],
        ],
      },
      {
        kind: 'text',
        body: 'Team membership grants editor, because somebody who cannot move a card cannot do the work the board exists for. Ordering matters here: an explicit invitation is checked before team membership, so adding one person as a viewer holds them read-only on a board the rest of their team can edit.',
      },
      {
        kind: 'note',
        body: 'The interface hides what you cannot do, but the API is what enforces it. A stale page cannot grant anything: the request is refused regardless of which buttons are on screen.',
      },
    ],
  },
  {
    id: 'progress',
    title: 'Progress and analytics',
    summary: 'Who is carrying what, per board and across a team.',
    blocks: [
      {
        kind: 'text',
        body: 'Board progress shows every person with access, their assigned and completed counts, overdue work and subtask totals. Anyone who can see the board can see it, because it reveals nothing they could not count themselves.',
      },
      {
        kind: 'text',
        body: 'Team analytics span every board the team owns, so they are limited to team admins and the owner. They include per-board completion and a per-person breakdown.',
      },
      {
        kind: 'table',
        headings: ['Term', 'Means'],
        rows: [
          ['Done', 'The task sits in the board\'s last column by position'],
          ['Overdue', 'The due date has passed and the task is not done. Finishing late does not leave it overdue'],
          ['Unassigned', 'A queue rather than a person, so it always sorts last'],
          ['Former member', 'Somebody who still has tasks but no longer has access. Their work is still counted, or the totals would disagree with the board'],
        ],
      },
      {
        kind: 'note',
        body: 'There is deliberately no single figure for one person across every team. It would have to span boards you may not be allowed to see, and nothing bounds it, so the number would either leak or mislead.',
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI assistant',
    summary: 'Optional drafting help that never writes on its own.',
    blocks: [
      {
        kind: 'text',
        body: 'Four places it appears. From a task title it drafts a description and subtasks. From a sentence it proposes a team, a first board and an invitee list. On a board, the command bar reads one instruction, and the Ask panel holds a conversation about the work.',
      },
      {
        kind: 'table',
        headings: ['Where', 'What it does'],
        rows: [
          ['Add or edit a task', 'Drafts a description and subtasks from the title, for you to edit before saving'],
          ['Teams', 'Turns a sentence into a proposed team, first board and invitee list'],
          ['Board, press /', 'Reads one instruction and shows exactly what it resolves to'],
          ['Board, Ask button', 'Answers questions about the board, and can offer one change per reply'],
        ],
      },
      {
        kind: 'text',
        body: 'Every one of them returns a proposal you edit or approve. Nothing is created or moved until you press the button, and then the ordinary endpoints do it with their usual validation and permission checks. A wrong answer can put bad text on the screen and nothing more.',
      },
      {
        kind: 'text',
        body: 'The command bar and the Ask panel share one resolver. The model only ever names an action from a closed set and the strings it applies to; matching those to real tasks, columns and people is done in the browser against the board already loaded, by exact match rather than nearest. A title that does not exist produces a refusal that says so, not a guess at the closest card.',
      },
      {
        kind: 'text',
        body: 'Both are limited to editors and above, because a reply that can offer a change has no business being drafted for somebody who could not make it. The conversation is capped at its last eight messages: each turn is a separate billed call carrying the transcript, so an unbounded one would grow more expensive the longer it ran.',
      },
      {
        kind: 'note',
        body: 'Email addresses are never invented. The assistant is told not to guess an address from a name, and any address that did not appear in what you typed is discarded before you see the proposal. Otherwise a made-up address would receive a real invitation.',
      },
      {
        kind: 'text',
        body: 'The whole feature is optional. Without an API key on the server the endpoints report that they are unconfigured and the buttons are not rendered, so nothing else changes.',
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    summary: 'Single keys, active when you are not typing.',
    blocks: [
      {
        kind: 'table',
        headings: ['Key', 'Does'],
        rows: [
          ['N', 'New task on the current board'],
          ['B', 'New board'],
          ['C', 'New column on the current board'],
          ['D', 'Go to your boards'],
          ['T', 'Go to Teams'],
          ['M', 'Go to My Tasks'],
          ['/', 'Ask for a change on the current board, or switch board from elsewhere'],
          ['K', 'Switch board'],
          ['?', 'Show the shortcut list'],
          ['Esc', 'Close a dialog'],
        ],
      },
      {
        kind: 'note',
        body: 'Ignored while a field has focus, so naming a board "New sprint" does not trigger the new-task shortcut, and ignored while a dialog is open so one keystroke cannot stack a second dialog on the first.',
      },
    ],
  },
  {
    id: 'self-hosting',
    title: 'Running it yourself',
    summary: 'Both halves, locally or deployed.',
    blocks: [
      {
        kind: 'code',
        lines: [
          'git clone https://github.com/illonaaddae/kanban-task-management-web-app',
          'cd kanban-task-management-web-app',
          'npm install && (cd server && npm install)',
          'cp server/.env.example server/.env   # fill in DATABASE_URL and the JWT secrets',
          'cd server && npm run seed           # three accounts, a team and a demo board',
          'npm run dev                         # API on 5050',
          'cd .. && npm run dev                # frontend on 5173',
        ],
      },
      {
        kind: 'text',
        body: 'The API needs MongoDB and two JWT secrets. Email, Google sign-in and the AI assistant are each optional: leave their keys unset and the features are simply absent rather than broken.',
      },
      {
        kind: 'note',
        body: 'Port 5050, not 5000. On macOS the AirPlay Receiver answers on 5000 with an empty 403 that reads exactly like a CORS failure, which costs an afternoon to diagnose.',
      },
      {
        kind: 'text',
        body: 'The full API reference, the deployment walkthrough for Azure and Render, and the Postman collection are all in the repository README.',
      },
    ],
  },
];
