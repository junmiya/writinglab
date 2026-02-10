import { buildLogContext, logError, logInfo } from '../common/logging';

export type AdviceProvider = 'openai' | 'gemini' | 'anthropic';

export interface AdvicePanelConfig {
  provider: AdviceProvider;
  preset: string;
}

export interface AdviceRequest {
  correlationId: string;
  ownerId: string;
  documentId: string;
  synopsis: string;
  content: string;
  selectedText?: string;
  panelA: AdvicePanelConfig;
  panelB: AdvicePanelConfig;
  timeoutMs: number;
}

export interface AdvicePanelResponse {
  provider: AdviceProvider;
  structureFeedback: string;
  emotionalFeedback: string;
}

export interface AdviceResponse {
  panelA: AdvicePanelResponse;
  panelB: AdvicePanelResponse;
}

class AdviceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdviceValidationError';
  }
}

const PROVIDER_KEY_MAP: Record<AdviceProvider, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

function assertAdviceRequest(input: AdviceRequest): void {
  if (!input.ownerId || !input.documentId) {
    throw new AdviceValidationError('OWNER_OR_DOCUMENT_MISSING');
  }

  if (!input.synopsis && !input.content) {
    throw new AdviceValidationError('CONTEXT_REQUIRED');
  }

  if (input.timeoutMs < 1000 || input.timeoutMs > 30000) {
    throw new AdviceValidationError('INVALID_TIMEOUT_RANGE');
  }
}

function requireProviderKey(provider: AdviceProvider): string {
  const envKey = PROVIDER_KEY_MAP[provider];
  const value = process.env[envKey];
  if (!value) {
    throw new AdviceValidationError(`PROVIDER_KEY_MISSING:${envKey}`);
  }

  return value;
}

async function simulateProviderCall(
  provider: AdviceProvider,
  synopsis: string,
  content: string,
  selectedText?: string,
): Promise<AdvicePanelResponse> {
  const scope = selectedText ? 'partial' : 'full';
  const source = selectedText ?? content;
  const preview = source.slice(0, 120).replace(/\s+/g, ' ').trim();

  return {
    provider,
    structureFeedback: `[${provider}/${scope}] Consider narrative pacing and transitions. Context: ${preview}`,
    emotionalFeedback: `[${provider}/${scope}] Clarify emotional intent and character motivation. Synopsis length: ${synopsis.length}`,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AdviceValidationError('PROVIDER_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function generateDualAdvice(input: AdviceRequest): Promise<AdviceResponse> {
  assertAdviceRequest(input);

  const context = buildLogContext({
    correlationId: input.correlationId,
    feature: 'advice',
    operation: 'generateDualAdvice',
    ownerId: input.ownerId,
    documentId: input.documentId,
  });

  try {
    // Enforce server-side provider key presence before execution.
    requireProviderKey(input.panelA.provider);
    requireProviderKey(input.panelB.provider);

    const [panelA, panelB] = await Promise.all([
      withTimeout(
        simulateProviderCall(
          input.panelA.provider,
          input.synopsis,
          input.content,
          input.selectedText,
        ),
        input.timeoutMs,
      ),
      withTimeout(
        simulateProviderCall(
          input.panelB.provider,
          input.synopsis,
          input.content,
          input.selectedText,
        ),
        input.timeoutMs,
      ),
    ]);

    logInfo('ADVICE_GENERATED', context, {
      panelAProvider: input.panelA.provider,
      panelBProvider: input.panelB.provider,
      selectedText: Boolean(input.selectedText),
    });

    return { panelA, panelB };
  } catch (error) {
    logError('ADVICE_GENERATION_FAILED', context, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
