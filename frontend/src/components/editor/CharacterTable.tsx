import type { ReactElement } from 'react';

import { useState } from 'react';

export interface CharacterRow {
  id: string;
  name: string;
  age?: string;
  traits?: string;
  background?: string;
}

interface CharacterTableProps {
  value: CharacterRow[];
  onChange: (characters: CharacterRow[]) => void;
}

function makeId(): string {
  return `ch_${Math.random().toString(36).slice(2, 10)}`;
}

export function CharacterTable({ value, onChange }: CharacterTableProps): ReactElement {
  const [draftName, setDraftName] = useState('');

  const addCharacter = (): void => {
    const name = draftName.trim();
    if (!name) {
      return;
    }

    onChange([...value, { id: makeId(), name }]);
    setDraftName('');
  };

  const removeCharacter = (id: string): void => {
    onChange(value.filter((character) => character.id !== id));
  };

  return (
    <section aria-label="Character table">
      <h3>登場人物表</h3>
      <div className="flex-row">
        <input
          aria-label="Character name"
          value={draftName}
          onChange={(event) => setDraftName(event.currentTarget.value)}
          placeholder="登場人物名"
        />
        <button type="button" onClick={addCharacter}>
          追加
        </button>
      </div>
      <ul className="character-list">
        {value.map((character) => (
          <li key={character.id}>
            {character.name}
            <button
              type="button"
              className="btn-danger"
              onClick={() => removeCharacter(character.id)}
            >
              削除
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
