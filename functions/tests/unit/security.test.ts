import { describe, expect, it } from 'vitest';
import { createRateLimiter, redactErrorMessage } from '../../src/common/security';

describe('security utilities', () => {
  it('enforces rate limiting per key', () => {
    const limiter = createRateLimiter(2, 1_000);
    const first = limiter('user1');
    const second = limiter('user1');
    const third = limiter('user1');

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it('redacts sensitive key names from error output', () => {
    const redacted = redactErrorMessage('missing OPENAI_API_KEY and Bearer supersecrettoken');
    expect(redacted).not.toContain('OPENAI_API_KEY');
    expect(redacted).toContain('[REDACTED]');
  });
});
