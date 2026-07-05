import { describe, it, expect } from 'vitest';
import {
  resolveFrameAspect,
  FRAME_ASPECT_PRESETS,
  formatCamera,
  type FrameAspect,
} from '../../src/types/storyboard';
import {
  buildImagePrompt,
  aspectToApiSize,
  DEFAULT_IMAGE_STYLE,
} from '../../src/services/openaiImageService';
import { addScene, addCut, updateCut, stripStoryboardImages } from '../../src/stores/editorStore';
import { createEmptyStoryboardContent } from '../../src/types/storyboard';
import { storyboardToText } from '../../src/services/storyboardGenerateService';
import {
  serializeStoryboardBackupJson,
  parseStoryboardBackupJson,
} from '../../src/services/storyboardBackupService';

describe('frame aspect (FR-113)', () => {
  it('falls back to 16:9 for missing/invalid values', () => {
    expect(resolveFrameAspect(undefined)).toEqual(FRAME_ASPECT_PRESETS['16:9']);
    expect(resolveFrameAspect(null)).toEqual(FRAME_ASPECT_PRESETS['16:9']);
    expect(resolveFrameAspect({ preset: 'custom', w: 0, h: 9 })).toEqual(
      FRAME_ASPECT_PRESETS['16:9'],
    );
    expect(resolveFrameAspect({ preset: 'custom', w: NaN, h: 1 })).toEqual(
      FRAME_ASPECT_PRESETS['16:9'],
    );
  });

  it('keeps valid custom ratios and maps to API sizes', () => {
    const vista: FrameAspect = { preset: 'custom', w: 1.85, h: 1 };
    expect(resolveFrameAspect(vista)).toEqual(vista);
    expect(aspectToApiSize(FRAME_ASPECT_PRESETS['16:9'])).toBe('1536x1024');
    expect(aspectToApiSize(FRAME_ASPECT_PRESETS['2.35:1'])).toBe('1536x1024');
    expect(aspectToApiSize({ preset: 'custom', w: 1, h: 1 })).toBe('1024x1024');
    expect(aspectToApiSize({ preset: 'custom', w: 9, h: 16 })).toBe('1024x1536');
  });
});

describe('camera direction (FR-114)', () => {
  it('formats size transition and work like WS→MS / T.U', () => {
    expect(formatCamera({ cameraSizeStart: 'WS', cameraSizeEnd: 'MS', cameraWork: 'TU' })).toBe(
      'WS→MS / T.U（トラックアップ）',
    );
    expect(formatCamera({ cameraSizeStart: 'CU' })).toBe('CU');
    expect(formatCamera({ cameraSizeStart: 'CU', cameraSizeEnd: 'CU' })).toBe('CU');
    expect(formatCamera({ cameraWork: 'FIX' })).toBe('FIX');
    expect(formatCamera({})).toBe('');
  });

  it('feeds camera info into storyboardToText for AI context', () => {
    let sc = addScene(createEmptyStoryboardContent(), '屋上', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = updateCut(sc, 'scn-1', 'cut-a', {
      cameraSizeStart: 'WS',
      cameraSizeEnd: 'MS',
      cameraWork: 'TU',
    });
    expect(storyboardToText(sc)).toContain('[カメラ]WS→MS / T.U（トラックアップ）');
  });

  it('is backward compatible: cuts without camera fields render no camera tag', () => {
    let sc = addScene(createEmptyStoryboardContent(), '屋上', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    expect(storyboardToText(sc)).not.toContain('[カメラ]');
  });
});

describe('image prompt + persistence policy (FR-115/117)', () => {
  it('composes prompt from style + aspect + camera + picture + action', () => {
    const prompt = buildImagePrompt(
      {
        picture: 'フェンス越しロング',
        action: '少女が振り向く',
        cameraSizeStart: 'WS',
        cameraSizeEnd: 'MS',
        cameraWork: 'TU',
      },
      FRAME_ASPECT_PRESETS['2.35:1'],
    );
    expect(prompt).toContain(DEFAULT_IMAGE_STYLE);
    expect(prompt).toContain('2.35:1');
    expect(prompt).toContain('WS→MS');
    expect(prompt).toContain('フェンス越しロング');
    expect(prompt).toContain('少女が振り向く');
  });

  it('stripStoryboardImages removes images (Firestore) but backup keeps them', () => {
    let sc = addScene(createEmptyStoryboardContent(), 'S', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = updateCut(sc, 'scn-1', 'cut-a', {
      image: {
        versions: [{ id: 'v1', dataB64: 'QUJD', prompt: 'p', createdAt: 1 }],
        adoptedId: 'v1',
        chat: [],
      },
    });

    const stripped = stripStoryboardImages(sc);
    expect(stripped.scenes[0]!.cuts[0]!.image).toBeUndefined();
    // 元データは不変（非破壊）
    expect(sc.scenes[0]!.cuts[0]!.image?.adoptedId).toBe('v1');

    // JSON バックアップは画像を内包して往復できる（FR-117）
    const json = serializeStoryboardBackupJson({
      title: 't',
      authorName: 'a',
      synopsis: '',
      storyboardContent: sc,
      storyboardSettings: { paperFormat: 'anime', frameAspect: FRAME_ASPECT_PRESETS['16:9'] },
    });
    const restored = parseStoryboardBackupJson(json);
    expect(restored.storyboardContent.scenes[0]!.cuts[0]!.image?.versions[0]?.dataB64).toBe('QUJD');
  });

  it('attached versions keep their mime through backup roundtrip (FR-119)', () => {
    let sc = addScene(createEmptyStoryboardContent(), 'S', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = updateCut(sc, 'scn-1', 'cut-a', {
      image: {
        versions: [
          {
            id: 'v1',
            dataB64: 'QUJD',
            mime: 'image/jpeg',
            prompt: '添付: rooftop.jpg',
            createdAt: 1,
          },
        ],
        adoptedId: 'v1',
        chat: [],
      },
    });
    const json = serializeStoryboardBackupJson({
      title: 't',
      authorName: 'a',
      synopsis: '',
      storyboardContent: sc,
      storyboardSettings: { paperFormat: 'anime', frameAspect: FRAME_ASPECT_PRESETS['16:9'] },
    });
    const restored = parseStoryboardBackupJson(json);
    const v = restored.storyboardContent.scenes[0]!.cuts[0]!.image?.versions[0];
    expect(v?.mime).toBe('image/jpeg');
    expect(v?.dataB64).toBe('QUJD');
  });
});
