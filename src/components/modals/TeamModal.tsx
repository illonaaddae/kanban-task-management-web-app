import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { Loader } from '../ui/Loader';
import { useStore } from '../../store/store';
import {
  useAcceptMyInvitation,
  useCreateOrganization,
  useInviteToOrganization,
  useMyInvitations,
  useOrganization,
  useOrganizations,
  useOrgInvitations,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
} from '../../queries/orgs';
import type { OrgGrantableRole, OrgMember, PendingInvitation } from '../../services/orgApi';
import toast from 'react-hot-toast';
import styles from './TeamModal.module.css';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  if (member.avatar) {
    return <img className={styles.avatar} src={member.avatar} alt="" />;
  }
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

  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`;

  const hours = Math.max(1, Math.round(ms / (60 * 60 * 1000)));
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Teams, from the profile menu.
 *
 * Board sharing can only reach people who already have an account — "user not
 * found" was the most common outcome of trying to share. An organization invite
 * goes to an address instead, so the person can be brought in before they have
 * signed up at all.
 */
export function TeamModal({ isOpen, onClose }: TeamModalProps) {
  const currentUser = useStore((state) => state.user);

  const { data: organizations = [], isPending: orgsLoading } = useOrganizations();
  const { data: myInvitations = [] } = useMyInvitations();

  const [activeOrgId, setActiveOrgId] = useState<string | undefined>(undefined);

  // Follow the list rather than mirror it: an organization that was just created
  // or just left should not leave this pointing at nothing.
  useEffect(() => {
    if (organizations.length === 0) {
      setActiveOrgId(undefined);
      return;
    }
    const stillThere = organizations.some((org) => org.id === activeOrgId);
    if (!stillThere) setActiveOrgId(organizations[0].id);
  }, [organizations, activeOrgId]);

  const { data: org, isPending: orgLoading } = useOrganization(
    isOpen ? activeOrgId : undefined,
  );

  const canManage =
    org?.myRole === 'owner' || org?.myRole === 'orgAdmin' || org?.myRole === 'admin';

  const { data: invitations = [] } = useOrgInvitations(
    isOpen ? activeOrgId : undefined,
    canManage,
  );

  const createOrg = useCreateOrganization();
  const invite = useInviteToOrganization();
  const revoke = useRevokeInvitation();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const acceptMine = useAcceptMyInvitation();

  const [newOrgName, setNewOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [role, setRole] = useState<OrgGrantableRole>('member');
  /** Which row has a request in flight, so only that row disables. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /**
   * Shown when an invite was created but the email did not go out — the link is
   * the only way the invitee can get in, so it must not be lost.
   */
  const [undeliveredLink, setUndeliveredLink] = useState<string | null>(null);

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
      toast.error(error instanceof Error ? error.message : 'Could not create the team');
    }
  };

  const handleAcceptMine = async (invitationId: string, orgName: string) => {
    setBusyId(invitationId);

    try {
      await acceptMine.mutateAsync(invitationId);
      setActiveOrgId(undefined);
      toast.success(`You joined ${orgName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not accept the invitation');
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
      // invite (409) and inviting yourself (400) — its wording beats anything
      // generic here.
      toast.error(error instanceof Error ? error.message : 'Could not send the invitation');
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
      toast.error(error instanceof Error ? error.message : 'Could not change the role');
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
      toast.error(error instanceof Error ? error.message : 'Could not remove them');
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
      toast.error(error instanceof Error ? error.message : 'Could not revoke it');
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
      toast.error('Could not copy — select the link and copy it manually');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Your teams</h2>
      <p className={styles.subtitle}>
        Invite people by email — they do not need an account yet. Team members can
        be assigned tasks on boards you share with them.
      </p>

      {/* Invitations waiting for this account. Shown first: someone who
          registered after being invited arrives here looking for exactly this. */}
      {myInvitations.length > 0 && (
        <section className={styles.pendingForMe}>
          <p className={styles.sectionTitle}>Invitations for you</p>
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
                onClick={() => void handleAcceptMine(invitation.id, invitation.organizationName)}
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
        <form className={styles.createForm} onSubmit={handleCreate}>
          <p className={styles.empty}>
            You are not in a team yet. Create one to start inviting people.
          </p>
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
      ) : (
        <>
          {organizations.length > 1 && (
            <div className={styles.orgPicker}>
              <Dropdown
                label="Team"
                value={activeOrgId ?? ''}
                onChange={setActiveOrgId}
                options={organizations.map((o) => ({ value: o.id, label: o.name }))}
              />
            </div>
          )}

          {canManage && (
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
                    onChange={(value) => setRole(value as OrgGrantableRole)}
                    options={ROLE_OPTIONS}
                  />
                </div>
              </div>
              <Button type="submit" variant="primary" size="large" disabled={invite.isPending}>
                {invite.isPending ? 'Sending invitation…' : 'Send invitation'}
              </Button>
            </form>
          )}

          {undeliveredLink && (
            <div className={styles.linkFallback}>
              <p className={styles.linkFallbackText}>
                The invitation is valid but the email did not go out. Send this link
                instead — it can be used once.
              </p>
              <code className={styles.link}>{undeliveredLink}</code>
              <Button size="small" onClick={() => void copyLink(undeliveredLink)}>
                Copy link
              </Button>
            </div>
          )}

          <p className={styles.sectionTitle}>
            Members ({org?.members.length ?? 0})
          </p>

          {orgLoading && !org ? (
            <div className={styles.loading}>
              <Loader />
            </div>
          ) : (
            <div className={styles.list}>
              {org?.members.map((member) => {
                const isOwner = member.role === 'owner';
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

                    {isOwner ? (
                      // The owner's role is a property of the team, not a member
                      // entry — there is nothing to change here.
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

                        {/* Anyone may remove themselves — that is "leave team". */}
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

          {canManage && invitations.length > 0 && (
            <>
              <p className={styles.sectionTitle}>Pending invitations ({invitations.length})</p>
              <div className={styles.list}>
                {invitations.map((invitation) => (
                  <div key={invitation.id} className={styles.row}>
                    <div className={styles.initials} aria-hidden="true">
                      @
                    </div>
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
            </>
          )}

          <form className={styles.createInline} onSubmit={handleCreate}>
            <Input
              label="Create another team"
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
        </>
      )}
    </Modal>
  );
}
