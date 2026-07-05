import { describe, it, expect } from 'vitest';
import {
  serializeStoryboardBackupJson,
  parseStoryboardBackupJson,
  buildStoryboardMarkdown,
  type StoryboardBackupInput,
} from '../../src/services/storyboardBackupService';

function sampleInput(): StoryboardBackupInput {
  return {
    title: 'PV コンテ',
    authorName: '宮本',
    synopsis: '夕暮れの再会。',
    storyboardContent: {
      scenes: [
        {
          id: 'scn-1',
          title: '屋上（夕）',
          order: 0,
          cuts: [
            {
              id: 'cut-a',
              order: 0,
              cutNumber: 'C-1',
              picture: 'フェンス越しロング、PAN右',
              action: '少女が振り向く',
              dialogue: '「……来たんだ」',
              timeSec: 3,
            },
            {
              id: 'cut-b',
              order: 1,
              cutNumber: 'C-2',
              picture: 'バストアップ',
              action: '目を伏せる',
              dialogue: '',
              timeSec: null,
            },
          ],
        },
      ],
    },
    storyboardSettings: { paperFormat: 'film' },
    storyboardDiscussion: [{ role: 'user', text: 'テンポは？', timestamp: 1 }],
    sourceScriptId: 'script-123',
  };
}

describe('storyboard backup (specs/003 FR-111)', () => {
  it('round-trips JSON losslessly', () => {
    const input = sampleInput();
    const restored = parseStoryboardBackupJson(serializeStoryboardBackupJson(input));
    expect(restored.format).toBe('scenario-lab-storyboard');
    expect(restored.version).toBe(1);
    expect(restored.storyboardContent).toEqual(input.storyboardContent);
    expect(restored.storyboardSettings).toEqual(input.storyboardSettings);
    expect(restored.storyboardDiscussion).toEqual(input.storyboardDiscussion);
    expect(restored.sourceScriptId).toBe('script-123');
    // null timeSec survives exactly.
    expect(restored.storyboardContent.scenes[0]!.cuts[1]!.timeSec).toBeNull();
  });

  it('rejects wrong format/version/shape', () => {
    expect(() => parseStoryboardBackupJson('not json')).toThrow();
    expect(() => parseStoryboardBackupJson('{"format":"scenario-lab-novel","version":1}')).toThrow(
      /絵コンテ/,
    );
    expect(() =>
      parseStoryboardBackupJson(JSON.stringify({ format: 'scenario-lab-storyboard', version: 99 })),
    ).toThrow(/バージョン/);
  });

  it('builds readable Markdown with scene headings and cut tables', () => {
    const md = buildStoryboardMarkdown(sampleInput());
    expect(md).toContain('# PV コンテ');
    expect(md).toContain('## 屋上（夕）');
    expect(md).toContain('| カット | 画面 | 内容 | セリフ／音 | 秒数 |');
    expect(md).toContain('C-1');
    expect(md).toContain('フェンス越しロング、PAN右');
  });
});
