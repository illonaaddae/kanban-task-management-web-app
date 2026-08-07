import { useState, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAiStatus, useTeamPlan } from '../../queries/orgs';
import { useCreateOrganization, useInviteToOrganization } from '../../queries/orgs';
import { useCreateBoard } from '../../queries/mutations';
import type { TeamPlan } from '../../services/aiApi';
import toast from 'react-hot-toast';
import styles from './AiTeamPlanner.module.css';

/**
 * Describe a team in a sentence; review what it proposes; then create it.
 *
 * The model only ever produces the plan in the middle step. Creating the team, the
 * board and the invitations is done afterwards by the same endpoints the manual
 * forms use, with their own validation and permission checks. That is what makes a
 * wrong or hostile response harmless: it can put bad text on this screen, and
 * nothing else.
 *
 * Invitations in particular are never sent off a raw model response. The server
 * already drops addresses that did not appear in the prompt; this screen then shows
 * whatever survived, so a person is the last step before anybody gets an email.
 */
export function AiTeamPlanner() {
  const { data: status } = useAiStatus();
  const plan = useTeamPlan();
  const createOrg = useCreateOrganization();
  const createBoard = useCreateBoard();
  const invite = useInviteToOrganization();

  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<TeamPlan | null>(null);
  const [applying, setApplying] = useState(false);

  // No key on the server means no affordance at all.
  if (!status?.enabled) return null;

  const propose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (prompt.trim().length < 10) {
      toast('Describe the team in a sentence or two');
      return;
    }

    try {
      setProposal(await plan.mutateAsync(prompt.trim()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not draft a plan');
    }
  };

  /**
   * Creates what was proposed, in dependency order.
   *
   * Failures are reported but do not roll back: a team that exists with one
   * invitation missing is recoverable from this page, whereas unwinding halfway
   * would delete something the user can already see.
   */
  const apply = async () => {
    if (!proposal) return;
    setApplying(true);

    try {
      const org = await createOrg.mutateAsync(proposal.name);

      await createBoard.mutateAsync({
        name: proposal.boardName,
        columns: proposal.columns.map((name) => ({ name, tasks: [] })),
        organizationId: org.id,
      });

      let invited = 0;
      const failed: string[] = [];
      for (const email of proposal.emails) {
        try {
          await invite.mutateAsync({ orgId: org.id, email, role: 'member' });
          invited += 1;
        } catch {
          // One rejected address must not abandon the rest.
          failed.push(email);
        }
      }

      setProposal(null);
      setPrompt('');

      toast.success(
        `Created ${org.name} with a board${invited > 0 ? ` and ${invited} invitation${invited === 1 ? '' : 's'}` : ''}`,
      );
      if (failed.length > 0) {
        toast.error(`Could not invite: ${failed.join(', ')}`, { duration: 6000 });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the team');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <p className={styles.hint}>
        Describe what you need and the assistant drafts a team, a first board and an
        invitee list. Nothing is created until you approve it.
      </p>

      <form className={styles.form} onSubmit={propose}>
        <Input
          label="What are you setting up?"
          placeholder="A design squad for the new marketing site, with ama@example.com"
          value={prompt}
          maxLength={600}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={plan.isPending}>
          {plan.isPending ? 'Drafting…' : 'Draft a plan'}
        </Button>
      </form>

      {proposal && (
        <div className={styles.proposal}>
          <h3 className={styles.proposalTitle}>Proposed</h3>

          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt>Team</dt>
              <dd>{proposal.name}</dd>
            </div>
            {proposal.description && (
              <div className={styles.row}>
                <dt>About</dt>
                <dd>{proposal.description}</dd>
              </div>
            )}
            <div className={styles.row}>
              <dt>First board</dt>
              <dd>{proposal.boardName}</dd>
            </div>
            <div className={styles.row}>
              <dt>Columns</dt>
              <dd>
                <span className={styles.chips}>
                  {proposal.columns.map((column) => (
                    <span key={column} className={styles.chip}>
                      {column}
                    </span>
                  ))}
                </span>
              </dd>
            </div>
            <div className={styles.row}>
              <dt>Invite</dt>
              <dd>
                {proposal.emails.length > 0 ? (
                  proposal.emails.join(', ')
                ) : (
                  // Says so explicitly, because "no invitations" is the safe
                  // outcome and the user should not wonder whether some were sent.
                  <span className={styles.muted}>
                    Nobody. Only addresses you typed are used, never ones inferred
                    from a name.
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <Button variant="primary" disabled={applying} onClick={() => void apply()}>
              {applying ? 'Creating…' : 'Create it'}
            </Button>
            <Button variant="secondary" disabled={applying} onClick={() => setProposal(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
