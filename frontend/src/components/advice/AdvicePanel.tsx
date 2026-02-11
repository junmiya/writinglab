import type { ReactElement } from 'react';

import type { AdviceModelDescriptor } from '../../services/adviceService';
import type { AdviceProvider } from '../../stores/adviceStore';

interface AdvicePanelProps {
  title: string;
  provider: AdviceProvider;
  models: AdviceModelDescriptor[];
  preset: string;
  structureFeedback: string;
  emotionalFeedback: string;
  onProviderChange: (provider: AdviceProvider) => void;
  onPresetChange: (preset: string) => void;
}

export function AdvicePanel({
  title,
  provider,
  models,
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
            {models.map((item) => (
              <option key={item.provider} value={item.provider} disabled={!item.enabled}>
                {item.label}
                {item.enabled ? '' : ' (disabled)'}
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
