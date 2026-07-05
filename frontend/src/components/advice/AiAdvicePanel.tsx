import { useState, type ReactElement, type ReactNode } from 'react';
import { callAi, type AiProvider } from '../../lib/aiClient';

export interface AdviceExpert {
  id: string;
  label: string;
  system: string;
}

interface AiAdvicePanelProps {
  /** Target label shown in the header (e.g. 'あらすじ' / '本文' / 'カット表'). */
  label: string;
  /** Text to evaluate. */
  text: string;
  /** Experts rendered as tabs — one AI call per expert (mode-specific prompts). */
  experts: AdviceExpert[];
  /** Optional context summary appended to the prompt. */
  contextSummary?: string;
  /** The editor is passed as children so advice controls sit above and results below (上下). */
  children?: ReactNode;
}

/**
 * Generic tabbed AI advice panel (FR-109). Mode-agnostic: novel passes
 * 編集者/文芸評論家/校正者, storyboard passes 演出家/撮影/編集. Controls render
 * above the editor (children), tabbed results below.
 */
export function AiAdvicePanel({
  label,
  text,
  experts,
  contextSummary,
  children,
}: AiAdvicePanelProps): ReactElement {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [results, setResults] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>(experts[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasText = text.replace(/[\r\n\s]/g, '').length >= 10;
  const hasResults = Object.keys(results).length > 0;

  const runAdvice = async (): Promise<void> => {
    if (!hasText) return;
    setLoading(true);
    setError('');
    const userText = [contextSummary ? `【設定】\n${contextSummary}` : '', `【${label}】\n${text}`]
      .filter(Boolean)
      .join('\n\n');
    try {
      const entries = await Promise.all(
        experts.map(
          async (expert) => [expert.id, await callAi(provider, expert.system, userText)] as const,
        ),
      );
      setResults(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 上: コントロール */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          AI評価（{label}）
        </span>
        <select
          value={provider}
          onChange={(e) => setProvider(e.currentTarget.value as AiProvider)}
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
        >
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
        </select>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void runAdvice()}
          disabled={loading || !hasText}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
        >
          {loading ? '評価中...' : hasResults ? '再評価' : 'AI評価'}
        </button>
        {!hasText && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
            10文字以上で評価できます
          </span>
        )}
      </div>

      {/* 中: エディタ本体 */}
      {children}

      {/* 下: タブ形式の評価結果 */}
      {error && <p style={{ color: 'var(--color-error)', fontSize: '0.75rem' }}>{error}</p>}
      {hasResults && (
        <div style={{ marginTop: '0.5rem' }}>
          <div
            role="tablist"
            style={{
              display: 'flex',
              gap: '0.25rem',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {experts.map((expert) => {
              const isActive = expert.id === activeTab;
              return (
                <button
                  key={expert.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(expert.id)}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 400,
                    padding: '0.375rem 0.75rem',
                    border: 'none',
                    borderBottom: isActive
                      ? '2px solid var(--color-primary, #2563eb)'
                      : '2px solid transparent',
                    background: 'transparent',
                    color: isActive ? 'var(--color-primary, #2563eb)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {expert.label}
                </button>
              );
            })}
          </div>
          <div
            role="tabpanel"
            style={{
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              color: 'var(--text-primary)',
              padding: '0.625rem 0.25rem',
            }}
          >
            {results[activeTab]}
          </div>
        </div>
      )}
    </div>
  );
}
