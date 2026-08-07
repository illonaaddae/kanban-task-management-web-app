import { useAiStatus, useTaskSuggestion } from '../../queries/orgs';
import toast from 'react-hot-toast';
import styles from './AiTaskAssist.module.css';

interface AiTaskAssistProps {
  /** Current title. The suggestion is built from it, so it must not be empty. */
  title: string;
  /** Board and column names, so the wording matches its surroundings. */
  context: string;
  /** Called with the proposal. The caller fills its own fields. */
  onSuggestion: (suggestion: { description: string; subtasks: string[] }) => void;
  /** True when the form already has content that would be replaced. */
  wouldOverwrite: boolean;
}

/**
 * Draft a description and subtasks from the title.
 *
 * Renders nothing when the server has no key, rather than offering a button that
 * answers 503. Fires on click only, never while typing: each press costs money,
 * and a keystroke-triggered request would be an expensive way to be unhelpful.
 *
 * The result lands in the form's own fields for editing. Nothing is saved here.
 */
export function AiTaskAssist({
  title,
  context,
  onSuggestion,
  wouldOverwrite,
}: AiTaskAssistProps) {
  const { data: status } = useAiStatus();
  const suggest = useTaskSuggestion();

  // No key on the server means no affordance at all.
  if (!status?.enabled) return null;

  const tooShort = title.trim().length < 3;

  const run = async () => {
    if (tooShort) {
      toast('Give the task a title first, then let the assistant fill in the rest');
      return;
    }

    if (
      wouldOverwrite &&
      !window.confirm('Replace the description and subtasks you have written?')
    ) {
      return;
    }

    try {
      const suggestion = await suggest.mutateAsync({ title: title.trim(), context });
      onSuggestion(suggestion);
      toast.success('Filled in. Edit anything before saving.');
    } catch (error) {
      // The API distinguishes a rate limit (429), an unusable reply (502) and a
      // missing key (503); its wording is more useful than anything generic.
      toast.error(error instanceof Error ? error.message : 'The assistant could not help');
    }
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={() => void run()}
        disabled={suggest.isPending}
        title={
          tooShort
            ? 'Add a title first'
            : 'Draft a description and subtasks from the title'
        }
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5 10.1 12 4.5 10l5.6-1.4L12 3z" />
          <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
        </svg>
        {suggest.isPending ? 'Drafting…' : 'Draft with AI'}
      </button>
      <span className={styles.note}>
        Suggests a description and subtasks. You edit before saving.
      </span>
    </div>
  );
}
