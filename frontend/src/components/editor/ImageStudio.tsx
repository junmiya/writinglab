import { useRef, useState, type ReactElement } from 'react';
import {
  Wand2,
  MessageSquare,
  Trash2,
  Check,
  Paperclip,
  Clipboard,
  FileText,
  Copy,
} from 'lucide-react';
import type { CutImage, CutImageVersion, FrameAspect } from '../../types/storyboard';

/** Convert an image Blob/File to base64 (without the data: prefix). */
export async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function emptyImage(): CutImage {
  return { versions: [], chat: [] };
}

export function adoptedVersion(image: CutImage | undefined): CutImageVersion | null {
  if (!image) return null;
  return image.versions.find((v) => v.id === image.adoptedId) ?? null;
}

function genId(): string {
  return `img-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)}`;
}

interface ImageStudioControlsProps {
  image: CutImage;
  onChange: (image: CutImage) => void;
  /** Build the current generation prompt (for the copy/generate button). */
  buildPrompt: () => string;
  /** Generate a fresh image from a prompt (may use reference images). */
  generate: (prompt: string) => Promise<string>;
  /** Edit the adopted image with an instruction. */
  edit: (baseB64: string, instruction: string, mime: string) => Promise<string>;
  /** Frame aspect for version thumbnails. */
  aspect: FrameAspect;
  /** Whether BYOK generation is available (OpenAI key set). */
  canGenerate: boolean;
}

/**
 * Shared image studio (specs/003 FR-115/116/119, 005 FR-202): operation row
 * (generate / attach / paste / prompt), version history with adopt/revert/delete,
 * and the discussion→edit loop. Reused by cut frames and character sheets.
 * Failures never touch the adopted image or the underlying data (SC-108).
 */
export function ImageStudioControls({
  image,
  onChange,
  buildPrompt,
  generate,
  edit,
  aspect,
  canGenerate,
}: ImageStudioControlsProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attachRef = useRef<HTMLInputElement | null>(null);

  const adopted = adoptedVersion(image);

  const pushVersion = (b64: string, prompt: string, userText: string, mime = 'image/png'): void => {
    const version = { id: genId(), dataB64: b64, mime, prompt, createdAt: Date.now() };
    onChange({
      versions: [...image.versions, version],
      adoptedId: version.id,
      chat: [
        ...image.chat,
        { role: 'user', text: userText, timestamp: Date.now() },
        {
          role: 'ai',
          text: '新しいバージョンを生成しました',
          versionId: version.id,
          timestamp: Date.now(),
        },
      ],
    });
  };

  const onGenerate = async (): Promise<void> => {
    setBusy(true);
    setMessage('');
    try {
      const prompt = buildPrompt();
      const b64 = await generate(prompt);
      pushVersion(b64, prompt, '（生成）');
      setOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onEdit = async (): Promise<void> => {
    const instruction = feedback.trim();
    if (!instruction || !adopted) return;
    setBusy(true);
    setMessage('');
    try {
      const b64 = await edit(adopted.dataB64, instruction, adopted.mime ?? 'image/png');
      pushVersion(b64, instruction, instruction);
      setFeedback('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const attachBlob = async (blob: Blob, label: string): Promise<void> => {
    if (!blob.type.startsWith('image/')) {
      setMessage('画像ファイルを選択してください');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const b64 = await blobToB64(blob);
      pushVersion(b64, `添付: ${label}`, `（画像を添付: ${label}）`, blob.type);
      setOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onPasteFromClipboard = async (): Promise<void> => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          await attachBlob(await item.getType(type), 'クリップボード');
          return;
        }
      }
      setMessage('クリップボードに画像がありません');
    } catch {
      setMessage('クリップボードを読み取れませんでした（ブラウザの許可が必要です）');
    }
  };

  const copyPrompt = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setMessage('プロンプトをコピーしました。外部で生成→画像をコピー→「貼り付け」で取り込めます');
    } catch {
      setMessage('コピーできませんでした。下のテキストを選択してコピーしてください');
    }
  };

  const adopt = (id: string): void => onChange({ ...image, adoptedId: id });

  const removeVersion = (id: string): void => {
    const versions = image.versions.filter((v) => v.id !== id);
    const adoptedId = image.adoptedId === id ? versions[versions.length - 1]?.id : image.adoptedId;
    onChange({ ...image, versions, ...(adoptedId !== undefined ? { adoptedId } : {}) });
  };

  const btn: React.CSSProperties = {
    fontSize: '0.6875rem',
    padding: '0.2rem 0.5rem',
    display: 'flex',
    gap: '0.25rem',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '0.375rem',
          marginTop: '0.25rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={busy || !canGenerate}
          title={canGenerate ? 'AI で画像を生成' : '設定で OpenAI API キーを入力してください'}
          style={btn}
        >
          <Wand2 size={12} /> {busy ? '生成中...' : adopted ? '再生成' : '画像を生成'}
        </button>
        <button
          type="button"
          onClick={() => attachRef.current?.click()}
          disabled={busy}
          title="画像ファイルを添付（外部で生成した絵の取り込み。API キー不要）"
          style={btn}
        >
          <Paperclip size={12} /> 添付
        </button>
        <button
          type="button"
          onClick={() => void onPasteFromClipboard()}
          disabled={busy}
          title="クリップボードの画像を貼り付け（API キー不要）"
          style={btn}
        >
          <Clipboard size={12} /> 貼り付け
        </button>
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          title="プロンプトを表示・コピー（外部の定額プランで生成する用）"
          style={btn}
        >
          <FileText size={12} /> プロンプト
        </button>
        <input
          ref={attachRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void attachBlob(file, file.name);
            e.currentTarget.value = '';
          }}
        />
        {image.versions.length > 0 && (
          <button type="button" onClick={() => setOpen((v) => !v)} style={btn}>
            <MessageSquare size={12} /> 履歴・修正（{image.versions.length}版）
          </button>
        )}
        {!canGenerate && (
          <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>キー未設定</span>
        )}
      </div>

      {showPrompt && (
        <div
          style={{
            marginTop: '0.375rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem',
          }}
        >
          <textarea
            readOnly
            value={buildPrompt()}
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: '100%',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              padding: '0.375rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              resize: 'vertical',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
            }}
          />
          <div
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}
          >
            <button type="button" onClick={() => void copyPrompt()} style={btn}>
              <Copy size={12} /> コピー
            </button>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>
              外部で生成→画像をコピー→「貼り付け」で取り込み
            </span>
          </div>
        </div>
      )}

      {message && (
        <p
          style={{
            fontSize: '0.6875rem',
            color: 'var(--color-error, #dc2626)',
            margin: '0.25rem 0 0',
          }}
        >
          {message}
        </p>
      )}

      {open && image.versions.length > 0 && (
        <div
          style={{
            marginTop: '0.375rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem',
          }}
        >
          <div
            style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}
          >
            {image.versions.map((v, i) => {
              const isAdopted = v.id === image.adoptedId;
              return (
                <div key={v.id} style={{ position: 'relative' }}>
                  <img
                    src={`data:${v.mime ?? 'image/png'};base64,${v.dataB64}`}
                    alt={`v${i + 1}`}
                    onClick={() => adopt(v.id)}
                    title={v.prompt}
                    style={{
                      width: 72,
                      aspectRatio: `${aspect.w} / ${aspect.h}`,
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      border: isAdopted
                        ? '2px solid var(--color-primary, #2563eb)'
                        : '1px solid var(--color-border)',
                    }}
                  />
                  {isAdopted && (
                    <Check
                      size={12}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        color: 'var(--color-primary, #2563eb)',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeVersion(v.id)}
                    title="この版を削除"
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      padding: '0.1rem',
                      fontSize: 0,
                      color: 'var(--color-danger, #dc2626)',
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.currentTarget.value)}
            placeholder="修正指示（例: もっとローアングルに／人物を左に寄せて）"
            rows={2}
            style={{
              width: '100%',
              fontSize: '0.75rem',
              padding: '0.375rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => void onEdit()}
            disabled={busy || !feedback.trim() || !adopted}
            style={{ fontSize: '0.6875rem', padding: '0.25rem 0.625rem', marginTop: '0.25rem' }}
          >
            {busy ? '修正中...' : '修正して新バージョン'}
          </button>
        </div>
      )}
    </div>
  );
}
