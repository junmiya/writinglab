import type { ChangeEvent, ReactElement } from 'react';

interface VerticalEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function VerticalEditor({ value, onChange }: VerticalEditorProps): ReactElement {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(event.currentTarget.value);
  };

  return (
    <textarea
      className="vertical-editor"
      aria-label="Vertical screenplay editor"
      value={value}
      onChange={handleChange}
      placeholder="ここに脚本本文を入力"
    />
  );
}
