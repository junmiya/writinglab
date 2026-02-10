import type { ReactElement } from 'react';

import { useMemo, useState } from 'react';
import { Settings } from '../components/editor/Settings';
import { VerticalEditor } from '../components/editor/VerticalEditor';
import {
  ScriptToolbar,
  applyToolbarAction,
  type ToolbarAction,
} from '../components/toolbar/ScriptToolbar';
import { createInitialEditorState, updateContent, updateSettings } from '../stores/editorStore';

export function EditorPage(): ReactElement {
  const [state, setState] = useState(createInitialEditorState);

  const onToolbarApply = (action: ToolbarAction): void => {
    setState((current) => updateContent(current, applyToolbarAction(current.content, action)));
  };

  const remaining = useMemo(() => {
    const count = Math.max(state.metrics.totalCapacity - state.content.length, 0);
    return count;
  }, [state]);

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <ScriptToolbar onApply={onToolbarApply} />
      <Settings
        value={state.settings}
        onChange={(value) => setState((current) => updateSettings(current, value))}
      />
      <VerticalEditor
        value={state.content}
        onChange={(value) => setState((current) => updateContent(current, value))}
      />
      <p>
        文字数: {state.content.length} / 目安容量: {state.metrics.totalCapacity} / 残り: {remaining}
      </p>
    </main>
  );
}
