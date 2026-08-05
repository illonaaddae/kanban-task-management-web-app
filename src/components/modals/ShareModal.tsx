import { useEffect, useState, type FormEvent } from 'react';
import { useStore } from '../../store/store';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { Loader } from '../ui/Loader';
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
 * Board sharing — owner only.
 *
 * The caller gates rendering on `canManageBoard`, but every action here is also
 * owner-only server-side, so a stale UI cannot grant anything: it just earns a
 * 403 whose message is shown as-is.
 */
export function ShareModal({ isOpen, onClose, boardId, boardName }: ShareModalProps) {
  const {
    members,
    membersLoading,
    fetchMembers,
    inviteCollaborator,
    updateCollaboratorRole,
    removeCollaborator,
  } = useStore(
    useShallow((state) => ({
      members: state.members,
      membersLoading: state.membersLoading,
      fetchMembers: state.fetchMembers,
      inviteCollaborator: state.inviteCollaborator,
      updateCollaboratorRole: state.updateCollaboratorRole,
      removeCollaborator: state.removeCollaborator,
    })),
  );

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('editor');
  const [inviting, setInviting] = useState(false);
  /** Which member row has a request in flight, so only that row disables. */
  const [busyId, setBusyId] = useState<string | null>(null);

  // Re-read on open: a collaborator may have been added or removed elsewhere
  // since this board was last looked at.
  useEffect(() => {
    if (isOpen) void fetchMembers(boardId);
  }, [isOpen, boardId, fetchMembers]);

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
      await inviteCollaborator(boardId, trimmed, role);
      toast.success(`Invited ${trimmed} as ${role}`);
      setEmail('');
    } catch (error) {
      // The API distinguishes unknown account (404), already a collaborator
      // (409) and inviting the owner (409) — its wording is more useful than
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
      await updateCollaboratorRole(boardId, member.id, nextRole as CollaboratorRole);
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
      await removeCollaborator(boardId, member.id);
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

      <p className={styles.sectionTitle}>
        People with access ({members.length})
      </p>

      {membersLoading && members.length === 0 ? (
        <div className={styles.loading}>
          <Loader />
        </div>
      ) : (
        <div className={styles.list}>
          {members.map((member) => {
            const isOwner = member.role === 'owner';
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
                  // collaborator entry — there is nothing to change here.
                  <span className={`${styles.badge} ${styles.badgeOwner}`}>Owner</span>
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
            <p className={styles.empty}>
              Only you can see this board. Invite someone above to collaborate.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
