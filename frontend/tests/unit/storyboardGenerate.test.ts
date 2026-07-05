import { describe, it, expect } from 'vitest';
import {
  parseGeneratedStoryboard,
  buildGenerateUserText,
  storyboardToText,
} from '../../src/services/storyboardGenerateService';
import {
  STORYBOARD_ADVICE_EXPERTS,
  STORYBOARD_DISCUSSION_A,
  STORYBOARD_DISCUSSION_B,
} from '../../src/modes/storyboard/prompts';
import { addScene, addCut, updateCut } from '../../src/stores/editorStore';
import { createEmptyStoryboardContent } from '../../src/types/storyboard';

describe('storyboard generation parsing (FR-110 / SC-103)', () => {
  const valid = JSON.stringify({
    scenes: [
      {
        title: '学校・屋上（夕）',
        cuts: [
          { picture: 'フェンス越しロング', action: '少女が立つ', dialogue: '', timeSec: 3 },
          { picture: 'バストアップ', action: '振り向く', dialogue: '「来たんだ」', timeSec: 2 },
        ],
      },
      { title: '廊下', cuts: [{ picture: 'PAN右', action: '走る', dialogue: '', timeSec: 1.5 }] },
    ],
  });

  it('parses valid JSON into a renumbered StoryboardContent', () => {
    const sc = parseGeneratedStoryboard(valid);
    expect(sc.scenes).toHaveLength(2);
    expect(sc.scenes[0]!.cuts.map((c) => c.cutNumber)).toEqual(['C-1', 'C-2']);
    expect(sc.scenes[1]!.cuts[0]!.cutNumber).toBe('C-3');
    expect(sc.scenes[1]!.cuts[0]!.timeSec).toBe(1.5);
  });

  it('strips markdown fences and surrounding chatter', () => {
    const chatty = '以下が結果です。\n```json\n' + valid + '\n```\n以上です。';
    const sc = parseGeneratedStoryboard(chatty);
    expect(sc.scenes).toHaveLength(2);
  });

  it('throws readable errors on garbage without crashing (non-destructive)', () => {
    expect(() => parseGeneratedStoryboard('こんにちは！')).toThrow();
    expect(() => parseGeneratedStoryboard('{"foo": 1}')).toThrow(/scenes/);
    expect(() => parseGeneratedStoryboard('{"scenes": []}')).toThrow();
  });

  it('coerces malformed cut fields to safe defaults', () => {
    const sloppy = JSON.stringify({
      scenes: [{ title: 42, cuts: [{ picture: 1, timeSec: 'fast' }] }],
    });
    const sc = parseGeneratedStoryboard(sloppy);
    const cut = sc.scenes[0]!.cuts[0]!;
    expect(sc.scenes[0]!.title).toBe('シーン1');
    expect(cut.picture).toBe('');
    expect(cut.timeSec).toBeNull();
  });

  it('builds user text from synopsis + script content', () => {
    const text = buildGenerateUserText({ synopsis: 'あら', content: '○公園（昼）' });
    expect(text).toContain('【あらすじ】');
    expect(text).toContain('○公園（昼）');
  });

  it('flattens a storyboard to text for AI context', () => {
    let sc = addScene(createEmptyStoryboardContent(), '屋上', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = updateCut(sc, 'scn-1', 'cut-a', { picture: 'ロング', timeSec: 3 });
    const text = storyboardToText(sc);
    expect(text).toContain('■ 屋上');
    expect(text).toContain('C-1');
    expect(text).toContain('[画面]ロング');
  });
});

describe('storyboard prompt isolation (SC-007 pattern)', () => {
  it('storyboard prompts avoid novel/screenplay-only vocabulary', () => {
    const all = [
      ...STORYBOARD_ADVICE_EXPERTS.map((e) => e.system),
      STORYBOARD_DISCUSSION_A.system,
      STORYBOARD_DISCUSSION_B.system,
    ].join('\n');
    expect(all).toContain('絵コンテ');
    expect(all).not.toContain('地の文');
    expect(all).not.toContain('章タイトル');
    expect(all).not.toContain('ペラ');
  });
});
