export type AdviceProvider = 'openai' | 'gemini' | 'anthropic';
export type PanelId = 'A' | 'B';

export interface AdvicePanelState {
  provider: AdviceProvider;
  preset: string;
  customLabel?: string;
}

export interface AdviceState {
  panelA: AdvicePanelState;
  panelB: AdvicePanelState;
}

export function createAdviceState(): AdviceState {
  return {
    panelA: { provider: 'gemini', preset: 'standard' },
    panelB: { provider: 'openai', preset: 'standard' },
  };
}

function mapPanel(state: AdviceState, panel: PanelId): keyof AdviceState {
  return panel === 'A' ? 'panelA' : 'panelB';
}

export function selectPanelModel(
  state: AdviceState,
  panel: PanelId,
  provider: AdviceProvider,
): AdviceState {
  const key = mapPanel(state, panel);
  return {
    ...state,
    [key]: {
      ...state[key],
      provider,
    },
  };
}

export function setPanelPreset(state: AdviceState, panel: PanelId, preset: string): AdviceState {
  const key = mapPanel(state, panel);
  return {
    ...state,
    [key]: {
      ...state[key],
      preset,
    },
  };
}

export function setPanelLabel(
  state: AdviceState,
  panel: PanelId,
  customLabel: string,
): AdviceState {
  const key = mapPanel(state, panel);
  return {
    ...state,
    [key]: {
      ...state[key],
      customLabel,
    },
  };
}
