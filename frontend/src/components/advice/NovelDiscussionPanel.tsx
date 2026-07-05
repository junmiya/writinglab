import { useState, useCallback, type ReactElement } from 'react';
import { callAi, type AiProvider } from '../../lib/aiClient';
import { NOVEL_DISCUSSION_A, NOVEL_DISCUSSION_B } from '../../modes/novel/prompts';
import type { NovelDiscussionMessage } from '../../types/novel';

export type { NovelDiscussionMessage } from '../../types/novel';

interface NovelDiscussionPanelProps {
  synopsis: string;
  /** Concatenated body (chapters/sections) for context. */
  content: string;
  /** Persisted discussion history (saved with the document). */
  messages: NovelDiscussionMessage[];
  onMessagesChange: (msgs: NovelDiscussionMessage[]) => void;
}

const ROUNDS = 2; // Initial discussion: A→B→A→B
const COLORS = { A: '#2563eb', B: '#059669', user: '#7c3aed' } as const;

function roleLabel(role: NovelDiscussionMessage['role']): string {
  if (role === 'user') return '著者';
  return role === 'A' ? NOVEL_DISCUSSION_A.label : NOVEL_DISCUSSION_B.label;
}

function buildContext(synopsis: string, content: string, question: string): string {
  const parts: string[] = [];
  if (question) parts.push(`【著者が確認したいこと】\n${question}`);
  if (synopsis) parts.push(`【あらすじ】\n${synopsis}`);
  if (content) parts.push(`【本文】\n${content.slice(0, 6000)}`);
  return parts.join('\n\n') || '（本文が入力されていません）';
}

function buildUserPrompt(ctx: string, history: NovelDiscussionMessage[], isA: boolean): string {
  if (history.length === 0) {
    return `以下の小説について、著者が確認したいことを最優先に、あなたの専門観点から講評・提案してください。\n\n${ctx}`;
  }
  const convo = history.map((m) => `【${roleLabel(m.role)}】\n${m.text}`).join('\n\n');
  const self = isA ? NOVEL_DISCUSSION_A.label : NOVEL_DISCUSSION_B.label;
  const other = isA ? NOVEL_DISCUSSION_B.label : NOVEL_DISCUSSION_A.label;
  return `以下の小説とこれまでの議論を踏まえ、${self}として応答してください。相手（${other}）や著者の最新の発言に反応し、著者が確認したいことを念頭に置いてください。\n\n${ctx}\n\n--- これまでの議論 ---\n${convo}`;
}

/**
 * Novel AI dialogue critique (FR-030): 編集者 vs 文芸評論家 が、著者の「確認したいこと」を
 * 起点に対話する。履歴は保存され、著者が途中で介入して議論を継続できる。
 */
export function NovelDiscussionPanel({
  synopsis,
  content,
  messages,
  onMessagesChange,
}: NovelDiscussionPanelProps): ReactElement {
  const [providerA, setProviderA] = useState<AiProvider>('gemini');
  const [providerB, setProviderB] = useState<AiProvider>('gemini');
  const [question, setQuestion] = useState('');
  const [intervention, setIntervention] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasEnough = (synopsis + content + question).replace(/[\r\n\s]/g, '').length >= 10;

  /** Run `rounds` of A→B starting from `base`, streaming updates to the parent. */
  const runRounds = useCallback(
    async (ctx: string, base: NovelDiscussionMessage[], rounds: number) => {
      const acc = [...base];
      for (let r = 0; r < rounds; r++) {
        const aText = await callAi(
          providerA,
          NOVEL_DISCUSSION_A.system,
          buildUserPrompt(ctx, acc, true),
        );
        acc.push({ role: 'A', provider: providerA, text: aText, timestamp: Date.now() });
        onMessagesChange([...acc]);
        const bText = await callAi(
          providerB,
          NOVEL_DISCUSSION_B.system,
          buildUserPrompt(ctx, acc, false),
        );
        acc.push({ role: 'B', provider: providerB, text: bText, timestamp: Date.now() });
        onMessagesChange([...acc]);
      }
      return acc;
    },
    [providerA, providerB, onMessagesChange],
  );

  const startDiscussion = useCallback(async () => {
    if (!hasEnough) return;
    setLoading(true);
    setError('');
    try {
      await runRounds(buildContext(synopsis, content, question), [], ROUNDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [synopsis, content, question, hasEnough, runRounds]);

  const continueDiscussion = useCallback(async () => {
    const userText = intervention.trim();
    if (!userText) return;
    setLoading(true);
    setError('');
    const withUser: NovelDiscussionMessage[] = [
      ...messages,
      { role: 'user', text: userText, timestamp: Date.now() },
    ];
    onMessagesChange(withUser);
    setIntervention('');
    try {
      // One more round (A→B) responding to the author's intervention.
      await runRounds(buildContext(synopsis, content, question), withUser, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [intervention, messages, synopsis, content, question, onMessagesChange, runRounds]);

  const clearHistory = (): void => {
    if (messages.length === 0 || confirm('対話の履歴を消去しますか？')) {
      onMessagesChange([]);
    }
  };

  return (
    <div>
      {/* 著者が確認したいこと */}
      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.375rem' }}>
        確認したいこと（例: このあらすじ案はどう思う？／新しい展開のアイデアが欲しい）
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.currentTarget.value)}
          placeholder="AI に相談したい内容を入力..."
          rows={2}
          style={{
            width: '100%',
            marginTop: '0.25rem',
            padding: '0.375rem 0.5rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            resize: 'vertical',
          }}
        />
      </label>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          margin: '0.5rem 0',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.A }}>
          {NOVEL_DISCUSSION_A.label}
        </span>
        <select
          value={providerA}
          onChange={(e) => setProviderA(e.currentTarget.value as AiProvider)}
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
        >
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>vs</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.B }}>
          {NOVEL_DISCUSSION_B.label}
        </span>
        <select
          value={providerB}
          onChange={(e) => setProviderB(e.currentTarget.value as AiProvider)}
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
        >
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
        </select>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void startDiscussion()}
          disabled={loading || !hasEnough}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
        >
          {loading ? '議論中...' : messages.length > 0 ? '最初から議論' : '議論開始'}
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            disabled={loading}
            style={{
              fontSize: '0.75rem',
              padding: '0.3rem 0.6rem',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--text-secondary)',
            }}
          >
            履歴を消去
          </button>
        )}
      </div>

      {error && <p style={{ color: 'var(--color-error)', fontSize: '0.75rem' }}>{error}</p>}
      {messages.length === 0 && !loading && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          確認したいことを入力し「議論開始」を押すと、編集者と文芸評論家が相談に乗ります。履歴は保存され、途中で介入して議論を続けられます。
        </p>
      )}

      {/* 履歴 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {messages.map((msg, i) => {
          const color = COLORS[msg.role];
          return (
            <div
              key={i}
              style={{
                padding: '0.625rem 0.75rem',
                border: `1px solid ${color}33`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 'var(--radius-md)',
                backgroundColor: `${color}08`,
              }}
            >
              <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color }}>
                  {roleLabel(msg.role)}
                </span>
                {msg.provider && (
                  <span style={{ fontSize: '0.5625rem', color: 'var(--text-secondary)' }}>
                    {msg.provider}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)',
                }}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        {loading && messages.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            AI が考え中...
          </div>
        )}
      </div>

      {/* 著者の介入で議論を継続 */}
      {messages.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.375rem' }}>
            議論に介入する（あなたの意見・追加の相談を入力）
            <textarea
              value={intervention}
              onChange={(e) => setIntervention(e.currentTarget.value)}
              placeholder="例: 主人公の動機をもっと掘り下げてほしい／2案目を膨らませて"
              rows={2}
              style={{
                width: '100%',
                marginTop: '0.25rem',
                padding: '0.375rem 0.5rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
                resize: 'vertical',
              }}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void continueDiscussion()}
            disabled={loading || !intervention.trim()}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
          >
            {loading ? '応答中...' : '介入して続ける'}
          </button>
        </div>
      )}
    </div>
  );
}
