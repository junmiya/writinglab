import type { CSSProperties, ChangeEvent, ReactElement } from 'react';

interface VerticalEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const editorStyle: CSSProperties = {
  width: '100%',
  minHeight: '420px',
  writingMode: 'vertical-rl',
  textOrientation: 'upright',
  overflowX: 'auto',
  lineHeight: '1.8',
  padding: '16px',
  border: '1px solid #c4c8d0',
  borderRadius: '8px',
};

export function VerticalEditor({ value, onChange }: VerticalEditorProps): ReactElement {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(event.currentTarget.value);
  };

  return (
    <textarea
      aria-label="Vertical screenplay editor"
      style={editorStyle}
      value={value}
      onChange={handleChange}
      placeholder="ここに脚本本文を入力"
    />
  );
}
