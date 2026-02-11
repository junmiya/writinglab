import type { AdviceProvider } from '../stores/adviceStore';
import { isFunctionsApiConfigured, postFunctionsJson } from './functionsApi';

export interface AdviceFeedback {
  provider: AdviceProvider;
  structureFeedback: string;
  emotionalFeedback: string;
}

export interface AdviceResponse {
  panelA: AdviceFeedback;
  panelB: AdviceFeedback;
}

export interface GenerateAdviceInput {
  documentId: string;
  synopsis: string;
  content: string;
  selectedText?: string;
  panelAProvider: AdviceProvider;
  panelBProvider: AdviceProvider;
  panelAPreset: string;
  panelBPreset: string;
}

function buildMockFeedback(
  provider: AdviceProvider,
  preset: string,
  synopsis: string,
  content: string,
  selectedText?: string,
): AdviceFeedback {
  const scope = selectedText ? 'partial' : 'full';
  const source = (selectedText ?? content).slice(0, 80).replace(/\s+/g, ' ').trim();

  return {
    provider,
    structureFeedback: `${provider}/${preset}/${scope}: 構成の繋がりを確認。対象: ${source || '本文未入力'}`,
    emotionalFeedback: `${provider}/${preset}/${scope}: 感情の動機を補強。あらすじ長: ${synopsis.length}`,
  };
}

function buildMockAdvice(input: GenerateAdviceInput): AdviceResponse {
  return {
    panelA: buildMockFeedback(
      input.panelAProvider,
      input.panelAPreset,
      input.synopsis,
      input.content,
      input.selectedText,
    ),
    panelB: buildMockFeedback(
      input.panelBProvider,
      input.panelBPreset,
      input.synopsis,
      input.content,
      input.selectedText,
    ),
  };
}

export async function generateAdvice(input: GenerateAdviceInput): Promise<AdviceResponse> {
  if (!isFunctionsApiConfigured()) {
    return buildMockAdvice(input);
  }

  return postFunctionsJson<AdviceResponse>('/api/advice/generate', {
    documentId: input.documentId,
    synopsis: input.synopsis,
    content: input.content,
    selectedText: input.selectedText,
    panelAProvider: input.panelAProvider,
    panelBProvider: input.panelBProvider,
  });
}
