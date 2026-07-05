/**
 * Storyboard-mode data structures (specs/003-add-storyboard-mode, Session 4).
 * Body is a 2-level hierarchy: scene > cut. Stored nested inside the script document.
 * The picture column is a text description (字コンテ); per-cut generated images
 * (FR-115/116) live in CutImage and are NOT persisted to Firestore (FR-117) —
 * they travel via JSON backup (base64) or local files in the app build.
 */

// ── カメラ指示（FR-114） ──

/** Shot size codes. Transition start→end expresses e.g. WS→MS (寄り/引き). */
export type CameraSize = 'ELS' | 'LS' | 'FS' | 'KS' | 'WS' | 'MS' | 'BS' | 'CU' | 'ECU';

export const CAMERA_SIZE_OPTIONS: Array<{ value: CameraSize; label: string }> = [
  { value: 'ELS', label: 'ELS（大ロング）' },
  { value: 'LS', label: 'LS（ロング）' },
  { value: 'FS', label: 'FS（フル）' },
  { value: 'KS', label: 'KS（ニー）' },
  { value: 'WS', label: 'WS（ウエスト）' },
  { value: 'MS', label: 'MS（ミディアム）' },
  { value: 'BS', label: 'BS（バスト）' },
  { value: 'CU', label: 'CU（アップ）' },
  { value: 'ECU', label: 'ECU（ドアップ）' },
];

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

export const CAMERA_WORK_OPTIONS: Array<{ value: CameraWork; label: string }> = [
  { value: 'FIX', label: 'FIX' },
  { value: 'PAN_L', label: 'PAN 左' },
  { value: 'PAN_R', label: 'PAN 右' },
  { value: 'TILT_UP', label: 'TILT UP' },
  { value: 'TILT_DOWN', label: 'TILT DOWN' },
  { value: 'TU', label: 'T.U（トラックアップ）' },
  { value: 'TB', label: 'T.B（トラックバック）' },
  { value: 'ZOOM_IN', label: 'ZOOM IN' },
  { value: 'ZOOM_OUT', label: 'ZOOM OUT' },
  { value: 'FOLLOW', label: 'FOLLOW' },
  { value: 'HANDHELD', label: '手持ち' },
  { value: 'OTHER', label: 'その他' },
];

/** Human-readable camera label, e.g. "WS→MS / T.U". Empty string when nothing set. */
export function formatCamera(cut: {
  cameraSizeStart?: CameraSize | undefined;
  cameraSizeEnd?: CameraSize | undefined;
  cameraWork?: CameraWork | undefined;
}): string {
  const size = cut.cameraSizeStart
    ? cut.cameraSizeEnd && cut.cameraSizeEnd !== cut.cameraSizeStart
      ? `${cut.cameraSizeStart}→${cut.cameraSizeEnd}`
      : cut.cameraSizeStart
    : '';
  const work = cut.cameraWork
    ? (CAMERA_WORK_OPTIONS.find((o) => o.value === cut.cameraWork)?.label ?? cut.cameraWork)
    : '';
  return [size, work].filter(Boolean).join(' / ');
}

// ── 画像（FR-115/116/117） ──

export interface CutImageVersion {
  id: string;
  /** Base64 PNG (web). The app build may swap this for a local file path. */
  dataB64: string;
  /** Prompt or edit instruction that produced this version. */
  prompt: string;
  createdAt: number;
}

export interface CutImageMessage {
  role: 'user' | 'ai';
  text: string;
  /** Version created by this exchange, if any. */
  versionId?: string;
  timestamp: number;
}

/** Per-cut generated image state. NOT persisted to Firestore (FR-117). */
export interface CutImage {
  versions: CutImageVersion[];
  adoptedId?: string;
  chat: CutImageMessage[];
}

// ── カット・シーン ──

/** One cut (frame) in a scene. */
export interface StoryboardCut {
  id: string;
  order: number;
  /** Display cut number like "C-1". Auto-numbered on add/move/remove but editable. */
  cutNumber: string;
  /** 画面: composition described as text (字コンテ). Shown inside the frame. */
  picture: string;
  /** 内容: action, acting, direction notes. */
  action: string;
  /** セリフ / 音・SE. */
  dialogue: string;
  /** 秒数. null = 未入力 (treated as 0 in totals). */
  timeSec: number | null;
  // ── Session 4 (optional; older cuts simply omit them). `| undefined` allows
  // explicit clearing via updateCut, which strips undefined keys before merge. ──
  cameraSizeStart?: CameraSize | undefined;
  cameraSizeEnd?: CameraSize | undefined;
  cameraWork?: CameraWork | undefined;
  image?: CutImage | undefined;
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

// ── 設定（FR-104/FR-113） ──

/** Frame aspect ratio. Presets 16:9 / 2.35:1 plus custom w:h (FR-113). */
export interface FrameAspect {
  preset: '16:9' | '2.35:1' | 'custom';
  w: number;
  h: number;
}

export const FRAME_ASPECT_PRESETS: Record<'16:9' | '2.35:1', FrameAspect> = {
  '16:9': { preset: '16:9', w: 16, h: 9 },
  '2.35:1': { preset: '2.35:1', w: 2.35, h: 1 },
};

/** Paper preset: anime = row sheet; film = frame-first layout. */
export interface StoryboardSettings {
  paperFormat: 'anime' | 'film';
  /** Optional for pre-Session-4 data; resolve via resolveFrameAspect (16:9 fallback). */
  frameAspect?: FrameAspect;
}

/** Normalize a possibly-missing/invalid frameAspect. Fallback 16:9 (FR-113). */
export function resolveFrameAspect(aspect: FrameAspect | undefined | null): FrameAspect {
  if (!aspect || !Number.isFinite(aspect.w) || !Number.isFinite(aspect.h)) {
    return FRAME_ASPECT_PRESETS['16:9'];
  }
  if (aspect.w <= 0 || aspect.h <= 0) return FRAME_ASPECT_PRESETS['16:9'];
  return aspect;
}

export const DEFAULT_STORYBOARD_SETTINGS: StoryboardSettings = {
  paperFormat: 'anime',
  frameAspect: FRAME_ASPECT_PRESETS['16:9'],
};

export function createEmptyStoryboardContent(): StoryboardContent {
  return { scenes: [] };
}
