'use client';

import { useMemo } from 'react';

import {
  DxfPreviewCanvas,
  type DxfEdge,
} from './DxfPreviewCanvas';

export interface SheetPreviewData {
  sheet_width_mm: number;
  sheet_length_mm: number;
  edges: DxfEdge[];
}

export function SheetDxfPreview({ data }: { data: SheetPreviewData }) {
  const viewBox = useMemo(() => {
    const padding = Math.max(data.sheet_width_mm, data.sheet_length_mm) * 0.03;
    return [
      -padding,
      -padding,
      data.sheet_width_mm + padding * 2,
      data.sheet_length_mm + padding * 2,
    ].join(' ');
  }, [data.sheet_length_mm, data.sheet_width_mm]);

  return (
    <DxfPreviewCanvas
      edges={data.edges}
      viewBox={viewBox}
      flipAxis={data.sheet_length_mm}
      className="bg-slate-50"
      overlays={(
        <>
          <div className="absolute top-2 left-2 bg-white/90 border border-slate-200 rounded px-2 py-1.5 text-xs space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-400 inline-block" /> Sheet
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-700 inline-block" /> Profile
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-red-600 inline-block" /> Holes
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Depth
            </div>
          </div>

          <div className="absolute bottom-2 left-2 text-xs text-slate-400 bg-white/70 rounded px-1.5 py-0.5 pointer-events-none">
            Scroll: zoom · Drag: pan
          </div>
        </>
      )}
    />
  );
}
