import { describe, expect, it } from 'vitest';

import { generateAdvice } from '../../src/services/adviceService';

describe('adviceService', () => {
  it('returns local mock advice when functions API is not configured', async () => {
    const result = await generateAdvice({
      documentId: 'doc-local',
      synopsis: 'short synopsis',
      content: 'content body',
      panelAProvider: 'gemini',
      panelBProvider: 'openai',
      panelAPreset: 'standard',
      panelBPreset: 'standard',
    });

    expect(result.panelA.provider).toBe('gemini');
    expect(result.panelB.provider).toBe('openai');
    expect(result.panelA.structureFeedback).toContain('gemini/standard/full');
    expect(result.panelB.structureFeedback).toContain('openai/standard/full');
  });
});
