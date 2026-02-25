/**
 * ドキュメント管理セクションの入力検証テスト
 * - タイトル: 文字入力・スペース
 * - 著者: 文字入力・スペース
 * - あらすじ: 文字入力・スペース・改行・ペースト
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EditorPage } from '../../src/pages/EditorPage';

// Mock Firebase modules to avoid initialization errors in tests
vi.mock('../../src/lib/firebase/config', () => ({
  app: {},
  auth: {},
  db: {},
}));

vi.mock('../../src/lib/firebase/firestoreService', () => ({
  getScript: vi.fn().mockResolvedValue(null),
  updateScript: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: { uid: 'test-user', displayName: 'Test' }, loading: false, logout: vi.fn() }),
}));

function renderEditorPage() {
  return render(
    <MemoryRouter>
      <EditorPage />
    </MemoryRouter>,
  );
}

describe('ドキュメント管理セクション入力検証', () => {
  it('タイトル: 日本語テキストを入力できる', () => {
    renderEditorPage();
    const input = screen.getByPlaceholderText('脚本タイトル');
    fireEvent.change(input, { target: { value: '吾輩は猫である' } });
    expect((input as HTMLInputElement).value).toBe('吾輩は猫である');
  });

  it('タイトル: スペースを含むテキストを入力できる', () => {
    renderEditorPage();
    const input = screen.getByPlaceholderText('脚本タイトル');
    fireEvent.change(input, { target: { value: 'タイトル テスト　全角スペース' } });
    expect((input as HTMLInputElement).value).toBe('タイトル テスト　全角スペース');
  });

  it('著者: 日本語テキストを入力できる', () => {
    renderEditorPage();
    const input = screen.getByPlaceholderText('著者名');
    fireEvent.change(input, { target: { value: '夏目漱石' } });
    expect((input as HTMLInputElement).value).toBe('夏目漱石');
  });

  it('著者: スペースを含むテキストを入力できる', () => {
    renderEditorPage();
    const input = screen.getByPlaceholderText('著者名');
    fireEvent.change(input, { target: { value: '山田 太郎' } });
    expect((input as HTMLInputElement).value).toBe('山田 太郎');
  });

  it('あらすじ: 日本語テキストを入力できる', () => {
    renderEditorPage();
    const textarea = screen.getByPlaceholderText('あらすじを入力...');
    fireEvent.change(textarea, { target: { value: 'ある日突然猫になった男の物語。' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('ある日突然猫になった男の物語。');
  });

  it('あらすじ: スペースを含むテキストを入力できる', () => {
    renderEditorPage();
    const textarea = screen.getByPlaceholderText('あらすじを入力...');
    fireEvent.change(textarea, { target: { value: '第一章　はじまり　第二章 展開' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('第一章　はじまり　第二章 展開');
  });

  it('あらすじ: 改行を含むテキストを入力できる', () => {
    renderEditorPage();
    const textarea = screen.getByPlaceholderText('あらすじを入力...');
    const multiline = '第一幕\n主人公が登場する。\n\n第二幕\n事件が起きる。';
    fireEvent.change(textarea, { target: { value: multiline } });
    expect((textarea as HTMLTextAreaElement).value).toBe(multiline);
  });

  it('あらすじ: ペースト相当の大量テキスト入力ができる', () => {
    renderEditorPage();
    const textarea = screen.getByPlaceholderText('あらすじを入力...');
    const longText =
      '東京の下町に住む青年・太郎は、ある日突然不思議な手紙を受け取る。\n' +
      'それは亡き祖父からの手紙で、古い蔵に隠された秘密について書かれていた。\n' +
      '太郎は幼馴染の花子と共に、祖父の残した謎を解き明かす旅に出る。';
    fireEvent.change(textarea, { target: { value: longText } });
    expect((textarea as HTMLTextAreaElement).value).toBe(longText);
  });

  it('全フィールドに同時に値を保持できる', () => {
    renderEditorPage();
    const title = screen.getByPlaceholderText('脚本タイトル');
    const author = screen.getByPlaceholderText('著者名');
    const synopsis = screen.getByPlaceholderText('あらすじを入力...');

    fireEvent.change(title, { target: { value: 'テスト脚本' } });
    fireEvent.change(author, { target: { value: 'テスト著者' } });
    fireEvent.change(synopsis, { target: { value: 'テストあらすじ\n二行目' } });

    expect((title as HTMLInputElement).value).toBe('テスト脚本');
    expect((author as HTMLInputElement).value).toBe('テスト著者');
    expect((synopsis as HTMLTextAreaElement).value).toBe('テストあらすじ\n二行目');
  });
});
