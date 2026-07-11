import { describe, it, expect } from 'vitest';
import {
  addScene,
  addCut,
  addCharacter,
  updateCharacter,
  removeCharacter,
  moveCharacter,
  toggleCutCharacter,
  stripStoryboardImages,
} from '../../src/stores/editorStore';
import { createEmptyStoryboardContent, FRAME_ASPECT_PRESETS } from '../../src/types/storyboard';
import { buildCharacterPrompt, buildImagePrompt } from '../../src/services/openaiImageService';
import {
  serializeStoryboardBackupJson,
  parseStoryboardBackupJson,
} from '../../src/services/storyboardBackupService';

describe('character CRUD (005 / FR-201)', () => {
  it('adds, updates, moves and removes characters', () => {
    let sc = createEmptyStoryboardContent();
    sc = addCharacter(sc, 'ミオ', 'chr-1');
    sc = addCharacter(sc, 'ケン', 'chr-2');
    expect(sc.characters?.map((c) => c.name)).toEqual(['ミオ', 'ケン']);

    sc = updateCharacter(sc, 'chr-1', { description: '黒髪ボブ、制服' });
    expect(sc.characters?.find((c) => c.id === 'chr-1')?.description).toBe('黒髪ボブ、制服');

    sc = moveCharacter(sc, 'chr-2', -1);
    expect(sc.characters?.map((c) => c.id)).toEqual(['chr-2', 'chr-1']);

    sc = removeCharacter(sc, 'chr-2');
    expect(sc.characters?.map((c) => c.id)).toEqual(['chr-1']);
  });

  it('toggling a cut character links/unlinks, and removing a character unlinks cuts', () => {
    let sc = createEmptyStoryboardContent();
    sc = addCharacter(sc, 'ミオ', 'chr-1');
    sc = addScene(sc, 'S', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-1');

    sc = toggleCutCharacter(sc, 'scn-1', 'cut-1', 'chr-1');
    expect(sc.scenes[0]!.cuts[0]!.characterIds).toEqual(['chr-1']);
    sc = toggleCutCharacter(sc, 'scn-1', 'cut-1', 'chr-1');
    expect(sc.scenes[0]!.cuts[0]!.characterIds).toEqual([]);

    sc = toggleCutCharacter(sc, 'scn-1', 'cut-1', 'chr-1');
    sc = removeCharacter(sc, 'chr-1');
    expect(sc.scenes[0]!.cuts[0]!.characterIds).toEqual([]);
  });

  it('stripStoryboardImages removes character images but backup keeps them (FR-203)', () => {
    let sc = createEmptyStoryboardContent();
    sc = addCharacter(sc, 'ミオ', 'chr-1');
    sc = updateCharacter(sc, 'chr-1', {
      image: {
        versions: [{ id: 'v1', dataB64: 'QUJD', mime: 'image/png', prompt: 'p', createdAt: 1 }],
        adoptedId: 'v1',
        chat: [],
      },
    });

    const stripped = stripStoryboardImages(sc);
    expect(stripped.characters?.[0]?.image).toBeUndefined();
    // 非破壊
    expect(sc.characters?.[0]?.image?.adoptedId).toBe('v1');

    const json = serializeStoryboardBackupJson({
      title: 't',
      authorName: 'a',
      synopsis: '',
      storyboardContent: sc,
      storyboardSettings: { paperFormat: 'anime', frameAspect: FRAME_ASPECT_PRESETS['16:9'] },
    });
    const restored = parseStoryboardBackupJson(json);
    expect(restored.storyboardContent.characters?.[0]?.image?.versions[0]?.dataB64).toBe('QUJD');
  });
});

describe('character-aware prompts (005 / FR-204/205)', () => {
  it('buildCharacterPrompt composes name + description + style', () => {
    const p = buildCharacterPrompt({ name: 'ミオ', description: '黒髪ボブ、制服、17歳' });
    expect(p).toContain('ミオ');
    expect(p).toContain('黒髪ボブ');
  });

  it('buildImagePrompt lists referenced characters', () => {
    const p = buildImagePrompt(
      { picture: '教室', action: '振り向く', cameraSizeStart: 'BS' },
      FRAME_ASPECT_PRESETS['16:9'],
      undefined,
      [{ name: 'ミオ', description: '黒髪ボブ' }],
    );
    expect(p).toContain('登場人物: ミオ（黒髪ボブ）');
    expect(p).toContain('参照画像');
  });

  it('buildImagePrompt omits the character line when none referenced', () => {
    const p = buildImagePrompt(
      { picture: '教室', action: '振り向く' },
      FRAME_ASPECT_PRESETS['16:9'],
    );
    expect(p).not.toContain('登場人物:');
  });
});
