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

/** Natural-language descriptions of shot sizes for image-generation prompts. */
export const CAMERA_SIZE_DESC: Record<CameraSize, string> = {
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

/** Natural-language descriptions of camera work for image-generation prompts. */
export const CAMERA_WORK_DESC: Record<CameraWork, string> = {
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

/**
 * Descriptive camera direction for a generation prompt (FR-115). Unlike
 * {@link formatCamera} (terse codes for the UI), this spells out shot size and
 * camera work in natural language a text-to-image model can act on. For a
 * size transition the still is framed at the start size.
 */
export function describeCamera(cut: {
  cameraSizeStart?: CameraSize | undefined;
  cameraSizeEnd?: CameraSize | undefined;
  cameraWork?: CameraWork | undefined;
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

// ── 画像（FR-115/116/117） ──

export interface CutImageVersion {
  id: string;
  /** Base64 image data (web). The app build may swap this for a local file path. */
  dataB64: string;
  /** MIME type. Missing = 'image/png' (generated images). Attachments may be jpeg/webp. */
  mime?: string;
  /** Prompt / edit instruction / attachment note that produced this version. */
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

// ── 登場人物（005 / FR-201） ──

/**
 * A storyboard character with an optional reference image. Reuses {@link CutImage}
 * so name/description drive the same generate/attach/paste/prompt studio as cuts.
 * The image is NOT persisted to Firestore (FR-203) — it travels via JSON backup.
 */
export interface StoryboardCharacter {
  id: string;
  /** 表示名（プロンプトで人物を参照する識別子にもなる）。 */
  name: string;
  /** 容姿・特徴（作画プロンプト生成に使う）。 */
  description: string;
  image?: CutImage | undefined;
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
  /** IDs of characters appearing in this cut, whose images seed generation (FR-205). */
  characterIds?: string[] | undefined;
}

export interface StoryboardScene {
  id: string;
  title: string;
  order: number;
  cuts: StoryboardCut[];
}

export interface StoryboardContent {
  scenes: StoryboardScene[];
  /** Character list with reference images (005 / FR-201). Optional for back-compat. */
  characters?: StoryboardCharacter[];
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
