import { describe, expect, it } from 'vitest';
import { createAdviceState, selectPanelModel, setPanelPreset } from '../../src/stores/adviceStore';

describe('US2 dual advice flow', () => {
  it('allows independent provider selection for each panel', () => {
    const state = createAdviceState();
    const next = selectPanelModel(state, 'A', 'gemini');
    const next2 = selectPanelModel(next, 'B', 'openai');

    expect(next2.panelA.provider).toBe('gemini');
    expect(next2.panelB.provider).toBe('openai');
  });

  it('keeps preset changes scoped to selected panel', () => {
    const state = createAdviceState();
    const next = setPanelPreset(state, 'A', 'story-structure');

    expect(next.panelA.preset).toBe('story-structure');
    expect(next.panelB.preset).toBe('standard');
  });
});
