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
      // Ensure we don't block input events unnecessarily
    },
  });

  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    // Check if we just emitted this value
    if (recentEmittedValues.current.has(value)) {
      // This is an echo of our own change. Ignore it.
      // We can remove it from the set now that we've seen it (to keep set size small)
      // although keeping it is safer for repeat renders. But usually one prop update per change.
      // Let's remove it to keep logic clean.
      // actually, if strict mode calls effect twice... safe to remove?
      // React 18 strict mode off in prod.
      // Let's remove it.
      recentEmittedValues.current.delete(value);
      return;
    }

    // Check if the current editor content matches the prop value (redundant but fast)
    const currentContent = docToText(editor);
    if (value === currentContent) {
      return;
    }

    // Otherwise, it's a true external update (or a stale one we lost track of?)
    // If it's stale (shorter than current but not in set), it might be a race.
    // But usually "not in set" means "External".
    // We apply it.
    editor.commands.setContent(textToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="vertical-editor" />;
  }

  return <EditorContent editor={editor} />;
}
