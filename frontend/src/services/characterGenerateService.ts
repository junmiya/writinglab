import { callAi, type AiProvider } from '../lib/aiClient';
import type { StoryboardCharacter } from '../types/storyboard';

/**
 * Screenplay → character list AI generation (specs/005 FR-204).
 * Reads a screenplay (登場人物表 + 本文) and returns characters with a 容姿
 * description usable as an image prompt. Parsing is defensive: failures throw a
 * readable error and never touch existing data (SC-203).
 */

const GENERATE_SYSTEM_PROMPT = `あなたはキャラクターデザイナー兼脚本分析者です。与えられた脚本（登場人物表・本文）を読み、主要な登場人物を抽出し、それぞれの「作画用の容姿説明」を作ってください。

出力は必ず次の JSON だけを返してください（コードフェンス・説明文・前置きは一切禁止）:
{"characters":[{"name":"登場人物名","description":"容姿・特徴（髪型・髪色・体格・年齢感・服装・雰囲気など、作画に必要な視覚情報を簡潔に）"}]}

方針:
- 脚本に実際に登場する人物のみ。多くても 12 名程度まで、重要度順。
- description は視覚情報中心。性格や心理は必要最小限。台詞から服装/年齢が読める場合は反映。
- 情報が乏しい人物は脚本の文脈から自然に補完してよいが、創作しすぎない。`;

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced?.[1] ?? text).trim();
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 応答に JSON が見つかりませんでした');
  }
  return text.slice(start, end + 1);
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface RawCharacter {
  name?: unknown;
  description?: unknown;
}

/**
 * Parse the AI response into characters (id assigned locally, no image yet).
 * Throws with a readable message on any structural problem (SC-203).
 */
export function parseGeneratedCharacters(text: string): StoryboardCharacter[] {
  let data: unknown;
  try {
    data = JSON.parse(extractJsonObject(stripCodeFences(text)));
  } catch {
    throw new Error('AI 応答の JSON 解析に失敗しました。もう一度お試しください。');
  }
  const raw = (data as { characters?: unknown }).characters;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('AI 応答に characters 配列がありません');
  }
  return raw
    .map((c: RawCharacter) => ({
      id: genId('chr'),
      name: typeof c.name === 'string' ? c.name.trim() : '',
      description: typeof c.description === 'string' ? c.description.trim() : '',
    }))
    .filter((c) => c.name || c.description);
}

export function buildGenerateUserText(input: { characterText?: string; content: string }): string {
  const parts: string[] = [];
  if (input.characterText && input.characterText.trim()) {
    parts.push(`【登場人物表】\n${input.characterText}`);
  }
  parts.push(`【脚本本文】\n${input.content.slice(0, 12000)}`);
  return parts.join('\n\n');
}

/** Generate a character list from a screenplay via AI (FR-204). */
export async function generateCharactersFromScript(
  provider: AiProvider,
  input: { characterText?: string; content: string },
): Promise<StoryboardCharacter[]> {
  const response = await callAi(provider, GENERATE_SYSTEM_PROMPT, buildGenerateUserText(input));
  return parseGeneratedCharacters(response);
}
