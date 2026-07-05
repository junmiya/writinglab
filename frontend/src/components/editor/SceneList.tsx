import type { ReactElement } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { StoryboardContent } from '../../types/storyboard';
import { formatDuration } from '../../stores/editorStore';

interface SceneListProps {
  content: StoryboardContent;
  activeSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  onAddScene: () => void;
  onRemoveScene: (sceneId: string) => void;
  onMoveScene: (sceneId: string, direction: -1 | 1) => void;
}

/**
 * Storyboard scene list (FR-102): title + cut count + scene duration, with
 * add/move/remove and selection. Mirrors the novel ChapterList pattern.
 */
export function SceneList({
  content,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onRemoveScene,
  onMoveScene,
}: SceneListProps): ReactElement {
  const sorted = [...content.scenes].sort((a, b) => a.order - b.order);

  return (
    <section aria-label="シーン一覧" className="section-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>シーン一覧</h3>
        <button type="button" onClick={onAddScene} style={{ display: 'flex', gap: '0.25rem' }}>
          <Plus size={14} /> シーンを追加
        </button>
      </div>

      {sorted.length === 0 ? (
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
          シーンがありません。「シーンを追加」から始めてください。
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sorted.map((scene, index) => {
            const isActive = scene.id === activeSceneId;
            const sceneSec = scene.cuts.reduce((s, c) => s + (c.timeSec ?? 0), 0);
            return (
              <li key={scene.id} style={{ marginBottom: '0.375rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.375rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: isActive
                      ? 'var(--color-primary-light, #dbeafe)'
                      : 'var(--color-surface)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectScene(scene.id)}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontWeight: isActive ? 700 : 500,
                    }}
                    title="このシーンのカット表を編集"
                  >
                    {scene.title || `（シーン${index + 1}）`}
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-secondary)',
                        marginLeft: '0.5rem',
                      }}
                    >
                      {scene.cuts.length}カット / {formatDuration(sceneSec)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveScene(scene.id, -1)}
                    disabled={index === 0}
                    title="上へ"
                    style={iconBtn(index === 0)}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveScene(scene.id, 1)}
                    disabled={index === sorted.length - 1}
                    title="下へ"
                    style={iconBtn(index === sorted.length - 1)}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => onRemoveScene(scene.id)}
                    title="シーンを削除"
                    style={{ ...iconBtn(false), color: 'var(--color-danger, #dc2626)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.25rem',
    background: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    color: 'var(--text-secondary)',
    display: 'inline-flex',
  };
}
