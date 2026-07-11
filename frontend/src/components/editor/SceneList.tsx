import { useState, type ReactElement } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, Search } from 'lucide-react';
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
 * Storyboard scene list (FR-102 / FR-118): each scene shows a truncated title
 * over a small cut-count line. Long screenplays generate many scenes, so the
 * list is searchable, scrollable, and shows reorder/delete only for the active
 * scene to keep rows single-line. Mirrors the novel ChapterList pattern.
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
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? sorted.filter((s) => (s.title || '').toLowerCase().includes(q)) : sorted;

  return (
    <section aria-label="シーン一覧" className="section-container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '0.9rem' }}>シーン一覧</h3>
        <button
          type="button"
          onClick={onAddScene}
          style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', fontSize: '0.75rem' }}
        >
          <Plus size={13} /> 追加
        </button>
      </div>

      {sorted.length > 8 && (
        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="シーンを検索"
            style={{
              width: '100%',
              fontSize: '0.75rem',
              padding: '0.3rem 0.4rem 0.3rem 1.4rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </div>
      )}

      {sorted.length === 0 ? (
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
          シーンがありません。「追加」から始めてください。
        </p>
      ) : (
        <>
          <p
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-secondary)',
              margin: '0 0 0.375rem',
            }}
          >
            全 {sorted.length} シーン{q ? `（${filtered.length} 件一致）` : ''}
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            {filtered.map((scene) => {
              const index = sorted.indexOf(scene);
              const isActive = scene.id === activeSceneId;
              const sceneSec = scene.cuts.reduce((s, c) => s + (c.timeSec ?? 0), 0);
              return (
                <li key={scene.id} style={{ marginBottom: '0.25rem' }}>
                  <div
                    style={{
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      overflow: 'hidden',
                      backgroundColor: isActive
                        ? 'var(--color-primary-light, #dbeafe)'
                        : 'var(--color-surface)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectScene(scene.id)}
                      title={scene.title || `（シーン${index + 1}）`}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.375rem 0.5rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '0.8125rem',
                        }}
                      >
                        {scene.title || `（シーン${index + 1}）`}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.625rem',
                          color: 'var(--text-secondary)',
                          marginTop: '0.1rem',
                        }}
                      >
                        {scene.cuts.length}カット / {formatDuration(sceneSec)}
                      </span>
                    </button>
                    {isActive && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '0.25rem',
                          padding: '0 0.375rem 0.375rem',
                        }}
                      >
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
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
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
