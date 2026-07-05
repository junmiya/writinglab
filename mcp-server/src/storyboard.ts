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
}

export interface StoryboardScene {
  id: string;
  title: string;
  order: number;
  cuts: StoryboardCut[];
}

export interface StoryboardContent {
  scenes: StoryboardScene[];
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

export const DEFAULT_IMAGE_STYLE =
  '絵コンテ用のモノクロ鉛筆ラフスケッチ。線画中心、簡潔な陰影、文字・ロゴ・フキダシは描かない。';

/** Compose the image-generation prompt from 構図メモ + カメラ指示 + aspect + style. */
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
