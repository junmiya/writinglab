import { callAi, type AiProvider } from '../lib/aiClient';
import type { StoryboardContent, StoryboardCut, StoryboardScene } from '../types/storyboard';
import { renumberCuts } from '../stores/editorStore';

/**
 * Script → cut-list AI generation (specs/003 FR-110).
 * Feeds a screenplay (柱・ト書き・セリフ) to the AI and parses a strict-JSON
 * scene/cut breakdown. Parsing is defensive: failures throw a readable error
 * and never touch existing data (SC-103).
 */

const GENERATE_SYSTEM_PROMPT = `あなたはプロのアニメ・映像演出家です。与えられた脚本（柱・ト書き・セリフ）を読み、絵コンテ用のシーン／カット割りを設計してください。

出力は必ず次の JSON だけを返してください（コードフェンス・説明文・前置きは一切禁止）:
{"scenes":[{"title":"シーン名（柱に対応）","cuts":[{"picture":"画面: 構図・カメラワークの指定","action":"内容: 芝居・動き","dialogue":"セリフ／音・SE（無ければ空文字）","timeSec":秒数の数値}]}]}

設計方針:
- 柱（○で始まる行）ごとにシーンを分ける。
- ト書き・セリフを 1〜数カットに分解し、画面（サイズ・アングル・カメラの動き）を具体的に指定する。
- timeSec は 1〜10 秒程度で内容に見合った現実的な値にする。
- カット数はシーンの密度に応じて適切に（1シーン 2〜8 カット目安）。`;

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced?.[1] ?? text).trim();
}

/** Extract the first {...} JSON object from a possibly chatty response. */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 応答に JSON が見つかりませんでした');
  }
  return text.slice(start, end + 1);
}

interface RawCut {
  picture?: unknown;
  action?: unknown;
  dialogue?: unknown;
  timeSec?: unknown;
}
interface RawScene {
  title?: unknown;
  cuts?: unknown;
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parse and validate the AI response into a StoryboardContent.
 * Throws with a readable message on any structural problem.
 */
export function parseGeneratedStoryboard(text: string): StoryboardContent {
  let data: unknown;
  try {
    data = JSON.parse(extractJsonObject(stripCodeFences(text)));
  } catch {
    throw new Error('AI 応答の JSON 解析に失敗しました。もう一度お試しください。');
  }
  const scenesRaw = (data as { scenes?: unknown }).scenes;
  if (!Array.isArray(scenesRaw) || scenesRaw.length === 0) {
    throw new Error('AI 応答に scenes 配列がありません');
  }

  const scenes: StoryboardScene[] = scenesRaw.map((s: RawScene, sceneIndex: number) => {
    const cutsRaw = Array.isArray(s.cuts) ? s.cuts : [];
    const cuts: StoryboardCut[] = cutsRaw.map((c: RawCut, cutIndex: number) => ({
      id: genId('cut'),
      order: cutIndex,
      cutNumber: '',
      picture: typeof c.picture === 'string' ? c.picture : '',
      action: typeof c.action === 'string' ? c.action : '',
      dialogue: typeof c.dialogue === 'string' ? c.dialogue : '',
      timeSec: typeof c.timeSec === 'number' && Number.isFinite(c.timeSec) ? c.timeSec : null,
    }));
    return {
      id: genId('scn'),
      title: typeof s.title === 'string' ? s.title : `シーン${sceneIndex + 1}`,
      order: sceneIndex,
      cuts,
    };
  });

  return renumberCuts({ scenes });
}

/** Build the user prompt from the source screenplay. */
export function buildGenerateUserText(input: { synopsis: string; content: string }): string {
  const parts: string[] = [];
  if (input.synopsis.trim()) parts.push(`【あらすじ】\n${input.synopsis}`);
  parts.push(`【脚本】\n${input.content.slice(0, 12000)}`);
  return parts.join('\n\n');
}

/** Generate a storyboard cut list from a screenplay via AI (FR-110). */
export async function generateStoryboardFromScript(
  provider: AiProvider,
  input: { synopsis: string; content: string },
): Promise<StoryboardContent> {
  const response = await callAi(provider, GENERATE_SYSTEM_PROMPT, buildGenerateUserText(input));
  return parseGeneratedStoryboard(response);
}

/** Flatten a storyboard into text for AI advice/dialogue context. */
export function storyboardToText(content: StoryboardContent): string {
  return [...content.scenes]
    .sort((a, b) => a.order - b.order)
    .map((scene, i) => {
      const header = `■ ${scene.title || `シーン${i + 1}`}`;
      const cuts = [...scene.cuts]
        .sort((a, b) => a.order - b.order)
        .map(
          (c) =>
            `${c.cutNumber} [画面]${c.picture} [内容]${c.action} [セリフ/音]${c.dialogue} [秒]${c.timeSec ?? '-'}`,
        )
        .join('\n');
      return [header, cuts].filter(Boolean).join('\n');
    })
    .join('\n\n');
}
