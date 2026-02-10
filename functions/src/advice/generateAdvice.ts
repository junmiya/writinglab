import { buildLogContext, logError, logInfo, logWarn } from '../common/logging';
import { assertRequestSize, createRateLimiter, redactErrorMessage } from '../common/security';
import { generateDualAdvice, type AdviceProvider } from './providerGateway';

interface GenerateAdviceInput {
  correlationId: string;
  ownerId: string;
  documentId: string;
  synopsis: string;
  content: string;
  selectedText?: string;
  panelAProvider: AdviceProvider;
  panelBProvider: AdviceProvider;
  timeoutMs?: number;
}

interface GenerateAdviceResult {
  statusCode: number;
  body:
    | {
        panelA: { provider: AdviceProvider; structureFeedback: string; emotionalFeedback: string };
        panelB: { provider: AdviceProvider; structureFeedback: string; emotionalFeedback: string };
      }
    | {
        error: string;
        correlationId: string;
      };
}

const adviceRateLimiter = createRateLimiter(30, 60_000);

export async function handleGenerateAdvice(
  input: GenerateAdviceInput,
): Promise<GenerateAdviceResult> {
  const startMs = Date.now();
  const context = buildLogContext({
    correlationId: input.correlationId,
    feature: 'advice',
    operation: 'handleGenerateAdvice',
    ownerId: input.ownerId,
    documentId: input.documentId,
  });

  const rate = adviceRateLimiter(input.ownerId);
  if (!rate.allowed) {
    logWarn('ADVICE_RATE_LIMITED', context, {
      retryAfterMs: rate.retryAfterMs,
    });
    return {
      statusCode: 429,
      body: {
        error: 'ADVICE_RATE_LIMITED',
        correlationId: context.correlationId,
      },
    };
  }

  assertRequestSize(input.synopsis, 8_000, 'synopsis');
  assertRequestSize(input.content, 50_000, 'content');
  if (input.selectedText) {
    assertRequestSize(input.selectedText, 10_000, 'selected_text');
  }

  try {
    const request = {
      correlationId: input.correlationId,
      ownerId: input.ownerId,
      documentId: input.documentId,
      synopsis: input.synopsis,
      content: input.content,
      panelA: { provider: input.panelAProvider, preset: 'standard' },
      panelB: { provider: input.panelBProvider, preset: 'standard' },
      timeoutMs: input.timeoutMs ?? 8000,
    };

    const response = await generateDualAdvice(
      input.selectedText !== undefined ? { ...request, selectedText: input.selectedText } : request,
    );

    logInfo('ADVICE_REQUEST_SUCCEEDED', context, {
      panelAProvider: input.panelAProvider,
      panelBProvider: input.panelBProvider,
      elapsedMs: Date.now() - startMs,
    });

    return {
      statusCode: 200,
      body: response,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? redactErrorMessage(error.message)
        : redactErrorMessage(String(error));

    if (message.includes('TIMEOUT')) {
      logWarn('ADVICE_REQUEST_TIMEOUT', context, { error: message });
      return {
        statusCode: 504,
        body: {
          error: 'ADVICE_TIMEOUT',
          correlationId: context.correlationId,
        },
      };
    }

    logError('ADVICE_REQUEST_FAILED', context, { error: message });

    return {
      statusCode: 502,
      body: {
        error: 'ADVICE_PROVIDER_FAILURE',
        correlationId: context.correlationId,
      },
    };
  }
}
