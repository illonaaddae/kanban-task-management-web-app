import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Dropdown } from '../components/ui/Dropdown';
import { Loader } from '../components/ui/Loader';
import { ProgressPanel } from '../components/team/ProgressPanel';
import { AnalyticsPanel } from '../components/team/AnalyticsPanel';
import { AiTeamPlanner } from '../components/team/AiTeamPlanner';
import { useStore } from '../store/store';
import { Link } from 'react-router-dom';
import { useBoards } from '../queries/boards';
import { useCreateBoard, useUpdateBoard } from '../queries/mutations';
import {
  useAcceptMyInvitation,
  useCreateOrganization,
  useInviteToOrganization,
  useMyInvitations,
  useOrganization,
  useOrganizations,
  useOrgInvitations,
  useRemoveMember,
  useDeleteOrganization,
  useRenameOrganization,
  useRevokeInvitation,
  useUpdateMemberRole,
} from '../queries/orgs';
import type { OrgGrantableRole, OrgMember, PendingInvitation } from '../services/orgApi';
import toast from 'react-hot-toast';
import styles from './Teams.module.css';

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'boards', label: 'Boards' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function MemberAvatar({ member }: { member: OrgMember }) {
  if (member.avatar) return <img className={styles.avatar} src={member.avatar} alt="" />;
  return (
    <div className={styles.initials} aria-hidden="true">
      {initialsOf(member.name)}
    </div>
  );
}

/** "in 6 days", or "expired" once the link has lapsed. */
function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.round(ms / 86_400_000);
  if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Teams: membership, invitations and progress.
 *
 * A page rather than a modal. Managing people and reading a progress table are
 * both wide, multi-section jobs, and a dialog reachable only from an avatar menu
 * is not where anyone looks for either.
 */
export function Teams() {
  const currentUser = useStore((state) => state.user);

  const { data: organizations = [], isPending: orgsLoading } = useOrganizations();
  const { data: myInvitations = [] } = useMyInvitations();
  const { data: boards = [] } = useBoards();

  const [activeOrgId, setActiveOrgId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabId>('members');
  const [progressBoardId, setProgressBoardId] = useState<string | undefined>(undefined);

  // Follow the list rather than mirror it: a team that was just created or just
  // left must not leave this pointing at nothing.
  useEffect(() => {
    if (organizations.length === 0) {
      setActiveOrgId(undefined);
      return;
    }
    if (!organizations.some((org) => org.id === activeOrgId)) {
      setActiveOrgId(organizations[0].id);
    }
  }, [organizations, activeOrgId]);

  useEffect(() => {
    if (boards.length > 0 && !boards.some((board) => board.id === progressBoardId)) {
      setProgressBoardId(boards[0].id);
    }
  }, [boards, progressBoardId]);

  const { data: org, isPending: orgLoading } = useOrganization(activeOrgId);

  const canManage =
    org?.myRole === 'owner' || org?.myRole === 'orgAdmin' || org?.myRole === 'admin';
  const isOwner = org?.myRole === 'owner';

  const { data: invitations = [] } = useOrgInvitations(activeOrgId, canManage);

  const createOrg = useCreateOrganization();
  const renameOrg = useRenameOrganization();
  const deleteOrg = useDeleteOrganization();
  const invite = useInviteToOrganization();
  const revoke = useRevokeInvitation();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const acceptMine = useAcceptMyInvitation();
  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();

  const [newOrgName, setNewOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [role, setRole] = useState<OrgGrantableRole>('member');
  const [renaming, setRenaming] = useState('');
  /** Which row has a request in flight, so only that row disables. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /**
   * Shown when an invitation was created but its email did not go out. The link
   * is then the only way in, so it gets room on the page rather than a toast.
   */
  const [undeliveredLink, setUndeliveredLink] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [boardToMove, setBoardToMove] = useState('');
  /** Typed team name, so deleting a team cannot happen on one stray click. */
  const [deleteConfirm, setDeleteConfirm] = useState('');

  /** Boards already in the selected team. */
  const teamBoards = useMemo(
    () => boards.filter((board) => board.organizationId === activeOrgId),
    [boards, activeOrgId],
  );

  /**
   * Boards that could be moved in: ones the caller owns that are not already in
   * this team. Only an owner can move a board, so anything else would 403.
   */
  const movableBoards = useMemo(
    () =>
      boards.filter(
        (board) => board.myRole === 'owner' && board.organizationId !== activeOrgId,
      ),
    [boards, activeOrgId],
  );

  const boardOptions = useMemo(
    () =>
      boards
        .filter((board): board is typeof board & { id: string } => Boolean(board.id))
        .map((board) => ({ value: board.id, label: board.name })),
    [boards],
  );

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) return;

    try {
      const created = await createOrg.mutateAsync(trimmed);
      setActiveOrgId(created.id);
      setNewOrgName('');
      toast.success(`Created ${created.name}`);
    } catch (error) {
      fail(error, 'Could not create the team');
    }
  };

  const handleCreateBoardInTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newBoardName.trim();
    if (!trimmed || !activeOrgId) return;

    try {
      await createBoard.mutateAsync({
        name: trimmed,
        // The default columns a board is useless without. Two of them, so
        // "done" means something: see the two-column rule in progress.
        columns: [
          { name: 'Todo', tasks: [] },
          { name: 'Done', tasks: [] },
        ],
        organizationId: activeOrgId,
      });
      setNewBoardName('');
      toast.success(`Created ${trimmed} in ${org?.name ?? 'this team'}`);
    } catch (error) {
      fail(error, 'Could not create the board');
    }
  };

  const handleMoveBoardIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!boardToMove || !activeOrgId) return;

    const moving = boards.find((board) => board.id === boardToMove);
    try {
      await updateBoard.mutateAsync({
        boardId: boardToMove,
        updates: { name: moving?.name ?? '', organizationId: activeOrgId },
      });
      setBoardToMove('');
      toast.success(`${moving?.name ?? 'Board'} is now a team board`);
    } catch (error) {
      fail(error, 'Could not move the board');
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeOrgId || !org || deleteConfirm.trim() !== org.name) return;

    try {
      await deleteOrg.mutateAsync(activeOrgId);
      setDeleteConfirm('');
      setActiveOrgId(undefined);
      toast.success(`${org.name} deleted. Its boards are now personal.`);
    } catch (error) {
      fail(error, 'Could not delete the team');
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = renaming.trim();
    if (!activeOrgId || !trimmed || trimmed === org?.name) return;

    try {
      await renameOrg.mutateAsync({ orgId: activeOrgId, name: trimmed });
      setRenaming('');
      toast.success('Team renamed');
    } catch (error) {
      fail(error, 'Could not rename the team');
    }
  };

  const handleAcceptMine = async (invitationId: string, orgName: string) => {
    setBusyId(invitationId);
    try {
      await acceptMine.mutateAsync(invitationId);
      toast.success(`You joined ${orgName}`);
    } catch (error) {
      fail(error, 'Could not accept the invitation');
    } finally {
      setBusyId(null);
    }
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeOrgId) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Enter an email address');
      return;
    }
    setEmailError('');
    setUndeliveredLink(null);

    try {
      const result = await invite.mutateAsync({ orgId: activeOrgId, email: trimmed, role });
      setEmail('');

      if (result.emailSent) {
        toast.success(`Invitation sent to ${trimmed}`);
      } else {
        // Not a failure: the invitation exists and the link works.
        setUndeliveredLink(result.acceptUrl);
        toast.error(
          result.emailError ?? 'The invitation was created but the email could not be sent',
          { duration: 6000 },
        );
      }
    } catch (error) {
      // The API distinguishes an existing member (409), a duplicate pending
      // invitation (409) and inviting yourself (400) - its wording beats
      // anything generic here.
      fail(error, 'Could not send the invitation');
    }
  };

  const handleRoleChange = async (member: OrgMember, nextRole: string) => {
    if (!activeOrgId || nextRole === member.role) return;
    setBusyId(member.id);
    try {
      await updateRole.mutateAsync({
        orgId: activeOrgId,
        userId: member.id,
        role: nextRole as OrgGrantableRole,
      });
      toast.success(`${member.name} is now ${nextRole === 'admin' ? 'an admin' : 'a member'}`);
    } catch (error) {
      fail(error, 'Could not change the role');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (member: OrgMember) => {
    if (!activeOrgId) return;
    const isSelf = member.id === currentUser?.id;
    setBusyId(member.id);
    try {
      await removeMember.mutateAsync({ orgId: activeOrgId, userId: member.id });
      toast.success(isSelf ? 'You left the team' : `Removed ${member.name}`);
    } catch (error) {
      fail(error, 'Could not remove them');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (invitation: PendingInvitation) => {
    if (!activeOrgId) return;
    setBusyId(invitation.id);
    try {
      await revoke.mutateAsync({ orgId: activeOrgId, invitationId: invitation.id });
      toast.success(`Invitation to ${invitation.email} revoked`);
    } catch (error) {
      fail(error, 'Could not revoke it');
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invitation link copied');
    } catch {
      // Clipboard access needs a secure context and can be refused outright.
      toast.error('Could not copy - select the link and copy it manually');
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Teams</h1>
        {/* Role-aware: a plain member cannot invite anyone, and telling them to
            was just noise on a page that is otherwise about their own team. */}
        <p className={styles.subtitle}>
          {canManage
            ? 'Invite people by email. They do not need an account yet, and a board put in this team is reachable by everyone in it.'
            : 'The teams you belong to, and how the work on their boards is going.'}
        </p>
      </header>

      {/* Invitations addressed to this account, first: somebody who registered
          after being invited comes here looking for exactly this. */}
      {myInvitations.length > 0 && (
        <section className={styles.callout}>
          <h2 className={styles.sectionTitle}>Invitations for you</h2>
          {myInvitations.map((invitation) => (
            <div key={invitation.id} className={styles.row}>
              <div className={styles.identity}>
                <div className={styles.name}>{invitation.organizationName}</div>
                <div className={styles.email}>
                  as {invitation.role} · expires {expiryLabel(invitation.expiresAt)}
                </div>
              </div>
              <Button
                size="small"
                disabled={busyId === invitation.id}
                onClick={() =>
                  void handleAcceptMine(invitation.id, invitation.organizationName)
                }
              >
                Accept
              </Button>
            </div>
          ))}
        </section>
      )}

      {orgsLoading && organizations.length === 0 ? (
        <div className={styles.loading}>
          <Loader />
        </div>
      ) : organizations.length === 0 ? (
        <>
        {/* Also offered here, because describing a team is most useful when you
            have none yet: the branch below only appears for somebody who already
            has one. */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Set up a team with AI</h2>
          <AiTeamPlanner />
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Create your first team</h2>
          <p className={styles.hint}>
            A team is the people you work with. Once someone is in it, sharing a board
            with them is a click instead of a typed-out email address.
          </p>
          <form className={styles.stackForm} onSubmit={handleCreate}>
            <Input
              label="Team name"
              placeholder="e.g. Design Squad"
              value={newOrgName}
              maxLength={120}
              onChange={(event) => setNewOrgName(event.target.value)}
            />
            <Button type="submit" variant="primary" size="large" disabled={createOrg.isPending}>
              {createOrg.isPending ? 'Creating…' : 'Create team'}
            </Button>
          </form>
        </section>
        </>
      ) : (
        <>
          {/* Above the tabs, because switching team applies to every one of them.
              It used to live inside the members card, so you could not change team
              from any other tab. */}
          <div className={styles.teamHead}>
            <h2 className={styles.teamName}>{org?.name ?? 'Team'}</h2>
            <div className={styles.teamHeadActions}>
              {/* A one-option dropdown is a dead control, so with a single team the
                  heading says which one and only the New team button shows. */}
              {organizations.length > 1 && (
                <div className={styles.picker}>
                  <Dropdown
                    value={activeOrgId ?? ''}
                    onChange={setActiveOrgId}
                    options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                  />
                </div>
              )}
              {/* The create form lives in Settings. Reaching it used to mean knowing
                  that, which is not something a page should ask you to guess. */}
              <button
                type="button"
                className={styles.newTeamButton}
                onClick={() => setActiveTab('settings')}
              >
                + New team
              </button>
            </div>
          </div>

          {/* Nine cards competed on one page: the danger zone sat beside Rename and
              analytics fell below the fold. Tabs group by what you came to do. */}
          <div className={styles.tabBar} role="tablist" aria-label="Team sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.id === 'members' && org && (
                  <span className={styles.tabCount}>{org.members.length}</span>
                )}
                {tab.id === 'boards' && (
                  <span className={styles.tabCount}>{teamBoards.length}</span>
                )}
              </button>
            ))}
          </div>

          <div
            className={styles.panel}
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'members' && (
              <div className={styles.stack}>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>
                People{' '}
                <span className={styles.count}>
                  · {org?.members.length ?? 0} member
                  {(org?.members.length ?? 0) === 1 ? '' : 's'}
                </span>
              </h2>

              {orgLoading && !org ? (
                <div className={styles.loading}>
                  <Loader />
                </div>
              ) : (
                <div className={styles.list}>
                  {org?.members.map((member) => {
                    const isTeamOwner = member.role === 'owner';
                    const isSelf = member.id === currentUser?.id;
                    const busy = busyId === member.id;

                    return (
                      <div key={member.id} className={styles.row}>
                        <MemberAvatar member={member} />
                        <div className={styles.identity}>
                          <div className={styles.name}>
                            {member.name}
                            {isSelf && <span className={styles.you}> (you)</span>}
                          </div>
                          <div className={styles.email}>{member.email}</div>
                        </div>

                        {isTeamOwner ? (
                          // The owner is the team's `owner` field, not a member
                          // entry - there is nothing to change here.
                          <span className={`${styles.badge} ${styles.badgeOwner}`}>Owner</span>
                        ) : (
                          <>
                            {canManage ? (
                              <div className={styles.roleSelect}>
                                <Dropdown
                                  value={member.role}
                                  onChange={(value) => void handleRoleChange(member, value)}
                                  options={ROLE_OPTIONS}
                                />
                              </div>
                            ) : (
                              <span className={styles.badge}>
                                {member.role === 'admin' ? 'Admin' : 'Member'}
                              </span>
                            )}

                            {/* Anyone may remove themselves - that is "leave". */}
                            {(canManage || isSelf) && (
                              <button
                                type="button"
                                className={styles.removeButton}
                                onClick={() => void handleRemove(member)}
                                disabled={busy}
                                title={isSelf ? 'Leave team' : `Remove ${member.name}`}
                              >
                                {isSelf ? 'Leave' : 'Remove'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            {canManage && (
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>Invite someone</h2>
                <form className={styles.stackForm} onSubmit={handleInvite}>
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="teammate@example.com"
                    value={email}
                    error={emailError}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (event.target.value.trim()) setEmailError('');
                    }}
                  />
                  <Dropdown
                    label="Role"
                    value={role}
                    onChange={(value) => setRole(value as OrgGrantableRole)}
                    options={ROLE_OPTIONS}
                  />
                  <Button type="submit" variant="primary" size="large" disabled={invite.isPending}>
                    {invite.isPending ? 'Sending…' : 'Send invitation'}
                  </Button>
                </form>

                {undeliveredLink && (
                  <div className={styles.linkFallback}>
                    <p className={styles.hint}>
                      The invitation is valid but the email did not go out. Send this
                      link instead - it works once.
                    </p>
                    <code className={styles.link}>{undeliveredLink}</code>
                    <Button size="small" onClick={() => void copyLink(undeliveredLink)}>
                      Copy link
                    </Button>
                  </div>
                )}
              </section>
            )}
            {canManage && invitations.length > 0 && (
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>Pending ({invitations.length})</h2>
                <div className={styles.list}>
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className={styles.row}>
                      <div className={styles.initials} aria-hidden="true">@</div>
                      <div className={styles.identity}>
                        <div className={styles.name}>{invitation.email}</div>
                        <div className={styles.email}>
                          {invitation.role === 'admin' ? 'Admin' : 'Member'} · expires{' '}
                          {expiryLabel(invitation.expiresAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => void handleRevoke(invitation)}
                        disabled={busyId === invitation.id}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
              </div>
            )}

            {activeTab === 'boards' && (
              <div className={styles.stack}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.sectionTitle}>
                  Boards in this team{' '}
                  <span className={styles.count}>· {teamBoards.length}</span>
                </h2>
              </div>
              <p className={styles.hint}>
                Everyone in {org?.name ?? 'the team'} can open these and move cards on
                them, with no separate invitation per board.
              </p>

              {teamBoards.length > 0 ? (
                <div className={styles.list}>
                  {teamBoards.map((board) => (
                    <Link key={board.id} to={`/board/${board.id}`} className={styles.boardRow}>
                      <span className={styles.boardName}>{board.name}</span>
                      <span className={styles.boardMeta}>
                        {board.columns.length} column
                        {board.columns.length === 1 ? '' : 's'} ·{' '}
                        {board.columns.reduce((sum, column) => sum + column.tasks.length, 0)}{' '}
                        tasks
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={styles.hint}>No boards yet. Create one below.</p>
              )}

              {canManage && (
                <div className={styles.boardForms}>
                  <form className={styles.inlineForm} onSubmit={handleCreateBoardInTeam}>
                    <Input
                      label="Create a board in this team"
                      placeholder="e.g. Sprint 12"
                      value={newBoardName}
                      maxLength={120}
                      onChange={(event) => setNewBoardName(event.target.value)}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={createBoard.isPending || !newBoardName.trim()}
                    >
                      {createBoard.isPending ? 'Creating…' : 'Create board'}
                    </Button>
                  </form>

                  {movableBoards.length > 0 && (
                    <form className={styles.inlineForm} onSubmit={handleMoveBoardIn}>
                      <Dropdown
                        label="Or move one of your boards in"
                        value={boardToMove}
                        onChange={setBoardToMove}
                        options={[
                          { value: '', label: 'Pick a board' },
                          ...movableBoards.map((board) => ({
                            value: board.id as string,
                            label: board.name,
                          })),
                        ]}
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={updateBoard.isPending || !boardToMove}
                      >
                        {updateBoard.isPending ? 'Moving…' : 'Move in'}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </section>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Set up a team with AI</h2>
              <AiTeamPlanner />
            </section>
              </div>
            )}

            {activeTab === 'progress' && (
              <div className={styles.stack}>
            {canManage && (
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>Team analytics</h2>
                <p className={styles.hint}>
                  Every board belonging to {org?.name ?? 'this team'}, and who is
                  carrying what across all of them.
                </p>
                <AnalyticsPanel orgId={activeOrgId} canManage={canManage} />
              </section>
            )}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.sectionTitle}>Progress by board</h2>
                {boardOptions.length > 1 && (
                  <div className={styles.picker}>
                    <Dropdown
                      value={progressBoardId ?? ''}
                      onChange={setProgressBoardId}
                      options={boardOptions}
                    />
                  </div>
                )}
              </div>
              <p className={styles.hint}>
                {canManage
                  ? 'One board at a time. Everyone in this team appears on a board that belongs to the team; anyone else has to be shared onto it.'
                  : 'One board at a time, for the boards you can reach.'}
              </p>
              <ProgressPanel boardId={progressBoardId} />
            </section>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className={styles.stack}>
            {isOwner && (
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>Rename team</h2>
                <form className={styles.stackForm} onSubmit={handleRename}>
                  <Input
                    label="Team name"
                    placeholder={org?.name}
                    value={renaming}
                    maxLength={120}
                    onChange={(event) => setRenaming(event.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="large"
                    disabled={renameOrg.isPending || !renaming.trim()}
                  >
                    {renameOrg.isPending ? 'Saving…' : 'Rename'}
                  </Button>
                </form>
              </section>
            )}
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>New team</h2>
              <form className={styles.stackForm} onSubmit={handleCreate}>
                <Input
                  label="Team name"
                  placeholder="e.g. Marketing"
                  value={newOrgName}
                  maxLength={120}
                  onChange={(event) => setNewOrgName(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="large"
                  disabled={createOrg.isPending || !newOrgName.trim()}
                >
                  {createOrg.isPending ? 'Creating…' : 'Create team'}
                </Button>
              </form>
            </section>
            {isOwner && (
              <section className={`${styles.card} ${styles.danger}`}>
                <h2 className={styles.sectionTitle}>Delete team</h2>
                <p className={styles.hint}>
                  Members lose access to this team&rsquo;s boards, and pending
                  invitations stop working. The{' '}
                  <strong>{teamBoards.length} board{teamBoards.length === 1 ? '' : 's'}</strong>{' '}
                  in it are not deleted: each becomes personal again and stays with
                  whoever owns it.
                </p>
                <form className={styles.stackForm} onSubmit={handleDelete}>
                  <Input
                    label={`Type "${org?.name ?? ''}" to confirm`}
                    placeholder={org?.name}
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="large"
                    // Typing the name is the guard: this is not undoable, and the
                    // button sits a scroll away from the members list.
                    disabled={deleteOrg.isPending || deleteConfirm.trim() !== org?.name}
                  >
                    {deleteOrg.isPending ? 'Deleting…' : 'Delete this team'}
                  </Button>
                </form>
              </section>
            )}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default Teams;
