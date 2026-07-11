import type { FrameAspect, StoryboardCut } from '../types/storyboard';
import { describeCamera } from '../types/storyboard';

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

/** Minimal character info used to describe references in a prompt (FR-205). */
export interface CharacterRef {
  name: string;
  description: string;
}

/** One reference image passed to a reference-guided generation (FR-205). */
export interface ReferenceImage {
  b64: string;
  mime?: string;
}

/** Compose the generation prompt from 構図メモ + カメラ指示 + aspect + style + 登場人物 (FR-115/205). */
export function buildImagePrompt(
  cut: Pick<
    StoryboardCut,
    'picture' | 'action' | 'cameraSizeStart' | 'cameraSizeEnd' | 'cameraWork'
  >,
  aspect: FrameAspect,
  style: string = DEFAULT_IMAGE_STYLE,
  characters: CharacterRef[] = [],
): string {
  const camera = describeCamera(cut);
  const named = characters.filter((c) => c.name.trim() || c.description.trim());
  const charLine = named.length
    ? `登場人物: ${named
        .map((c) => (c.description.trim() ? `${c.name}（${c.description.trim()}）` : c.name))
        .join('、')}。参照画像の見た目・服装を保つこと。`
    : '';
  const parts = [
    style,
    `画面アスペクト比 ${aspect.w}:${aspect.h} の1フレーム。`,
    camera ? `カメラ: ${camera}。` : '',
    cut.picture.trim() ? `構図: ${cut.picture.trim()}` : '',
    cut.action.trim() ? `動き・芝居: ${cut.action.trim()}` : '',
    charLine,
  ];
  return parts.filter(Boolean).join('\n');
}

export const DEFAULT_CHARACTER_STYLE =
  'キャラクター設定用の参照イラスト。全身立ち絵、白背景、正面〜やや斜め、中立ポーズ。線画＋簡潔な着彩、余計な文字は描かない。';

/** Compose an image prompt for a character reference sheet (FR-204/205). */
export function buildCharacterPrompt(
  character: { name: string; description: string },
  style: string = DEFAULT_CHARACTER_STYLE,
): string {
  const parts = [
    style,
    character.name.trim() ? `キャラクター名: ${character.name.trim()}` : '',
    character.description.trim() ? `容姿・特徴: ${character.description.trim()}` : '',
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

/**
 * Generate a frame guided by reference images (character sheets, FR-205). Uses
 * the gpt-image-1 edits endpoint, which accepts multiple input images. With no
 * references it falls back to a plain text-to-image generation.
 */
export async function generateWithReferences(
  prompt: string,
  aspect: FrameAspect,
  references: ReferenceImage[],
): Promise<string> {
  if (references.length === 0) return generateImage(prompt, aspect);
  const key = getOpenAiKey();
  if (!key) throw new Error('OpenAI API キーが未設定です（設定から入力してください）');
  const form = new FormData();
  form.append('model', getImageModel());
  references.forEach((ref, i) => {
    form.append('image[]', b64ToBlob(ref.b64, ref.mime ?? 'image/png'), `ref-${i}.png`);
  });
  form.append('prompt', prompt);
  form.append('size', aspectToApiSize(aspect));
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  return readImageResponse(res);
}

function b64ToBlob(b64: string, mime = 'image/png'): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Edit an existing frame image with an instruction (議論→修正ループ, FR-116). */
export async function editImage(
  baseB64: string,
  instruction: string,
  aspect: FrameAspect,
  mime = 'image/png',
): Promise<string> {
  const key = getOpenAiKey();
  if (!key) throw new Error('OpenAI API キーが未設定です（設定から入力してください）');
  const form = new FormData();
  form.append('model', getImageModel());
  form.append('image', b64ToBlob(baseB64, mime), 'frame.png');
  form.append('prompt', instruction);
  form.append('size', aspectToApiSize(aspect));
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  return readImageResponse(res);
}
