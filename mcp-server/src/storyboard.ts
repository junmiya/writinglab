/**
 * Minimal storyboard domain logic, mirrored from the frontend
 * (`frontend/src/types/storyboard.ts` + `services/openaiImageService.ts`).
 *
 * Kept as an independent copy so the MCP server has no build-time coupling to
 * the Vite/ESM frontend. These are small pure functions with matching unit
 * behaviour; keep them in sync if the frontend formulas change.
 */

export type CameraSize = 'ELS' | 'LS' | 'FS' | 'KS' | 'WS' | 'MS' | 'BS' | 'CU' | 'ECU';

export type CameraWork =
  | 'FIX'
  | 'PAN_L'
  | 'PAN_R'
  | 'TILT_UP'
  | 'TILT_DOWN'
  | 'TU'
  | 'TB'
  | 'ZOOM_IN'
  | 'ZOOM_OUT'
  | 'FOLLOW'
  | 'HANDHELD'
  | 'OTHER';

const CAMERA_WORK_LABELS: Record<CameraWork, string> = {
  FIX: 'FIX',
  PAN_L: 'PAN 左',
  PAN_R: 'PAN 右',
  TILT_UP: 'TILT UP',
  TILT_DOWN: 'TILT DOWN',
  TU: 'T.U（トラックアップ）',
  TB: 'T.B（トラックバック）',
  ZOOM_IN: 'ZOOM IN',
  ZOOM_OUT: 'ZOOM OUT',
  FOLLOW: 'FOLLOW',
  HANDHELD: '手持ち',
  OTHER: 'その他',
};

/** Natural-language shot-size descriptions for image-generation prompts. */
const CAMERA_SIZE_DESC: Record<CameraSize, string> = {
  ELS: '大ロング（被写体は小さく、環境・全景を大きく見せる）',
  LS: 'ロングショット（全身と背景が入る）',
  FS: 'フルショット（全身が画面いっぱい）',
  KS: 'ニーショット（膝から上）',
  WS: 'ウエストショット（腰から上）',
  MS: 'ミディアムショット（胸から上）',
  BS: 'バストショット（肩・胸から上）',
  CU: 'クローズアップ（顔・表情中心）',
  ECU: '大クローズアップ（目や口など細部）',
};

/** Natural-language camera-work descriptions for image-generation prompts. */
const CAMERA_WORK_DESC: Record<CameraWork, string> = {
  FIX: 'フィックス（カメラ固定）',
  PAN_L: '左へパン',
  PAN_R: '右へパン',
  TILT_UP: '上へティルト',
  TILT_DOWN: '下へティルト',
  TU: 'トラックアップ（カメラが被写体へ前進）',
  TB: 'トラックバック（カメラが被写体から後退）',
  ZOOM_IN: 'ズームイン',
  ZOOM_OUT: 'ズームアウト',
  FOLLOW: 'フォロー（被写体を追う）',
  HANDHELD: '手持ち（わずかな揺れ）',
  OTHER: '',
};

export interface StoryboardCut {
  id: string;
  order: number;
  cutNumber: string;
  picture: string;
  action: string;
  dialogue: string;
  timeSec: number | null;
  cameraSizeStart?: CameraSize;
  cameraSizeEnd?: CameraSize;
  cameraWork?: CameraWork;
  characterIds?: string[];
}

export interface StoryboardScene {
  id: string;
  title: string;
  order: number;
  cuts: StoryboardCut[];
}

/** Character name + 容姿 (images are stripped from Firestore, so only text). */
export interface StoryboardCharacter {
  id: string;
  name: string;
  description: string;
}

export interface StoryboardContent {
  scenes: StoryboardScene[];
  characters?: StoryboardCharacter[];
}

export interface CharacterRef {
  name: string;
  description: string;
}

export interface FrameAspect {
  preset: '16:9' | '2.35:1' | 'custom';
  w: number;
  h: number;
}

export interface StoryboardSettings {
  paperFormat?: 'anime' | 'film';
  frameAspect?: FrameAspect;
}

export const FRAME_ASPECT_16_9: FrameAspect = { preset: '16:9', w: 16, h: 9 };

/** Normalize a possibly-missing/invalid frameAspect. Fallback 16:9. */
export function resolveFrameAspect(aspect: FrameAspect | undefined | null): FrameAspect {
  if (!aspect || !Number.isFinite(aspect.w) || !Number.isFinite(aspect.h)) return FRAME_ASPECT_16_9;
  if (aspect.w <= 0 || aspect.h <= 0) return FRAME_ASPECT_16_9;
  return aspect;
}

/** Human-readable camera label, e.g. "WS→MS / T.U（トラックアップ）". */
export function formatCamera(cut: {
  cameraSizeStart?: CameraSize;
  cameraSizeEnd?: CameraSize;
  cameraWork?: CameraWork;
}): string {
  const size = cut.cameraSizeStart
    ? cut.cameraSizeEnd && cut.cameraSizeEnd !== cut.cameraSizeStart
      ? `${cut.cameraSizeStart}→${cut.cameraSizeEnd}`
      : cut.cameraSizeStart
    : '';
  const work = cut.cameraWork ? (CAMERA_WORK_LABELS[cut.cameraWork] ?? cut.cameraWork) : '';
  return [size, work].filter(Boolean).join(' / ');
}

/**
 * Descriptive camera direction for a generation prompt. Spells out shot size
 * and camera work in natural language (vs {@link formatCamera}'s terse codes).
 * For a size transition the still is framed at the start size.
 */
export function describeCamera(cut: {
  cameraSizeStart?: CameraSize;
  cameraSizeEnd?: CameraSize;
  cameraWork?: CameraWork;
}): string {
  const startDesc = cut.cameraSizeStart ? CAMERA_SIZE_DESC[cut.cameraSizeStart] : '';
  const endDesc =
    cut.cameraSizeEnd && cut.cameraSizeEnd !== cut.cameraSizeStart
      ? CAMERA_SIZE_DESC[cut.cameraSizeEnd]
      : '';
  const work = cut.cameraWork ? CAMERA_WORK_DESC[cut.cameraWork] : '';
  const parts: string[] = [];
  if (startDesc && endDesc) {
    const move = work ? `${work}で寄り引き` : 'カメラを移動';
    parts.push(
      `ショットサイズは ${startDesc} から ${endDesc} へ（${move}。本フレームは開始サイズで作画）`,
    );
  } else if (startDesc) {
    parts.push(`ショットサイズは ${startDesc}`);
    if (work) parts.push(`カメラワークは ${work}`);
  } else if (work) {
    parts.push(`カメラワークは ${work}`);
  }
  return parts.join('、');
}

export const DEFAULT_IMAGE_STYLE =
  '絵コンテ用のモノクロ鉛筆ラフスケッチ。線画中心、簡潔な陰影、文字・ロゴ・フキダシは描かない。';

/** Compose the image-generation prompt from 構図メモ + カメラ指示 + aspect + style + 登場人物. */
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

/** Total seconds across a storyboard (null timeSec treated as 0). */
export function totalSeconds(content: StoryboardContent): number {
  return content.scenes.reduce(
    (sum, sc) => sum + sc.cuts.reduce((s, c) => s + (c.timeSec ?? 0), 0),
    0,
  );
}

export function countCuts(content: StoryboardContent): number {
  return content.scenes.reduce((sum, sc) => sum + sc.cuts.length, 0);
}
