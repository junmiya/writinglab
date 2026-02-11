import type { ReactElement } from 'react';

export interface DiffResult {
  before: string;
  after: string;
}

export function buildDiff(before: string, after: string): DiffResult {
  return { before, after };
}

interface DiffViewProps {
  before: string;
  after: string;
}

export function DiffView({ before, after }: DiffViewProps): ReactElement {
  const diff = buildDiff(before, after);

  return (
    <section
      aria-label="Diff view"
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
    >
      <article>
        <h4>修正前</h4>
        <pre>{diff.before}</pre>
      </article>
      <article>
        <h4>修正後</h4>
        <pre>{diff.after}</pre>
      </article>
    </section>
  );
}
