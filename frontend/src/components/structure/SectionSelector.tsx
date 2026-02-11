import type { ReactElement } from 'react';

import type { StructureSegment } from './StructurePanel';

interface SectionSelectorProps {
  segments: StructureSegment[];
  activeSegmentId?: string;
  onSelect: (segmentId: string) => void;
}

export function SectionSelector({
  segments,
  activeSegmentId,
  onSelect,
}: SectionSelectorProps): ReactElement {
  return (
    <section aria-label="Section selector">
      <h3>執筆開始位置</h3>
      <div className="flex-row">
        {segments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            onClick={() => onSelect(segment.id)}
            aria-pressed={activeSegmentId === segment.id}
          >
            {segment.label}
          </button>
        ))}
      </div>
    </section>
  );
}
