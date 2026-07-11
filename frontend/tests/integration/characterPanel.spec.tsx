/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CharacterPanel } from '../../src/components/editor/CharacterPanel';
import type { StoryboardCharacter } from '../../src/types/storyboard';

const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function baseCharacter(overrides: Partial<StoryboardCharacter> = {}): StoryboardCharacter {
  return { id: 'chr-1', name: '佐藤ミオ', description: '黒髪ボブ、制服、17歳', ...overrides };
}

describe('CharacterPanel (005 / FR-206)', () => {
  it('renders name, description and the studio operation buttons', () => {
    const { getByPlaceholderText, getByText } = render(
      <CharacterPanel
        character={baseCharacter()}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        disableUp
        disableDown
      />,
    );
    expect((getByPlaceholderText(/登場人物名/) as HTMLInputElement).value).toBe('佐藤ミオ');
    expect((getByPlaceholderText(/容姿・特徴/) as HTMLTextAreaElement).value).toContain('黒髪ボブ');
    // Shared studio buttons
    expect(getByText('画像を生成')).toBeTruthy();
    expect(getByText('添付')).toBeTruthy();
    expect(getByText('貼り付け')).toBeTruthy();
    expect(getByText('プロンプト')).toBeTruthy();
  });

  it('the プロンプト button reveals a prompt built from name + description', () => {
    const { getByText, container } = render(
      <CharacterPanel
        character={baseCharacter()}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        disableUp
        disableDown
      />,
    );
    fireEvent.click(getByText('プロンプト'));
    const ta = container.querySelector('textarea[readonly]') as HTMLTextAreaElement | null;
    expect(ta).not.toBeNull();
    expect(ta!.value).toContain('佐藤ミオ');
    expect(ta!.value).toContain('黒髪ボブ');
  });

  it('shows the adopted image when present', () => {
    const character = baseCharacter({
      image: {
        versions: [{ id: 'v1', dataB64: PNG_1x1, mime: 'image/png', prompt: 'p', createdAt: 1 }],
        adoptedId: 'v1',
        chat: [],
      },
    });
    const { container } = render(
      <CharacterPanel
        character={character}
        onPatch={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        disableUp
        disableDown
      />,
    );
    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain(PNG_1x1);
  });
});
