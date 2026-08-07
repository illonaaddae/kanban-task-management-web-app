import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Modal } from '../modals/Modal';
import { Button } from '../ui/Button';
import { useAiStatus, useCommandPlan } from '../../queries/orgs';
import { useBoard } from '../../queries/boards';
import { useMoveTask, useUpdateTask, useCreateTask } from '../../queries/mutations';
import type { CommandPlan } from '../../services/aiApi';
import { resolvePlan, type Resolved } from './resolvePlan';
import toast from 'react-hot-toast';
import styles from './CommandBar.module.css';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

/**
 * Type an instruction, see exactly what will happen, then approve it.
 *
 * The keyboard path, opened with `/`. One instruction, one round trip, one
 * confirmation, which is what you want when you already know what you are asking
 * for. The chat panel is the same machinery for when you do not: it keeps a
 * transcript and can answer questions, at the cost of a call per turn.
 *
 * Both go through `resolvePlan`, so a named action means the same thing either way.
 * The model only ever names an action and the strings it applies to. Matching those
 * strings to real records happens there, against the board already in the cache, and
 * the change itself goes through the same mutations the buttons use. So a misread
 * instruction produces a confirmation the user rejects, not a wrong write.
 */
export function CommandBar({ isOpen, onClose, boardId }: CommandBarProps) {
  const { data: status } = useAiStatus();
  const { data: board } = useBoard(boardId);
  const interpret = useCommandPlan();
  const moveTask = useMoveTask();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const [instruction, setInstruction] = useState('');
  const [plan, setPlan] = useState<CommandPlan | null>(null);
  const [applying, setApplying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /**
   * Resolves the plan's names against the board.
   *
   * Case-insensitive exact match, not fuzzy: acting on a near-match is how you move
   * the wrong card. When nothing matches, the reason is shown instead of an action.
   */
  const resolved = useMemo<Resolved | null>(() => {
    if (!plan || !board) return null;
    return resolvePlan(plan, board, { moveTask, updateTask, createTask, boardId });
  }, [plan, board, moveTask, updateTask, createTask, boardId]);

  if (!status?.enabled) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (instruction.trim().length < 4) return;

    setPlan(null);
    try {
      setPlan(await interpret.mutateAsync({ boardId, instruction: instruction.trim() }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that');
    }
  };

  const apply = async () => {
    if (!resolved?.apply) return;
    setApplying(true);
    try {
      await resolved.apply();
      toast.success('Done');
      setInstruction('');
      setPlan(null);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply that');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ask for a change">
      <h2 className={styles.title}>Ask for a change</h2>
      <p className={styles.subtitle}>
        Describe one change to this board. You will see exactly what it resolves to
        before anything happens.
      </p>

      <form onSubmit={submit} className={styles.form}>
        <input
          ref={inputRef}
          className={styles.input}
          value={instruction}
          maxLength={300}
          placeholder="Move the login fix to Done"
          onChange={(event) => {
            setInstruction(event.target.value);
            // A stale plan next to a changed instruction is worse than none.
            if (plan) setPlan(null);
          }}
          aria-label="Instruction"
        />
        <Button type="submit" disabled={interpret.isPending || instruction.trim().length < 4}>
          {interpret.isPending ? 'Reading…' : 'Read it'}
        </Button>
      </form>

      <ul className={styles.examples}>
        {[
          'Move the login fix to Done',
          'Assign the changelog to Ama',
          'Add a task called Update the docs',
        ].map((example) => (
          <li key={example}>
            <button type="button" onClick={() => setInstruction(example)}>
              {example}
            </button>
          </li>
        ))}
      </ul>

      {plan && resolved && (
        <div className={`${styles.result} ${resolved.ok ? '' : styles.resultProblem}`}>
          <p className={styles.resultLabel}>
            {resolved.ok ? 'This will happen' : 'Cannot do that'}
          </p>
          <p className={styles.resultSummary}>{resolved.summary}</p>
          {resolved.problem && <p className={styles.resultProblemText}>{resolved.problem}</p>}

          {resolved.ok && (
            <div className={styles.actions}>
              <Button variant="primary" disabled={applying} onClick={() => void apply()}>
                {applying ? 'Applying…' : 'Do it'}
              </Button>
              <Button variant="secondary" disabled={applying} onClick={() => setPlan(null)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
