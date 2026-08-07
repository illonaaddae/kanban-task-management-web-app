import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { useStore } from '../store/store';
import { useAcceptInvitation, useInvitationPreview } from '../queries/orgs';
import toast from 'react-hot-toast';
import styles from './AcceptInvite.module.css';

/**
 * Where an invitation link lands.
 *
 * Deliberately readable while signed out: the invitee may have no account, and
 * the whole point of the screen is telling them which address to register with.
 * The token stays in the URL and is posted back on accept — it never goes into
 * storage, so closing the tab loses nothing that the email does not still hold.
 */
export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const user = useStore((state) => state.user);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const sessionLoading = useStore((state) => state.loading);

  const { data: invitation, isPending, error } = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const [joined, setJoined] = useState(false);

  // Sign-in and register both return here, so an accepted invitation should not
  // need a second click after the round trip.
  const emailMatches =
    !!user && !!invitation && user.email.toLowerCase() === invitation.email.toLowerCase();

  useEffect(() => {
    if (!token || !emailMatches || joined || accept.isPending) return;

    void accept
      .mutateAsync(token)
      .then((result) => {
        setJoined(true);
        toast.success(`You joined ${result.organizationName}`);
      })
      .catch((caught: unknown) => {
        toast.error(
          caught instanceof Error ? caught.message : 'Could not accept the invitation',
        );
      });
    // `accept` is a stable mutation object; including it would re-run this on
    // every status change, which is exactly the loop the `joined` guard exists
    // to prevent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, emailMatches, joined]);

  if (isPending || sessionLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <Loader />
        </div>
      </main>
    );
  }

  // A revoked, expired, already-used or simply wrong link. All of them are the
  // same thing to the person holding it: this does not work any more.
  if (error || !invitation) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>This invitation is no longer valid</h1>
          <p className={styles.body}>
            It may have expired, been revoked, or already been used. Ask whoever
            invited you to send a new one.
          </p>
          <Link to="/" className={styles.link}>
            Go to your boards
          </Link>
        </div>
      </main>
    );
  }

  if (joined) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>You&rsquo;re in</h1>
          <p className={styles.body}>
            You joined <strong>{invitation.organizationName}</strong> as{' '}
            {invitation.role}. Boards shared with the team will show up on your
            dashboard.
          </p>
          <Button size="large" onClick={() => navigate('/')}>
            Go to your boards
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {invitation.invitedBy
            ? `${invitation.invitedBy} invited you to join ${invitation.organizationName}`
            : `You have been invited to join ${invitation.organizationName}`}
        </h1>
        <p className={styles.body}>
          The invitation was sent to <strong>{invitation.email}</strong>. You will
          join as {invitation.role}.
        </p>

        {!isAuthenticated ? (
          <>
            <p className={styles.body}>
              Sign in or create an account with that address to accept.
            </p>
            <div className={styles.actions}>
              {/* The token stays in the URL, so coming back here lands on the
                  same invitation and it is accepted automatically. */}
              <Button
                size="large"
                onClick={() =>
                  navigate(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`)
                }
              >
                Sign in to accept
              </Button>
            </div>
          </>
        ) : !emailMatches ? (
          <>
            <p className={styles.mismatch}>
              You are signed in as <strong>{user?.email}</strong>, but this
              invitation is for <strong>{invitation.email}</strong>. Sign out and
              sign in with that address to accept it.
            </p>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="large"
                onClick={() => void useStore.getState().logout()}
              >
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <Loader />
          </div>
        )}
      </div>
    </main>
  );
}

export default AcceptInvite;
