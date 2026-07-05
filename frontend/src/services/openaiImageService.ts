import type { FrameAspect, StoryboardCut } from '../types/storyboard';
import { formatCamera } from '../types/storyboard';

/**
 * OpenAI GPT Image client for storyboard frames (specs/003 FR-115/116).
 * BYOK: the user's API key is stored in localStorage only and never leaves the
 * device except to call the OpenAI API directly (SC-108).
 * Model: user requested the "GPT Image 2" generation — the ID below is the
 * latest published one and can be overridden in local settings without a deploy.
 */

const KEY_STORAGE = 'scenariolab.openai.apiKey';
const MODEL_STORAGE = 'scenariolab.openai.imageModel';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';

export function getOpenAiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setOpenAiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage unavailable — key stays session-only */
  }
}

export function getImageModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE) || DEFAULT_IMAGE_MODEL;
  } catch {
    return DEFAULT_IMAGE_MODEL;
  }
}

/** Map the frame aspect to the closest API-supported size (FR-113/FR-115). */
export function aspectToApiSize(aspect: FrameAspect): '1536x1024' | '1024x1536' | '1024x1024' {
  const ratio = aspect.w / aspect.h;
  if (ratio >= 1.3) return '1536x1024';
  if (ratio <= 0.77) return '1024x1536';
  return '1024x1024';
}

export const DEFAULT_IMAGE_STYLE =
  '絵コンテ用のモノクロ鉛筆ラフスケッチ。線画中心、簡潔な陰影、文字・ロゴ・フキダシは描かない。';

/** Compose the generation prompt from 構図メモ + カメラ指示 + aspect + style (FR-148). */
export function buildImagePrompt(
  cut: Pick<
    StoryboardCut,
    'picture' | 'action' | 'cameraSizeStart' | 'cameraSizeEnd' | 'cameraWork'
  >,
  aspect: FrameAspect,
  style: string = DEFAULT_IMAGE_STYLE,
): string {
  const camera = formatCamera(cut);
  const parts = [
    style,
    `画面アスペクト比 ${aspect.w}:${aspect.h} の1フレーム。`,
    camera ? `カメラ: ${camera}。` : '',
    cut.picture.trim() ? `構図: ${cut.picture.trim()}` : '',
    cut.action.trim() ? `動き・芝居: ${cut.action.trim()}` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

interface ImageApiResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

async function readImageResponse(res: Response): Promise<string> {
  const json = (await res.json()) as ImageApiResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? `画像 API エラー (HTTP ${res.status})`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('画像 API の応答に画像データがありません');
  return b64;
}

/** Generate a new frame image. Returns base64 PNG. */
export async function generateImage(prompt: string, aspect: FrameAspect): Promise<string> {
  const key = getOpenAiKey();
  if (!key) throw new Error('OpenAI API キーが未設定です（設定から入力してください）');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: getImageModel(),
      prompt,
      size: aspectToApiSize(aspect),
      n: 1,
    }),
  });
  return readImageResponse(res);
}

function b64ToBlob(b64: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: 'image/png' });
}

/** Edit an existing frame image with an instruction (議論→修正ループ, FR-116). */
export async function editImage(
  baseB64: string,
  instruction: string,
  aspect: FrameAspect,
): Promise<string> {
  const key = getOpenAiKey();
  if (!key) throw new Error('OpenAI API キーが未設定です（設定から入力してください）');
  const form = new FormData();
  form.append('model', getImageModel());
  form.append('image', b64ToBlob(baseB64), 'frame.png');
  form.append('prompt', instruction);
  form.append('size', aspectToApiSize(aspect));
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  return readImageResponse(res);
}
