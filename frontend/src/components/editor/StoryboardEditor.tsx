import { useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { SceneList } from './SceneList';
import {
  type EditorState,
  addScene,
  updateScene,
  removeScene,
  moveScene,
  addCut,
  updateCut,
  removeCut,
  moveCut,
  storyboardCutCount,
  storyboardTotalSec,
  formatDuration,
} from '../../stores/editorStore';
import {
  createEmptyStoryboardContent,
  DEFAULT_STORYBOARD_SETTINGS,
  type StoryboardContent,
  type StoryboardCut,
  type StoryboardSettings,
} from '../../types/storyboard';
import { ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';

interface StoryboardEditorProps {
  state: EditorState;
  setState: Dispatch<SetStateAction<EditorState>>;
}

const cellInput: React.CSSProperties = {
  width: '100%',
  fontSize: '0.8125rem',
  padding: '0.25rem 0.375rem',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
};

const cellArea: React.CSSProperties = { ...cellInput, resize: 'vertical', minHeight: '3rem' };

const th: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-secondary)',
  textAlign: 'left',
  padding: '0.25rem 0.375rem',
  fontWeight: 600,
};

/**
 * Storyboard editing experience (specs/003 US1/US2): scene list + cut table for the
 * active scene. Paper presets: anime = classic 5-column table; film = frame-first
 * cards. Isolated from screenplay/novel paths (no regression).
 */
export function StoryboardEditor({ state, setState }: StoryboardEditorProps): ReactElement {
  const content = state.storyboardContent ?? createEmptyStoryboardContent();
  const settings = state.storyboardSettings ?? DEFAULT_STORYBOARD_SETTINGS;
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  const setContent = (next: StoryboardContent): void => {
    setState((current) => ({ ...current, storyboardContent: next }));
  };
  const setSettings = (patch: Partial<StoryboardSettings>): void => {
    setState((current) => ({
      ...current,
      storyboardSettings: {
        ...(current.storyboardSettings ?? DEFAULT_STORYBOARD_SETTINGS),
        ...patch,
      },
    }));
  };

  const sortedScenes = [...content.scenes].sort((a, b) => a.order - b.order);
  const activeScene = sortedScenes.find((s) => s.id === activeSceneId) ?? sortedScenes[0] ?? null;
  const activeCuts = activeScene ? [...activeScene.cuts].sort((a, b) => a.order - b.order) : [];

  const handleAddScene = (): void => {
    const id = `scn-${crypto.randomUUID()}`;
    setContent(addScene(content, '', id));
    setActiveSceneId(id);
  };

  const patchCut = (cutId: string, patch: Partial<StoryboardCut>): void => {
    if (!activeScene) return;
    setContent(updateCut(content, activeScene.id, cutId, patch));
  };

  const cutRowControls = (cut: StoryboardCut, index: number): ReactElement => (
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      <button
        type="button"
        onClick={() => activeScene && setContent(moveCut(content, activeScene.id, cut.id, -1))}
        disabled={index === 0}
        title="上へ"
        style={{ padding: '0.2rem', opacity: index === 0 ? 0.3 : 1 }}
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        onClick={() => activeScene && setContent(moveCut(content, activeScene.id, cut.id, 1))}
        disabled={index === activeCuts.length - 1}
        title="下へ"
        style={{ padding: '0.2rem', opacity: index === activeCuts.length - 1 ? 0.3 : 1 }}
      >
        <ChevronDown size={13} />
      </button>
      <button
        type="button"
        className="btn-danger"
        onClick={() => activeScene && setContent(removeCut(content, activeScene.id, cut.id))}
        title="カットを削除"
        style={{ padding: '0.2rem', color: 'var(--color-danger, #dc2626)' }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  const timeInput = (cut: StoryboardCut): ReactElement => (
    <input
      type="number"
      min={0}
      step={0.5}
      value={cut.timeSec ?? ''}
      placeholder="秒"
      onChange={(e) => {
        const v = e.currentTarget.value;
        patchCut(cut.id, { timeSec: v === '' ? null : Number(v) });
      }}
      style={{ ...cellInput, width: '4.5rem' }}
    />
  );

  return (
    <>
      {/* ── 書式設定（用紙プリセット, FR-104） ── */}
      <section className="section-container" aria-label="書式設定">
        <h3>書式設定</h3>
        <div
          style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'end', flexWrap: 'wrap' }}
        >
          <label style={{ fontSize: '0.8125rem' }}>
            用紙{' '}
            <select
              value={settings.paperFormat}
              onChange={(e) =>
                setSettings({ paperFormat: e.currentTarget.value as 'anime' | 'film' })
              }
            >
              <option value="anime">アニメ式（5欄）</option>
              <option value="film">映画式（フレーム主体）</option>
            </select>
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            切替は表示のみ（データは保持されます）
          </span>
        </div>
      </section>

      {/* ── シーン一覧 ── */}
      <SceneList
        content={content}
        activeSceneId={activeScene?.id ?? null}
        onSelectScene={setActiveSceneId}
        onAddScene={handleAddScene}
        onRemoveScene={(id) => {
          setContent(removeScene(content, id));
          if (activeSceneId === id) setActiveSceneId(null);
        }}
        onMoveScene={(id, dir) => setContent(moveScene(content, id, dir))}
      />

      {/* ── カット表 ── */}
      <section className="section-container" aria-label="カット表">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>カット表{activeScene ? ` — ${activeScene.title || 'シーン'}` : ''}</h3>
          {activeScene && (
            <button
              type="button"
              onClick={() => setContent(addCut(content, activeScene.id))}
              style={{ display: 'flex', gap: '0.25rem' }}
            >
              <Plus size={14} /> カットを追加
            </button>
          )}
        </div>

        {activeScene && (
          <label style={{ display: 'block', fontSize: '0.8125rem', margin: '0.5rem 0' }}>
            シーン名{' '}
            <input
              value={activeScene.title}
              onChange={(e) =>
                setContent(updateScene(content, activeScene.id, { title: e.currentTarget.value }))
              }
              placeholder="例: 学校・屋上（夕）"
              style={{ ...cellInput, maxWidth: '24rem', display: 'inline-block' }}
            />
          </label>
        )}

        {!activeScene ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            シーンを追加（または選択）するとカット表を編集できます。
          </p>
        ) : activeCuts.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            カットがありません。「カットを追加」してください。
          </p>
        ) : settings.paperFormat === 'anime' ? (
          /* アニメ式: 5欄テーブル */
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '4.5rem' }}>カット</th>
                <th style={th}>画面（構図・カメラ）</th>
                <th style={th}>内容（アクション）</th>
                <th style={th}>セリフ／音</th>
                <th style={{ ...th, width: '5rem' }}>秒数</th>
                <th style={{ ...th, width: '6rem' }} />
              </tr>
            </thead>
            <tbody>
              {activeCuts.map((cut, index) => (
                <tr key={cut.id} style={{ verticalAlign: 'top' }}>
                  <td>
                    <input
                      value={cut.cutNumber}
                      onChange={(e) => patchCut(cut.id, { cutNumber: e.currentTarget.value })}
                      style={{ ...cellInput, width: '4rem' }}
                    />
                  </td>
                  <td>
                    <textarea
                      value={cut.picture}
                      onChange={(e) => patchCut(cut.id, { picture: e.currentTarget.value })}
                      placeholder="例: 屋上フェンス越しロング、PAN右"
                      rows={2}
                      style={cellArea}
                    />
                  </td>
                  <td>
                    <textarea
                      value={cut.action}
                      onChange={(e) => patchCut(cut.id, { action: e.currentTarget.value })}
                      placeholder="芝居・動き・演出指示"
                      rows={2}
                      style={cellArea}
                    />
                  </td>
                  <td>
                    <textarea
                      value={cut.dialogue}
                      onChange={(e) => patchCut(cut.id, { dialogue: e.currentTarget.value })}
                      placeholder="セリフ／SE・音楽"
                      rows={2}
                      style={cellArea}
                    />
                  </td>
                  <td>{timeInput(cut)}</td>
                  <td>{cutRowControls(cut, index)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* 映画式: フレーム主体カード */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeCuts.map((cut, index) => (
              <div
                key={cut.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <input
                    value={cut.cutNumber}
                    onChange={(e) => patchCut(cut.id, { cutNumber: e.currentTarget.value })}
                    style={{ ...cellInput, width: '5rem', fontWeight: 700 }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {timeInput(cut)}
                    {cutRowControls(cut, index)}
                  </div>
                </div>
                {/* フレーム（画面描写）を大きく */}
                <textarea
                  value={cut.picture}
                  onChange={(e) => patchCut(cut.id, { picture: e.currentTarget.value })}
                  placeholder="フレーム: 構図・カメラワークを大きく記述（16:9 を想定）"
                  rows={4}
                  style={{
                    ...cellArea,
                    minHeight: '6rem',
                    backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <textarea
                    value={cut.action}
                    onChange={(e) => patchCut(cut.id, { action: e.currentTarget.value })}
                    placeholder="内容（アクション）"
                    rows={2}
                    style={{ ...cellArea, flex: 1 }}
                  />
                  <textarea
                    value={cut.dialogue}
                    onChange={(e) => patchCut(cut.id, { dialogue: e.currentTarget.value })}
                    placeholder="セリフ／音"
                    rows={2}
                    style={{ ...cellArea, flex: 1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 合計（FR-105） */}
        <p className="status-text" style={{ marginTop: 'var(--space-sm)' }}>
          合計: {storyboardCutCount(content)}カット ／ 合計尺:{' '}
          {formatDuration(storyboardTotalSec(content))}
        </p>
      </section>
    </>
  );
}
