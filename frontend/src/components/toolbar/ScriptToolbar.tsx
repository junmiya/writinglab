import type { ReactElement } from 'react';

export type ToolbarAction = 'scene' | 'dialogue' | 'action';

const INSERT_TEMPLATES: Record<ToolbarAction, string> = {
  scene: '○場所（時間）\n',
  dialogue: '「」\n',
  action: '　ト書き\n',
};

export function applyToolbarAction(content: string, action: ToolbarAction): string {
  return `${content}${INSERT_TEMPLATES[action]}`;
}

interface ScriptToolbarProps {
  onApply: (action: ToolbarAction) => void;
}

export function ScriptToolbar({ onApply }: ScriptToolbarProps): ReactElement {
  return (
    <div aria-label="Script toolbar" className="flex-row">
      <button type="button" onClick={() => onApply('scene')}>
        柱
      </button>
      <button type="button" onClick={() => onApply('action')}>
        ト書き
      </button>
      <button type="button" onClick={() => onApply('dialogue')}>
        セリフ
      </button>
    </div>
  );
}
