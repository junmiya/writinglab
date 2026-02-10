import type { ReactElement } from 'react';

import type { AdviceProvider } from '../../stores/adviceStore';

interface AdvicePanelProps {
  title: string;
  provider: AdviceProvider;
  preset: string;
  structureFeedback: string;
  emotionalFeedback: string;
  onProviderChange: (provider: AdviceProvider) => void;
  onPresetChange: (preset: string) => void;
}

const providers: AdviceProvider[] = ['gemini', 'openai', 'anthropic'];

export function AdvicePanel({
  title,
  provider,
  preset,
  structureFeedback,
  emotionalFeedback,
  onProviderChange,
  onPresetChange,
}: AdvicePanelProps): ReactElement {
  return (
    <section
      aria-label={`${title} advice panel`}
      style={{ border: '1px solid #d0d5dd', padding: 12 }}
    >
      <h3>{title}</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <label>
          Model
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.currentTarget.value as AdviceProvider)}
          >
            {providers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preset
          <input value={preset} onChange={(event) => onPresetChange(event.currentTarget.value)} />
        </label>
      </div>
      <p>
        <strong>構成面:</strong> {structureFeedback}
      </p>
      <p>
        <strong>感情面:</strong> {emotionalFeedback}
      </p>
    </section>
  );
}
