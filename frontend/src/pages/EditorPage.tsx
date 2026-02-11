import type { ReactElement } from 'react';

import { useMemo, useState } from 'react';
import { AdvicePanel } from '../components/advice/AdvicePanel';
import { DiffView } from '../components/advice/DiffView';
import { PartialAdvice } from '../components/advice/PartialAdvice';
import { CharacterTable, type CharacterRow } from '../components/editor/CharacterTable';
import { Settings } from '../components/editor/Settings';
import { VerticalEditor } from '../components/editor/VerticalEditor';
import { SectionSelector } from '../components/structure/SectionSelector';
import { StructurePanel, type StructureSegment } from '../components/structure/StructurePanel';
import {
  ScriptToolbar,
  applyToolbarAction,
  type ToolbarAction,
} from '../components/toolbar/ScriptToolbar';
import { generateAdvice } from '../services/adviceService';
import { requestExport } from '../services/exportService';
import { createAdviceState, selectPanelModel, setPanelPreset } from '../stores/adviceStore';
import { createInitialEditorState, updateContent, updateSettings } from '../stores/editorStore';

interface AdviceResult {
  structureFeedback: string;
  emotionalFeedback: string;
}

const structureSegments: StructureSegment[] = [
  { id: 'intro', label: '起', ratio: 0.25 },
  { id: 'development', label: '承', ratio: 0.35 },
  { id: 'turn', label: '転', ratio: 0.2 },
  { id: 'closing', label: '結', ratio: 0.2 },
];

const defaultSegmentId = structureSegments[0]?.id ?? 'intro';
const localDocumentId = 'local-draft';

export function EditorPage(): ReactElement {
  const [state, setState] = useState(createInitialEditorState);
  const [adviceState, setAdviceState] = useState(createAdviceState);
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string>(defaultSegmentId);
  const [lastBeforeEdit, setLastBeforeEdit] = useState('');
  const [panelAAdvice, setPanelAAdvice] = useState<AdviceResult>({
    structureFeedback: 'アドバイス未生成',
    emotionalFeedback: 'アドバイス未生成',
  });
  const [panelBAdvice, setPanelBAdvice] = useState<AdviceResult>({
    structureFeedback: 'アドバイス未生成',
    emotionalFeedback: 'アドバイス未生成',
  });
  const [exportMessage, setExportMessage] = useState('');

  const onToolbarApply = (action: ToolbarAction): void => {
    setState((current) => updateContent(current, applyToolbarAction(current.content, action)));
  };

  const remaining = useMemo(() => {
    return Math.max(state.metrics.totalCapacity - state.content.length, 0);
  }, [state]);

  const regenerateAdvice = async (selectedText?: string): Promise<void> => {
    const response = await generateAdvice({
      documentId: localDocumentId,
      synopsis: state.synopsis,
      content: state.content,
      ...(selectedText !== undefined ? { selectedText } : {}),
      panelAProvider: adviceState.panelA.provider,
      panelBProvider: adviceState.panelB.provider,
      panelAPreset: adviceState.panelA.preset,
      panelBPreset: adviceState.panelB.preset,
    });

    setPanelAAdvice({
      structureFeedback: response.panelA.structureFeedback,
      emotionalFeedback: response.panelA.emotionalFeedback,
    });
    setPanelBAdvice({
      structureFeedback: response.panelB.structureFeedback,
      emotionalFeedback: response.panelB.emotionalFeedback,
    });
  };

  const onRequestPartialAdvice = async (selectedText: string): Promise<void> => {
    await regenerateAdvice(selectedText);
  };

  const applyAdviceExamplePatch = (): void => {
    setLastBeforeEdit(state.content);
    setState((current) => updateContent(current, `${current.content}\n# 修正案を反映\n`));
  };

  const onExport = async (): Promise<void> => {
    try {
      const payload = await requestExport({
        documentId: localDocumentId,
        title: state.title || 'untitled-script',
        authorName: state.authorName || 'unknown-author',
        content: state.content,
      });
      setExportMessage(`Export ready: ${payload.fileName} (${payload.content.length} chars)`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h1>Scenario Writing Lab</h1>

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

      <CharacterTable value={characters} onChange={setCharacters} />

      <button type="button" onClick={() => void regenerateAdvice()}>
        全体アドバイス更新
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <AdvicePanel
          title="Advice A"
          provider={adviceState.panelA.provider}
          preset={adviceState.panelA.preset}
          structureFeedback={panelAAdvice.structureFeedback}
          emotionalFeedback={panelAAdvice.emotionalFeedback}
          onProviderChange={(provider) =>
            setAdviceState((current) => selectPanelModel(current, 'A', provider))
          }
          onPresetChange={(preset) =>
            setAdviceState((current) => setPanelPreset(current, 'A', preset))
          }
        />

        <AdvicePanel
          title="Advice B"
          provider={adviceState.panelB.provider}
          preset={adviceState.panelB.preset}
          structureFeedback={panelBAdvice.structureFeedback}
          emotionalFeedback={panelBAdvice.emotionalFeedback}
          onProviderChange={(provider) =>
            setAdviceState((current) => selectPanelModel(current, 'B', provider))
          }
          onPresetChange={(preset) =>
            setAdviceState((current) => setPanelPreset(current, 'B', preset))
          }
        />
      </div>

      <PartialAdvice onRequest={onRequestPartialAdvice} />

      <StructurePanel segments={structureSegments} activeSegmentId={activeSegmentId} />
      <SectionSelector
        segments={structureSegments}
        activeSegmentId={activeSegmentId}
        onSelect={setActiveSegmentId}
      />

      <button type="button" onClick={applyAdviceExamplePatch}>
        修正例を本文に反映
      </button>

      <DiffView before={lastBeforeEdit} after={state.content} />

      <button type="button" onClick={() => void onExport()}>
        エクスポート
      </button>
      {exportMessage ? <p>{exportMessage}</p> : null}
    </main>
  );
}
