import type { ReactElement } from 'react';

import type { EditorSettings } from '../../stores/editorStore';

interface SettingsProps {
  value: EditorSettings;
  onChange: (settings: EditorSettings) => void;
}

export function Settings({ value, onChange }: SettingsProps): ReactElement {
  return (
    <section aria-label="Editor settings" style={{ display: 'flex', gap: 12 }}>
      <label>
        文字数/行
        <input
          type="number"
          min={10}
          max={40}
          value={value.lineLength}
          onChange={(event) =>
            onChange({
              ...value,
              lineLength: Number(event.currentTarget.value),
            })
          }
        />
      </label>
      <label>
        枚数
        <input
          type="number"
          min={1}
          max={300}
          value={value.pageCount}
          onChange={(event) =>
            onChange({
              ...value,
              pageCount: Number(event.currentTarget.value),
            })
          }
        />
      </label>
    </section>
  );
}
