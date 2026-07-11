import { type ReactElement } from 'react';
import { ChevronUp, ChevronDown, Trash2, User } from 'lucide-react';
import type { FrameAspect, StoryboardCharacter } from '../../types/storyboard';
import {
  buildCharacterPrompt,
  generateImage,
  editImage,
  getOpenAiKey,
} from '../../services/openaiImageService';
import { ImageStudioControls, adoptedVersion, emptyImage } from './ImageStudio';

/** Character reference sheets are framed portrait. */
const PORTRAIT_ASPECT: FrameAspect = { preset: 'custom', w: 3, h: 4 };

interface CharacterPanelProps {
  character: StoryboardCharacter;
  onPatch: (patch: Partial<Pick<StoryboardCharacter, 'name' | 'description' | 'image'>>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  disableUp: boolean;
  disableDown: boolean;
}

const iconBtn: React.CSSProperties = {
  padding: '0.2rem',
  display: 'inline-flex',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
};

/**
 * Character card (005 / FR-206): name + 容姿 description + a portrait reference
 * image via the shared studio (generate / attach / paste / prompt). The adopted
 * image is used to keep cut generation on-model (FR-205).
 */
export function CharacterPanel({
  character,
  onPatch,
  onRemove,
  onMove,
  disableUp,
  disableDown,
}: CharacterPanelProps): ReactElement {
  const image = character.image ?? emptyImage();
  const adopted = adoptedVersion(image);
  const hasKey = getOpenAiKey().length > 0;

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.625rem',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div
        style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', marginBottom: '0.5rem' }}
      >
        <input
          value={character.name}
          onChange={(e) => onPatch({ name: e.currentTarget.value })}
          placeholder="登場人物名（例: 佐藤ミオ）"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.875rem',
            fontWeight: 700,
            padding: '0.25rem 0.375rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={disableUp}
          title="上へ"
          style={{ ...iconBtn, opacity: disableUp ? 0.3 : 1 }}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={disableDown}
          title="下へ"
          style={{ ...iconBtn, opacity: disableDown ? 0.3 : 1 }}
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="登場人物を削除"
          style={{ ...iconBtn, color: 'var(--color-danger, #dc2626)' }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ width: '110px', flexShrink: 0 }}>
          <div
            style={{
              aspectRatio: `${PORTRAIT_ASPECT.w} / ${PORTRAIT_ASPECT.h}`,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: adopted ? '#111' : 'var(--color-bg-secondary, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {adopted ? (
              <img
                src={`data:${adopted.mime ?? 'image/png'};base64,${adopted.dataB64}`}
                alt={character.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <User size={28} color="var(--text-secondary)" />
            )}
          </div>
        </div>

        <div
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
        >
          <textarea
            value={character.description}
            onChange={(e) => onPatch({ description: e.currentTarget.value })}
            placeholder="容姿・特徴（髪型・服装・体格・年齢感など。作画プロンプトに使われます）"
            rows={3}
            style={{
              width: '100%',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              padding: '0.375rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              resize: 'vertical',
            }}
          />
          <ImageStudioControls
            image={image}
            onChange={(img) => onPatch({ image: img })}
            buildPrompt={() => buildCharacterPrompt(character)}
            generate={(prompt) => generateImage(prompt, PORTRAIT_ASPECT)}
            edit={(baseB64, instruction, mime) =>
              editImage(baseB64, instruction, PORTRAIT_ASPECT, mime)
            }
            aspect={PORTRAIT_ASPECT}
            canGenerate={hasKey}
          />
        </div>
      </div>
    </div>
  );
}
