import { useMemo, useState, type FormEvent } from 'react';
import { useInviteCollaborator, useUpdateCollaboratorRole, useRemoveCollaborator } from '../../queries/mutations';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { MemberListSkeleton } from '../ui/Skeletons';
import { EmptyState, EMPTY_ICONS } from '../ui/EmptyState';
import { useBoardMembers } from '../../queries/boards';
import { useTeammates } from '../../queries/orgs';
import toast from 'react-hot-toast';
import type { BoardMember, CollaboratorRole } from '../../types';
import styles from './ShareModal.module.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
}

const ROLE_OPTIONS = [
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function MemberAvatar({ member }: { member: BoardMember }) {
  if (member.avatar) {
    return <img className={styles.avatar} src={member.avatar} alt="" />;
  }
  return (
    <div className={styles.initials} aria-hidden="true">
      {initialsOf(member.name)}
    </div>
  );
}

/**
 * Board sharing - owner only.
 *
 * The caller gates rendering on `canManageBoard`, but every action here is also
 * owner-only server-side, so a stale UI cannot grant anything: it just earns a
 * 403 whose message is shown as-is.
 */
export function ShareModal({ isOpen, onClose, boardId, boardName }: ShareModalProps) {
  const inviteCollaborator = useInviteCollaborator();
  const updateCollaboratorRole = useUpdateCollaboratorRole();
  const removeCollaborator = useRemoveCollaborator();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('editor');
  const [inviting, setInviting] = useState(false);
  /** Which member row has a request in flight, so only that row disables. */
  const [busyId, setBusyId] = useState<string | null>(null);

  // Refetches when the modal opens if the cached list has gone stale, so a
  // collaborator added elsewhere shows up.
  const { data: members = [], isPending: membersLoading } = useBoardMembers(
    isOpen ? boardId : undefined,
  );

  // People from the caller's teams, so sharing is a click rather than a typed
  // address. Purely a convenience: the invite below is the same request either
  // way, and being a teammate grants nothing on its own.
  const { data: teammates = [] } = useTeammates();

  /** Teammates who cannot already reach this board. */
  const suggestions = useMemo(() => {
    const known = new Set(members.map((member) => member.id));
    return teammates.filter((teammate) => !known.has(teammate.id));
  }, [teammates, members]);

  /** Invites a teammate straight away - the address is already known. */
  const inviteTeammate = async (email: string, name: string) => {
    setBusyId(email);
    try {
      await inviteCollaborator.mutateAsync({ boardId, email, role });
      toast.success(`Invited ${name} as ${role}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the invite');
    } finally {
      setBusyId(null);
    }
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Enter an email address');
      return;
    }
    setEmailError('');
    setInviting(true);

    try {
      await inviteCollaborator.mutateAsync({ boardId, email: trimmed, role });
      toast.success(`Invited ${trimmed} as ${role}`);
      setEmail('');
    } catch (error) {
      // The API distinguishes unknown account (404), already a collaborator
      // (409) and inviting the owner (409) - its wording is more useful than
      // anything generic we could write here.
      toast.error(error instanceof Error ? error.message : 'Could not send the invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: BoardMember, nextRole: string) => {
    if (nextRole === member.role) return;
    setBusyId(member.id);

    try {
      await updateCollaboratorRole.mutateAsync({ boardId, userId: member.id, role: nextRole as CollaboratorRole });
      toast.success(`${member.name} is now ${nextRole === 'editor' ? 'an editor' : 'a viewer'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the role');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (member: BoardMember) => {
    setBusyId(member.id);

    try {
      await removeCollaborator.mutateAsync({ boardId, userId: member.id });
      toast.success(`Removed ${member.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the collaborator');
    } finally {
      setBusyId(null);
    }
  };

  const collaborators = members.filter((member) => member.role !== 'owner');

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Share “{boardName}”</h2>
      <p className={styles.subtitle}>
        Editors can add, edit and move tasks. Viewers can see the board but cannot
        change anything.
      </p>

      <form className={styles.inviteForm} onSubmit={handleInvite}>
        <div className={styles.inviteRow}>
          <div className={styles.inviteEmail}>
            <Input
              label="Invite by email"
              type="email"
              placeholder="teammate@example.com"
              value={email}
              error={emailError}
              onChange={(event) => {
                setEmail(event.target.value);
                if (event.target.value.trim()) setEmailError('');
              }}
            />
          </div>
          <div className={styles.inviteRole}>
            <Dropdown
              label="Role"
              value={role}
              onChange={(value) => setRole(value as CollaboratorRole)}
              options={ROLE_OPTIONS}
            />
          </div>
        </div>
        <Button type="submit" variant="primary" size="large" disabled={inviting}>
          {inviting ? 'Sending invite…' : 'Send invite'}
        </Button>
      </form>

      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          <p className={styles.sectionTitle}>From your teams</p>
          <div className={styles.chips}>
            {suggestions.map((teammate) => (
              <button
                key={teammate.id}
                type="button"
                className={styles.chip}
                disabled={busyId === teammate.email || inviting}
                onClick={() => void inviteTeammate(teammate.email, teammate.name)}
                title={`${teammate.email} · ${teammate.teams.join(', ')}`}
              >
                <span className={styles.chipPlus} aria-hidden="true">+</span>
                {teammate.name}
              </button>
            ))}
          </div>
          <p className={styles.suggestionsHint}>
            Adds them as {role === 'editor' ? 'an editor' : 'a viewer'} on this board.
          </p>
        </div>
      )}

      <p className={styles.sectionTitle}>
        People with access ({members.length})
      </p>

      {membersLoading && members.length === 0 ? (
        <div className={styles.loading}>
          <MemberListSkeleton />
        </div>
      ) : (
        <div className={styles.list}>
          {members.map((member) => {
            const isOwner = member.role === 'owner';
            const viaTeam = member.via === 'team';
            const busy = busyId === member.id;

            return (
              <div key={member.id} className={styles.member}>
                <MemberAvatar member={member} />
                <div className={styles.identity}>
                  <div className={styles.name}>{member.name}</div>
                  <div className={styles.email}>{member.email}</div>
                </div>

                {isOwner ? (
                  // The owner's role is a property of the board, not a
                  // collaborator entry - there is nothing to change here.
                  <span className={`${styles.badge} ${styles.badgeOwner}`}>Owner</span>
                ) : viaTeam ? (
                  // Access comes from the team, so there is no collaborator entry
                  // to change or delete. Offering either would look like it worked
                  // and change nothing - remove them from the team, or take the
                  // board out of it.
                  <span className={styles.badge} title="Access through the team">
                    Team
                  </span>
                ) : (
                  <>
                    <div className={styles.roleSelect}>
                      <Dropdown
                        value={member.role}
                        onChange={(value) => void handleRoleChange(member, value)}
                        options={ROLE_OPTIONS}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => void handleRemove(member)}
                      disabled={busy}
                      aria-label={`Remove ${member.name}`}
                      title={`Remove ${member.name}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M1 1L13 13M13 1L1 13"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {collaborators.length === 0 && !membersLoading && (
            <EmptyState
              compact
              icon={EMPTY_ICONS.people}
              title="Only you can see this board"
              body={
                suggestions.length > 0
                  ? 'Pick a teammate above, or invite anyone by email.'
                  : 'Invite someone by email above. They do not need an account yet.'
              }
            />
          )}
        </div>
      )}
    </Modal>
  );
}
