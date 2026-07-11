import { type ReactElement } from 'react';
import type { FrameAspect, StoryboardCharacter, StoryboardCut } from '../../types/storyboard';
import {
  buildImagePrompt,
  generateWithReferences,
  editImage,
  getOpenAiKey,
  DEFAULT_IMAGE_STYLE,
  type CharacterRef,
  type ReferenceImage,
} from '../../services/openaiImageService';
import { ImageStudioControls, adoptedVersion, emptyImage } from './ImageStudio';

interface CutImagePanelProps {
  cut: StoryboardCut;
  aspect: FrameAspect;
  /** Patch the cut (picture text or image state). */
  onPatch: (patch: Partial<Pick<StoryboardCut, 'picture' | 'image'>>) => void;
  /** Characters appearing in this cut — their adopted images seed generation (FR-205). */
  referencedCharacters?: StoryboardCharacter[];
}

/**
 * Per-cut frame block (specs/003 FR-115/116, 005 FR-205): shows the adopted
 * image (letterboxed) or the 構図メモ textarea; below it the shared image studio.
 * Generation is guided by the referenced characters' adopted images.
 */
export function CutImagePanel({
  cut,
  aspect,
  onPatch,
  referencedCharacters = [],
}: CutImagePanelProps): ReactElement {
  const image = cut.image ?? emptyImage();
  const adopted = adoptedVersion(image);
  const hasKey = getOpenAiKey().length > 0;

  const charRefs: CharacterRef[] = referencedCharacters
    .filter((c) => c.name.trim() || c.description.trim())
    .map((c) => ({ name: c.name, description: c.description }));

  const referenceImages: ReferenceImage[] = referencedCharacters
    .map((c) => adoptedVersion(c.image))
    .filter((v): v is NonNullable<typeof v> => v != null)
    .map((v) => ({ b64: v.dataB64, ...(v.mime ? { mime: v.mime } : {}) }));

  return (
    <div>
      {/* 絵枠（アスペクト準拠） */}
      <div
        style={{
          aspectRatio: `${aspect.w} / ${aspect.h}`,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          backgroundColor: adopted ? '#111' : 'var(--color-bg-secondary, #f8fafc)',
          display: 'flex',
        }}
      >
        {adopted ? (
          <img
            src={`data:${adopted.mime ?? 'image/png'};base64,${adopted.dataB64}`}
            alt={cut.cutNumber}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <textarea
            value={cut.picture}
            onChange={(e) => onPatch({ picture: e.currentTarget.value })}
            placeholder="構図・カメラの字コンテ（例: フェンス越しロング、夕日逆光）"
            style={{
              flex: 1,
              border: 'none',
              resize: 'none',
              padding: '0.5rem',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              backgroundColor: 'transparent',
            }}
          />
        )}
      </div>

      <ImageStudioControls
        image={image}
        onChange={(img) => onPatch({ image: img })}
        buildPrompt={() => buildImagePrompt(cut, aspect, DEFAULT_IMAGE_STYLE, charRefs)}
        generate={(prompt) => generateWithReferences(prompt, aspect, referenceImages)}
        edit={(baseB64, instruction, mime) => editImage(baseB64, instruction, aspect, mime)}
        aspect={aspect}
        canGenerate={hasKey}
      />
    </div>
  );
}
