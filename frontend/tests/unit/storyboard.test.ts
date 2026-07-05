import { describe, it, expect } from 'vitest';
import {
  addScene,
  updateScene,
  removeScene,
  moveScene,
  addCut,
  updateCut,
  removeCut,
  moveCut,
  renumberCuts,
  storyboardCutCount,
  storyboardTotalSec,
  formatDuration,
} from '../../src/stores/editorStore';
import { createEmptyStoryboardContent } from '../../src/types/storyboard';

describe('storyboard scene/cut CRUD (specs/003 FR-102/FR-105)', () => {
  it('adds scenes and cuts with global auto cut-numbering C-1, C-2…', () => {
    let sc = createEmptyStoryboardContent();
    sc = addScene(sc, 'S1', 'scn-1');
    sc = addScene(sc, 'S2', 'scn-2');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = addCut(sc, 'scn-1', 'cut-b');
    sc = addCut(sc, 'scn-2', 'cut-c');
    const nums = sc.scenes.flatMap((s) => s.cuts.map((c) => c.cutNumber));
    expect(nums).toEqual(['C-1', 'C-2', 'C-3']);
  });

  it('renumbers across scenes after cut removal and move', () => {
    let sc = createEmptyStoryboardContent();
    sc = addScene(sc, 'S1', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = addCut(sc, 'scn-1', 'cut-b');
    sc = addCut(sc, 'scn-1', 'cut-c');
    sc = removeCut(sc, 'scn-1', 'cut-b');
    expect(sc.scenes[0]!.cuts.map((c) => [c.id, c.cutNumber])).toEqual([
      ['cut-a', 'C-1'],
      ['cut-c', 'C-2'],
    ]);
    sc = moveCut(sc, 'scn-1', 'cut-c', -1);
    expect(sc.scenes[0]!.cuts.map((c) => [c.id, c.cutNumber])).toEqual([
      ['cut-c', 'C-1'],
      ['cut-a', 'C-2'],
    ]);
  });

  it('scene move renumbers cut numbers globally', () => {
    let sc = createEmptyStoryboardContent();
    sc = addScene(sc, 'S1', 'scn-1');
    sc = addScene(sc, 'S2', 'scn-2');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = addCut(sc, 'scn-2', 'cut-b');
    sc = moveScene(sc, 'scn-2', -1);
    const flat = [...sc.scenes]
      .sort((a, b) => a.order - b.order)
      .flatMap((s) => s.cuts.map((c) => [c.id, c.cutNumber]));
    expect(flat).toEqual([
      ['cut-b', 'C-1'],
      ['cut-a', 'C-2'],
    ]);
  });

  it('updates cut fields and keeps manual cutNumber edits until renumber', () => {
    let sc = addScene(createEmptyStoryboardContent(), 'S', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = updateCut(sc, 'scn-1', 'cut-a', {
      cutNumber: 'C-1A',
      picture: '屋上ロング',
      action: '走る',
      dialogue: '「待って」',
      timeSec: 2.5,
    });
    const cut = sc.scenes[0]!.cuts[0]!;
    expect(cut).toMatchObject({ cutNumber: 'C-1A', picture: '屋上ロング', timeSec: 2.5 });
  });

  it('computes totals; null timeSec counts as 0 (FR-105)', () => {
    let sc = addScene(createEmptyStoryboardContent(), 'S', 'scn-1');
    sc = addCut(sc, 'scn-1', 'cut-a');
    sc = addCut(sc, 'scn-1', 'cut-b');
    sc = updateCut(sc, 'scn-1', 'cut-a', { timeSec: 90 });
    // cut-b timeSec stays null
    expect(storyboardCutCount(sc)).toBe(2);
    expect(storyboardTotalSec(sc)).toBe(90);
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('handles empty content and scene removal edge cases', () => {
    let sc = createEmptyStoryboardContent();
    expect(storyboardCutCount(sc)).toBe(0);
    expect(storyboardTotalSec(sc)).toBe(0);
    sc = addScene(sc, 'S1', 'scn-1');
    sc = updateScene(sc, 'scn-1', { title: '改題' });
    expect(sc.scenes[0]!.title).toBe('改題');
    sc = removeScene(sc, 'scn-1');
    expect(sc.scenes).toEqual([]);
    // renumber on empty is a no-op
    expect(renumberCuts(sc).scenes).toEqual([]);
  });
});
