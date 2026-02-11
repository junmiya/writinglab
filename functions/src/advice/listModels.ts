import type { AdviceProvider } from './providerGateway';

interface AdviceModelDescriptor {
  provider: AdviceProvider;
  label: string;
  enabled: boolean;
}

const PROVIDER_ENV_MAP: Record<AdviceProvider, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

const PROVIDER_LABELS: Record<AdviceProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Anthropic',
};

function hasProviderKey(provider: AdviceProvider): boolean {
  const envKey = PROVIDER_ENV_MAP[provider];
  return typeof process.env[envKey] === 'string' && process.env[envKey]!.trim().length > 0;
}

export async function handleListAdviceModels(): Promise<{
  statusCode: number;
  body: AdviceModelDescriptor[];
}> {
  const providers: AdviceProvider[] = ['gemini', 'openai', 'anthropic'];
  const models = providers.map((provider) => ({
    provider,
    label: PROVIDER_LABELS[provider],
    enabled: hasProviderKey(provider),
  }));

  return {
    statusCode: 200,
    body: models,
  };
}
