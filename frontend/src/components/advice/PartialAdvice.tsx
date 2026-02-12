import type { ReactElement } from 'react';

import { useState } from 'react';

interface PartialAdviceProps {
  onRequest: (selectedText: string) => Promise<void>;
}

export function PartialAdvice({ onRequest }: PartialAdviceProps): ReactElement {
  const [selectedText, setSelectedText] = useState('');
  const [pending, setPending] = useState(false);

  const request = async (): Promise<void> => {
    if (!selectedText.trim()) {
      return;
    }

    setPending(true);
    try {
      await onRequest(selectedText);
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-label="Partial advice request" className="section-container">
      <h3>部分アドバイス</h3>
      <textarea
        aria-label="Selected text"
        value={selectedText}
        onChange={(event) => setSelectedText(event.currentTarget.value)}
      />
      <button type="button" onClick={request} disabled={pending}>
        {pending ? '送信中...' : '部分アドバイスを取得'}
      </button>
    </section>
  );
}
