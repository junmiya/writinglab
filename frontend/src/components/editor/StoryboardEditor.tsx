import { useRef, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { SceneList } from './SceneList';
import { CutImagePanel } from './CutImagePanel';
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
  FRAME_ASPECT_PRESETS,
  resolveFrameAspect,
  CAMERA_SIZE_OPTIONS,
  CAMERA_WORK_OPTIONS,
  formatCamera,
  type CameraSize,
  type CameraWork,
  type StoryboardContent,
  type StoryboardCut,
  type StoryboardSettings,
} from '../../types/storyboard';
import { ChevronUp, ChevronDown, Plus, Trash2, Wand2, Camera } from 'lucide-react';
import { AiAdvicePanel } from '../advice/AiAdvicePanel';
import { AiDiscussionPanel } from '../advice/AiDiscussionPanel';
import {
  STORYBOARD_ADVICE_EXPERTS,
  STORYBOARD_DISCUSSION_A,
  STORYBOARD_DISCUSSION_B,
} from '../../modes/storyboard/prompts';
import {
  generateStoryboardFromScript,
  storyboardToText,
} from '../../services/storyboardGenerateService';
import { listScripts, type FirestoreScript } from '../../lib/firebase/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import {
  serializeStoryboardBackupJson,
  parseStoryboardBackupJson,
  buildStoryboardMarkdown,
  downloadTextFile,
  backupFilename,
} from '../../services/storyboardBackupService';
import { getOpenAiKey, setOpenAiKey } from '../../services/openaiImageService';

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

const cellArea: React.CSSProperties = { ...cellInput, resize: 'vertical', minHeight: '3.5rem' };

const colLabel: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const smallSelect: React.CSSProperties = { fontSize: '0.6875rem', padding: '0.15rem 0.25rem' };

/**
 * Camera direction (FR-114) as a compact one-line summary that expands to the
 * size-start → size-end / work dropdowns on click, keeping cut rows short.
 */
function CameraField({
  cut,
  onPatch,
}: {
  cut: StoryboardCut;
  onPatch: (patch: Partial<StoryboardCut>) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const summary = formatCamera(cut);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="カメラ指示を編集"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.6875rem',
          padding: '0.15rem 0.4rem',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: summary ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <Camera size={12} /> {summary || 'カメラ指示'}
      </button>
      {open && (
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginTop: '0.25rem',
          }}
        >
          <select
            value={cut.cameraSizeStart ?? ''}
            onChange={(e) =>
              onPatch({
                cameraSizeStart: (e.currentTarget.value || undefined) as CameraSize | undefined,
              })
            }
            title="サイズ（開始）"
            style={smallSelect}
          >
            <option value="">サイズ—</option>
            {CAMERA_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>→</span>
          <select
            value={cut.cameraSizeEnd ?? ''}
            onChange={(e) =>
              onPatch({
                cameraSizeEnd: (e.currentTarget.value || undefined) as CameraSize | undefined,
              })
            }
            title="サイズ（終了・任意）"
            style={smallSelect}
          >
            <option value="">終了—</option>
            {CAMERA_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={cut.cameraWork ?? ''}
            onChange={(e) =>
              onPatch({
                cameraWork: (e.currentTarget.value || undefined) as CameraWork | undefined,
              })
            }
            title="カメラワーク"
            style={smallSelect}
          >
            <option value="">ワーク—</option>
            {CAMERA_WORK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * Storyboard editor (specs/003 Session 4, FR-118): cut rows laid out as
 * No.+sec | 絵 (aspect frame) | 指示 (camera dropdowns + action) | セリフ.
 * Scene list on the left rail; AI panels and low-frequency features collapsed.
 * Paper presets: anime = horizontal rows; film = frame-first stacked cards.
 */
export function StoryboardEditor({ state, setState }: StoryboardEditorProps): ReactElement {
  const { user } = useAuth();
  const content = state.storyboardContent ?? createEmptyStoryboardContent();
  const settings = state.storyboardSettings ?? DEFAULT_STORYBOARD_SETTINGS;
  const aspect = resolveFrameAspect(settings.frameAspect);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  // ── OpenAI キー（BYOK, FR-115）──
  const [keyDraft, setKeyDraft] = useState(getOpenAiKey());
  const [keySaved, setKeySaved] = useState(false);

  // ── バックアップ（FR-111/117） ──
  const [backupMessage, setBackupMessage] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  const backupInput = () => ({
    title: state.title,
    authorName: state.authorName,
    synopsis: state.synopsis,
    storyboardContent: content,
    storyboardSettings: settings,
    ...(state.storyboardDiscussion ? { storyboardDiscussion: state.storyboardDiscussion } : {}),
    ...(state.sourceScriptId ? { sourceScriptId: state.sourceScriptId } : {}),
  });

  const onExportJson = (): void => {
    downloadTextFile(
      backupFilename(state.title, 'json'),
      serializeStoryboardBackupJson(backupInput()),
      'application/json',
    );
    setBackupMessage('JSON バックアップを書き出しました（画像も内包）');
  };

  const onExportMarkdown = (): void => {
    downloadTextFile(
      backupFilename(state.title, 'md'),
      buildStoryboardMarkdown(backupInput()),
      'text/markdown',
    );
    setBackupMessage('Markdown を書き出しました');
  };

  const onImportJson = async (file: File): Promise<void> => {
    try {
      const backup = parseStoryboardBackupJson(await file.text());
      if (!confirm('現在の絵コンテを復元データで上書きします。よろしいですか？')) return;
      setState((current) => ({
        ...current,
        contentType: 'storyboard',
        title: backup.title,
        authorName: backup.authorName,
        synopsis: backup.synopsis,
        storyboardContent: backup.storyboardContent,
        storyboardSettings: backup.storyboardSettings,
        ...(backup.storyboardDiscussion
          ? { storyboardDiscussion: backup.storyboardDiscussion }
          : {}),
        ...(backup.sourceScriptId ? { sourceScriptId: backup.sourceScriptId } : {}),
      }));
      setActiveSceneId(null);
      setBackupMessage('JSON から完全復元しました（保存で確定）');
    } catch (error) {
      setBackupMessage(`復元に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // ── 脚本→カット割り生成（FR-110） ──
  const [sourceScripts, setSourceScripts] = useState<FirestoreScript[] | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');

  const loadSourceScripts = async (): Promise<void> => {
    if (!user || sourceScripts !== null) return;
    try {
      const all = await listScripts(user.uid);
      setSourceScripts(all.filter((s) => (s.contentType ?? 'screenplay') === 'screenplay'));
    } catch {
      setGenerateMessage('脚本一覧の取得に失敗しました');
      setSourceScripts([]);
    }
  };

  const onGenerate = async (): Promise<void> => {
    const source = sourceScripts?.find((s) => s.id === selectedSourceId);
    if (!source) return;
    if (
      storyboardCutCount(content) > 0 &&
      !confirm('既存のカット表を生成結果で上書きします。よろしいですか？')
    ) {
      return;
    }
    setGenerating(true);
    setGenerateMessage('');
    try {
      const generated = await generateStoryboardFromScript('gemini', {
        synopsis: source.synopsis ?? '',
        content: source.content ?? '',
      });
      setState((current) => ({
        ...current,
        storyboardContent: generated,
        sourceScriptId: source.id,
      }));
      setActiveSceneId(null);
      setGenerateMessage(
        `「${source.title}」から ${generated.scenes.length} シーンを生成しました（保存で確定）`,
      );
    } catch (error) {
      setGenerateMessage(`生成に失敗: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── 共通更新ヘルパー ──
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
      style={{ ...cellInput, width: '3.5rem', fontSize: '0.6875rem', padding: '0.15rem 0.25rem' }}
    />
  );

  const isFilm = settings.paperFormat === 'film';

  return (
    <>
      {/* ── 書式設定（用紙・アスペクト・キー, FR-104/113/115） ── */}
      <section className="section-container" aria-label="書式設定">
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-lg)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <label style={{ fontSize: '0.8125rem' }}>
            用紙{' '}
            <select
              value={settings.paperFormat}
              onChange={(e) =>
                setSettings({ paperFormat: e.currentTarget.value as 'anime' | 'film' })
              }
            >
              <option value="anime">アニメ式（横並び）</option>
              <option value="film">映画式（フレーム主体）</option>
            </select>
          </label>
          <label style={{ fontSize: '0.8125rem' }}>
            アスペクト{' '}
            <select
              value={aspect.preset}
              onChange={(e) => {
                const v = e.currentTarget.value as '16:9' | '2.35:1' | 'custom';
                setSettings({
                  frameAspect:
                    v === 'custom'
                      ? { preset: 'custom', w: aspect.w, h: aspect.h }
                      : FRAME_ASPECT_PRESETS[v],
                });
              }}
            >
              <option value="16:9">16:9（TV・アニメ）</option>
              <option value="2.35:1">2.35:1（シネスコ）</option>
              <option value="custom">カスタム</option>
            </select>
          </label>
          {aspect.preset === 'custom' && (
            <span
              style={{
                fontSize: '0.8125rem',
                display: 'inline-flex',
                gap: '0.25rem',
                alignItems: 'center',
              }}
            >
              <input
                type="number"
                min={0.1}
                step={0.01}
                value={aspect.w}
                onChange={(e) =>
                  setSettings({
                    frameAspect: {
                      preset: 'custom',
                      w: Number(e.currentTarget.value) || 16,
                      h: aspect.h,
                    },
                  })
                }
                style={{ ...cellInput, width: '4rem' }}
              />
              :
              <input
                type="number"
                min={0.1}
                step={0.01}
                value={aspect.h}
                onChange={(e) =>
                  setSettings({
                    frameAspect: {
                      preset: 'custom',
                      w: aspect.w,
                      h: Number(e.currentTarget.value) || 9,
                    },
                  })
                }
                style={{ ...cellInput, width: '4rem' }}
              />
            </span>
          )}
          <details>
            <summary
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              OpenAI キー（画像生成）
            </summary>
            <div
              style={{
                display: 'flex',
                gap: '0.375rem',
                marginTop: '0.375rem',
                alignItems: 'center',
              }}
            >
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => {
                  setKeyDraft(e.currentTarget.value);
                  setKeySaved(false);
                }}
                placeholder="sk-..."
                style={{ ...cellInput, width: '16rem' }}
              />
              <button
                type="button"
                onClick={() => {
                  setOpenAiKey(keyDraft.trim());
                  setKeySaved(true);
                }}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
              >
                保存
              </button>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                {keySaved ? '保存しました（この端末のみ）' : '端末内にのみ保存されます'}
              </span>
            </div>
          </details>
        </div>
      </section>

      {/* ── 脚本からカット割り生成（折りたたみ, FR-110） ── */}
      <section className="section-container" aria-label="脚本からカット割り生成">
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            脚本からカット割り生成
          </summary>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: '0.5rem',
            }}
          >
            <select
              value={selectedSourceId}
              onFocus={() => void loadSourceScripts()}
              onChange={(e) => setSelectedSourceId(e.currentTarget.value)}
              style={{ fontSize: '0.8125rem', padding: '0.3rem 0.5rem', minWidth: '16rem' }}
            >
              <option value="">
                {sourceScripts === null
                  ? '脚本を選択（クリックで読み込み）...'
                  : sourceScripts.length === 0
                    ? '脚本がありません'
                    : '脚本を選択...'}
              </option>
              {(sourceScripts ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || '(無題)'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void onGenerate()}
              disabled={generating || !selectedSourceId}
              style={{ display: 'flex', gap: '0.25rem', fontSize: '0.8125rem' }}
            >
              <Wand2 size={14} />
              {generating ? '生成中...' : 'AI でカット割り生成'}
            </button>
          </div>
          {generateMessage ? <p className="status-text">{generateMessage}</p> : null}
        </details>
      </section>

      {/* ── 本体: シーン一覧（左レール）＋カット行（FR-118） ── */}
      <section className="section-container" aria-label="カット表">
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
          <div style={{ width: '280px', flexShrink: 0 }}>
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
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {activeScene && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                  gap: '0.5rem',
                }}
              >
                <input
                  value={activeScene.title}
                  onChange={(e) =>
                    setContent(
                      updateScene(content, activeScene.id, { title: e.currentTarget.value }),
                    )
                  }
                  placeholder="シーン名（例: 学校・屋上（夕））"
                  style={{ ...cellInput, maxWidth: '22rem' }}
                />
                <button
                  type="button"
                  onClick={() => setContent(addCut(content, activeScene.id))}
                  style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}
                >
                  <Plus size={14} /> カットを追加
                </button>
              </div>
            )}

            {!activeScene ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                シーンを追加するとカット表を編集できます。
              </p>
            ) : activeCuts.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                カットがありません。「カットを追加」してください。
              </p>
            ) : (
              <>
                {!isFilm && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{ width: '3.5rem', ...colLabel }}>No.</div>
                    <div style={{ width: '36%', ...colLabel }}>絵（画面）</div>
                    <div style={{ flex: 1, ...colLabel }}>指示（カメラ・内容）</div>
                    <div style={{ flex: 1, ...colLabel }}>セリフ・音</div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {activeCuts.map((cut, index) =>
                    isFilm ? (
                      /* 映画式: フレーム主体スタック */
                      <div
                        key={cut.id}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.625rem',
                          backgroundColor: 'var(--color-surface)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.375rem',
                          }}
                        >
                          <input
                            value={cut.cutNumber}
                            onChange={(e) => patchCut(cut.id, { cutNumber: e.currentTarget.value })}
                            style={{ ...cellInput, width: '4.5rem', fontWeight: 700 }}
                          />
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                            {timeInput(cut)}
                            {cutRowControls(cut, index)}
                          </div>
                        </div>
                        <CutImagePanel
                          cut={cut}
                          aspect={aspect}
                          onPatch={(patch) => patchCut(cut.id, patch)}
                        />
                        <div style={{ marginTop: '0.375rem' }}>
                          <CameraField cut={cut} onPatch={(p) => patchCut(cut.id, p)} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
                          <textarea
                            value={cut.action}
                            onChange={(e) => patchCut(cut.id, { action: e.currentTarget.value })}
                            placeholder="内容（アクション・演出）"
                            rows={2}
                            style={{ ...cellArea, flex: 1 }}
                          />
                          <textarea
                            value={cut.dialogue}
                            onChange={(e) => patchCut(cut.id, { dialogue: e.currentTarget.value })}
                            placeholder="セリフ／音・SE"
                            rows={2}
                            style={{ ...cellArea, flex: 1 }}
                          />
                        </div>
                      </div>
                    ) : (
                      /* アニメ式: No.＋秒数 | 絵 | 指示 | セリフ の横並び行 */
                      <div
                        key={cut.id}
                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}
                      >
                        <div
                          style={{
                            width: '3.5rem',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                          }}
                        >
                          <input
                            value={cut.cutNumber}
                            onChange={(e) => patchCut(cut.id, { cutNumber: e.currentTarget.value })}
                            style={{
                              ...cellInput,
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.25rem',
                            }}
                          />
                          {timeInput(cut)}
                          {cutRowControls(cut, index)}
                        </div>
                        <div style={{ width: '36%', flexShrink: 0 }}>
                          <CutImagePanel
                            cut={cut}
                            aspect={aspect}
                            onPatch={(patch) => patchCut(cut.id, patch)}
                          />
                        </div>
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                          }}
                        >
                          <CameraField cut={cut} onPatch={(p) => patchCut(cut.id, p)} />
                          <textarea
                            value={cut.action}
                            onChange={(e) => patchCut(cut.id, { action: e.currentTarget.value })}
                            placeholder="内容（アクション・演出）"
                            rows={3}
                            style={{ ...cellArea, flex: 1 }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <textarea
                            value={cut.dialogue}
                            onChange={(e) => patchCut(cut.id, { dialogue: e.currentTarget.value })}
                            placeholder="セリフ／音・SE"
                            rows={5}
                            style={{ ...cellArea, height: '100%' }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}

            <p className="status-text" style={{ marginTop: 'var(--space-sm)' }}>
              合計: {storyboardCutCount(content)}カット ／ 合計尺:{' '}
              {formatDuration(storyboardTotalSec(content))}
            </p>
          </div>
        </div>
      </section>

      {/* ── AI（下部折りたたみ, FR-118） ── */}
      <section className="section-container" aria-label="AI評価">
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            AI評価（演出家・撮影・編集）
          </summary>
          <div style={{ marginTop: '0.5rem' }}>
            <AiAdvicePanel
              label="カット表"
              text={storyboardToText(content)}
              experts={STORYBOARD_ADVICE_EXPERTS}
            />
          </div>
        </details>
      </section>

      <section className="section-container" aria-label="AI対話批評">
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            AI対話批評（監督 vs 編集技師）
          </summary>
          <div style={{ marginTop: '0.5rem' }}>
            <AiDiscussionPanel
              roleA={STORYBOARD_DISCUSSION_A}
              roleB={STORYBOARD_DISCUSSION_B}
              synopsis={state.synopsis}
              content={storyboardToText(content)}
              messages={state.storyboardDiscussion ?? []}
              onMessagesChange={(msgs) =>
                setState((current) => ({ ...current, storyboardDiscussion: msgs }))
              }
            />
          </div>
        </details>
      </section>

      {/* ── バックアップ（折りたたみ, FR-111/117） ── */}
      <section className="section-container" aria-label="バックアップ">
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            バックアップ（JSON 完全復元 / Markdown）
          </summary>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: '0.5rem',
            }}
          >
            <button type="button" onClick={onExportJson}>
              JSON バックアップ
            </button>
            <button type="button" onClick={() => importRef.current?.click()}>
              JSON から復元
            </button>
            <button type="button" onClick={onExportMarkdown}>
              Markdown 書き出し
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) void onImportJson(file);
                e.currentTarget.value = '';
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              画像は JSON バックアップにのみ保存されます（クラウド保存は後続）
            </span>
          </div>
          {backupMessage ? <p className="status-text">{backupMessage}</p> : null}
        </details>
      </section>
    </>
  );
}
