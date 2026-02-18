import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Placeholder from '@tiptap/extension-placeholder';
import History from '@tiptap/extension-history';

export type { Editor } from '@tiptap/react';

interface VerticalEditorProps {
  value: string;
  onChange: (value: string) => void;
  onEditorReady?: (editor: Editor) => void;
}


function textToDoc(text: string): { type: string; content: object[] } {
  if (!text) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return {
    type: 'doc',
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function docToText(editor: Editor): string {
  const lines: string[] = [];
  editor.state.doc.forEach((node) => {
    lines.push(node.textContent);
  });
  return lines.join('\n');
}

export function VerticalEditor({
  value,
  onChange,
  onEditorReady,
}: VerticalEditorProps): ReactElement {
  // Store a set of values we've recently emitted to avoid loops
  const recentEmittedValues = useRef(new Set<string>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track IME composition state to prevent content overwrites during input
  const composingRef = useRef(false);
  const pendingValueRef = useRef<string | null>(null);

  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      History,
      Placeholder.configure({ placeholder: 'ここに脚本本文を入力' }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: textToDoc(value),
    onUpdate({ editor }) {
      const newText = docToText(editor);
      // We always emit, but track it so we can ignore the echo
      if (!recentEmittedValues.current.has(newText)) {
        recentEmittedValues.current.add(newText);
      }
      onChangeRef.current(newText);
    },
    editorProps: {
      attributes: {
        class: 'vertical-editor',
        'aria-label': 'Vertical screenplay editor',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  // Listen for IME composition events to guard against content overwrites
  useEffect(() => {
    if (!editor) return;

    const dom = editor.view.dom;
    const handleCompositionStart = (): void => {
      composingRef.current = true;
    };

    const handleCompositionEnd = (): void => {
      composingRef.current = false;

      // Apply any value update that was deferred during composition
      const pending = pendingValueRef.current;
      if (pending === null) return;
      pendingValueRef.current = null;

      if (recentEmittedValues.current.has(pending)) {
        recentEmittedValues.current.delete(pending);
        return;
      }

      const currentContent = docToText(editor);
      if (pending === currentContent) return;

      editor.commands.setContent(textToDoc(pending), { emitUpdate: false });
    };

    dom.addEventListener('compositionstart', handleCompositionStart);
    dom.addEventListener('compositionend', handleCompositionEnd);
    return () => {
      dom.removeEventListener('compositionstart', handleCompositionStart);
      dom.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    // During IME composition, defer the update to avoid disrupting input
    if (composingRef.current) {
      pendingValueRef.current = value;
      return;
    }

    if (recentEmittedValues.current.has(value)) {
      recentEmittedValues.current.delete(value);
      return;
    }

    const currentContent = docToText(editor);
    if (value === currentContent) {
      return;
    }

    editor.commands.setContent(textToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="vertical-editor" />;
  }

  return <EditorContent editor={editor} />;
}
