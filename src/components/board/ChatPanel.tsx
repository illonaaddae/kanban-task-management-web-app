import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { useAiStatus, useBoardChat } from '../../queries/orgs';
import { useBoard } from '../../queries/boards';
import { useMoveTask, useUpdateTask, useCreateTask } from '../../queries/mutations';
import { resolvePlan, type Resolved } from './resolvePlan';
import type { ChatMessage } from '../../services/aiApi';
import toast from 'react-hot-toast';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

/** A turn on screen: what was said, and the change it offered, if any. */
interface Turn extends ChatMessage {
  resolved?: Resolved;
  /** Set once the change has been applied, so the button cannot fire twice. */
  applied?: boolean;
}

const OPENERS = [
  'What is overdue?',
  'Who has the most open work?',
  'Move the login fix to Done',
];

/**
 * A conversation about the board it is opened on.
 *
 * The command bar answers "do this"; this answers "what about..." and then "do this"
 * without making you start again. That is worth a panel because the useful questions
 * are follow-ups: what is overdue, who is carrying it, now move that one.
 *
 * The guardrails are the command bar's, unchanged. A reply may carry at most one
 * proposed action, drawn from the same closed set, resolved by the same
 * `resolvePlan` against the cached board, and applied only when the user presses the
 * button. So the worst a confused reply can do is put wrong text on screen and offer
 * a change that gets refused, either by the reader or by the API.
 *
 * The transcript is capped server-side at the last eight messages. Every turn is a
 * billed call carrying that transcript, which is the honest cost of the format and
 * the reason the command bar still exists beside it.
 */
export function ChatPanel({ isOpen, onClose, boardId }: ChatPanelProps) {
  const { data: status } = useAiStatus();
  const { data: board } = useBoard(boardId);
  const chat = useBoardChat();
  const moveTask = useMoveTask();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [applying, setApplying] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Scrolls the newest turn into view, including the pending one, so a slow reply
  // does not leave the "Thinking" line off the bottom of the panel.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, chat.isPending]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !status?.enabled) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (content.length < 2 || chat.isPending) return;

    // The transcript sent is the one on screen plus this message. Local state is
    // the record; the server keeps nothing between turns.
    const outgoing: ChatMessage[] = [
      ...turns.map(({ role, content: said }) => ({ role, content: said })),
      { role: 'user', content },
    ];

    setTurns((previous) => [...previous, { role: 'user', content }]);
    setDraft('');

    try {
      const reply = await chat.mutateAsync({ boardId, messages: outgoing });

      setTurns((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: reply.reply,
          // Resolved here rather than at render time so the offer is measured
          // against the board as it was answered about.
          resolved:
            reply.action && board
              ? resolvePlan(reply.action, board, {
                  moveTask,
                  updateTask,
                  createTask,
                  boardId,
                })
              : undefined,
        },
      ]);
    } catch (error) {
      // Shown in the transcript, not only as a toast: a question that got no answer
      // should still leave a trace of why.
      setTurns((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Could not answer that',
        },
      ]);
    }
  };

  const apply = async (index: number) => {
    const turn = turns[index];
    if (!turn?.resolved?.apply || turn.applied) return;

    setApplying(index);
    try {
      await turn.resolved.apply();
      setTurns((previous) =>
        previous.map((entry, position) =>
          position === index ? { ...entry, applied: true } : entry,
        ),
      );
      toast.success('Done');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply that');
    } finally {
      setApplying(null);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(draft);
  };

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Ask about this board"
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Ask about this board</h2>
            <p className={styles.subtitle}>{board?.name}</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close assistant"
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
        </div>

        <div className={styles.body}>
          {turns.length === 0 && (
            <div className={styles.intro}>
              <p className={styles.introText}>
                Ask about the work on this board, or describe a change. Nothing is
                changed until you confirm it.
              </p>
              <ul className={styles.openers}>
                {OPENERS.map((opener) => (
                  <li key={opener}>
                    <button type="button" onClick={() => void send(opener)}>
                      {opener}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {turns.map((turn, index) => (
            <div
              key={`${index}-${turn.content.slice(0, 12)}`}
              className={turn.role === 'user' ? styles.fromUser : styles.fromAssistant}
            >
              <p className={styles.bubble}>{turn.content}</p>

              {turn.resolved && (
                <div
                  className={`${styles.offer} ${
                    turn.resolved.ok ? '' : styles.offerProblem
                  }`}
                >
                  <p className={styles.offerSummary}>{turn.resolved.summary}</p>
                  {turn.resolved.problem && (
                    <p className={styles.offerProblemText}>{turn.resolved.problem}</p>
                  )}

                  {turn.resolved.ok &&
                    (turn.applied ? (
                      <p className={styles.offerDone}>Applied</p>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={applying === index}
                        onClick={() => void apply(index)}
                      >
                        {applying === index ? 'Applying…' : 'Do it'}
                      </Button>
                    ))}
                </div>
              )}
            </div>
          ))}

          {chat.isPending && (
            <p className={styles.thinking} role="status">
              Thinking…
            </p>
          )}

          <div ref={endRef} />
        </div>

        <form className={styles.composer} onSubmit={submit}>
          <input
            ref={inputRef}
            className={styles.input}
            value={draft}
            maxLength={600}
            placeholder="Ask or describe a change"
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Message"
          />
          <Button type="submit" disabled={chat.isPending || draft.trim().length < 2}>
            Send
          </Button>
        </form>
      </aside>
    </>,
    document.body,
  );
}
