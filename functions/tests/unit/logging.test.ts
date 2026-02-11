import { describe, expect, it } from 'vitest';
import { buildLogContext, createCorrelationId } from '../../src/common/logging';

describe('logging utilities', () => {
  it('creates UUID correlation ids', () => {
    const id = createCorrelationId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(20);
  });

  it('builds context with fallback correlation id', () => {
    const context = buildLogContext({ feature: 'advice' });
    expect(context.feature).toBe('advice');
    expect(context.correlationId).toBeTruthy();
  });
});
