import type { ReactElement } from 'react';

export interface StructureSegment {
  id: string;
  label: string;
  ratio: number;
}

interface StructurePanelProps {
  segments: StructureSegment[];
  activeSegmentId?: string;
}

export function StructurePanel({ segments, activeSegmentId }: StructurePanelProps): ReactElement {
  return (
    <section aria-label="Structure panel">
      <h3>構成ガイド</h3>
      <ul>
        {segments.map((segment) => {
          const isActive = segment.id === activeSegmentId;
          return (
            <li key={segment.id} className={`structure-segment${isActive ? ' active' : ''}`}>
              {segment.label} ({Math.round(segment.ratio * 100)}%)
            </li>
          );
        })}
      </ul>
    </section>
  );
}
