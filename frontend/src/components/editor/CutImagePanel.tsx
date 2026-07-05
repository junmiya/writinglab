import { useRef, useState, type ReactElement } from 'react';
import { Wand2, MessageSquare, Trash2, Check, Paperclip, Clipboard } from 'lucide-react';
import type { CutImage, FrameAspect, StoryboardCut } from '../../types/storyboard';
import {
  buildImagePrompt,
  generateImage,
  editImage,
  getOpenAiKey,
} from '../../services/openaiImageService';

/** Convert an image Blob/File to base64 (without the data: prefix). */
async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

interface CutImagePanelProps {
  cut: StoryboardCut;
  aspect: FrameAspect;
  /** Patch the cut (picture text or image state). */
  onPatch: (patch: Partial<Pick<StoryboardCut, 'picture' | 'image'>>) => void;
}

function genId(): string {
  return `img-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)}`;
}

function emptyImage(): CutImage {
  return { versions: [], chat: [] };
}

/**
 * Per-cut frame block (specs/003 FR-115/116): shows the adopted generated image
 * (letterboxed to the frame aspect) or the 構図メモ textarea; below it, generate /
 * discussion-edit loop with version history. Failures never touch the adopted
 * image or cut data (SC-108).
 */
export function CutImagePanel({ cut, aspect, onPatch }: CutImagePanelProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attachRef = useRef<HTMLInputElement | null>(null);

  const image = cut.image ?? emptyImage();
  const adopted = image.versions.find((v) => v.id === image.adoptedId) ?? null;
  const hasKey = getOpenAiKey().length > 0;

  const pushVersion = (b64: string, prompt: string, userText: string, mime = 'image/png'): void => {
    const version = { id: genId(), dataB64: b64, mime, prompt, createdAt: Date.now() };
    const next: CutImage = {
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
    };
    onPatch({ image: next });
  };

  const onGenerate = async (): Promise<void> => {
    setBusy(true);
    setMessage('');
    try {
      const prompt = buildImagePrompt(cut, aspect);
      const b64 = await generateImage(prompt, aspect);
      pushVersion(b64, prompt, '（初回生成）');
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
      const b64 = await editImage(
        adopted.dataB64,
        instruction,
        aspect,
        adopted.mime ?? 'image/png',
      );
      pushVersion(b64, instruction, instruction);
      setFeedback('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  // ── 添付（ChatGPT 等の定額プランで生成した画像の取り込み口, FR-119） ──

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

  const adoptVersion = (id: string): void => {
    onPatch({ image: { ...image, adoptedId: id } });
  };

  const removeVersion = (id: string): void => {
    const versions = image.versions.filter((v) => v.id !== id);
    const adoptedId = image.adoptedId === id ? versions[versions.length - 1]?.id : image.adoptedId;
    onPatch({
      image: {
        ...image,
        versions,
        ...(adoptedId !== undefined ? { adoptedId } : {}),
      },
    });
  };

  return (
    <div>
      {/* 絵枠（アスペクト準拠） */}
      <div
        style={{
          aspectRatio: `${aspect.w} / ${aspect.h}`,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          backgroundColor: adopted ? '#111' : 'var(--color-bg-secondary, #f8fafc)',
          display: 'flex',
        }}
      >
        {adopted ? (
          <img
            src={`data:${adopted.mime ?? 'image/png'};base64,${adopted.dataB64}`}
            alt={cut.cutNumber}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <textarea
            value={cut.picture}
            onChange={(e) => onPatch({ picture: e.currentTarget.value })}
            placeholder="構図・カメラの字コンテ（例: フェンス越しロング、夕日逆光）"
            style={{
              flex: 1,
              border: 'none',
              resize: 'none',
              padding: '0.5rem',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              backgroundColor: 'transparent',
            }}
          />
        )}
      </div>

      {/* 操作行 */}
      <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={busy || !hasKey}
          title={hasKey ? 'AI で画像を生成' : '設定で OpenAI API キーを入力してください'}
          style={{
            fontSize: '0.6875rem',
            padding: '0.2rem 0.5rem',
            display: 'flex',
            gap: '0.25rem',
          }}
        >
          <Wand2 size={12} /> {busy ? '生成中...' : adopted ? '再生成' : '画像を生成'}
        </button>
        <button
          type="button"
          onClick={() => attachRef.current?.click()}
          disabled={busy}
          title="画像ファイルを添付（ChatGPT 等で生成した絵の取り込み。API キー不要）"
          style={{
            fontSize: '0.6875rem',
            padding: '0.2rem 0.5rem',
            display: 'flex',
            gap: '0.25rem',
          }}
        >
          <Paperclip size={12} /> 添付
        </button>
        <button
          type="button"
          onClick={() => void onPasteFromClipboard()}
          disabled={busy}
          title="クリップボードの画像を貼り付け（API キー不要）"
          style={{
            fontSize: '0.6875rem',
            padding: '0.2rem 0.5rem',
            display: 'flex',
            gap: '0.25rem',
          }}
        >
          <Clipboard size={12} /> 貼り付け
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
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              fontSize: '0.6875rem',
              padding: '0.2rem 0.5rem',
              display: 'flex',
              gap: '0.25rem',
            }}
          >
            <MessageSquare size={12} /> 議論・修正（{image.versions.length}版）
          </button>
        )}
        {!hasKey && (
          <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>キー未設定</span>
        )}
      </div>
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

      {/* 議論・修正パネル */}
      {open && image.versions.length > 0 && (
        <div
          style={{
            marginTop: '0.375rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem',
          }}
        >
          {/* バージョン履歴 */}
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
                    onClick={() => adoptVersion(v.id)}
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

          {/* フィードバック → 修正 */}
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
