'use client';

import { useMemo } from 'react';

import {
  DxfPreviewCanvas,
  getDxfEdgeBounds,
  type DxfEdge,
} from './DxfPreviewCanvas';

interface EdgeData {
  edges: DxfEdge[];
}

export function SvgPreview({ edgeData }: { edgeData: EdgeData }) {
  const viewport = useMemo(() => {
    const bounds = getDxfEdgeBounds(edgeData.edges);
    if (!bounds) {
      return { viewBox: '0 0 100 100', flipAxis: 100 };
    }

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const padding = Math.max(width, height) * 0.04 + 1;
    const x = bounds.minX - padding;
    const y = bounds.minY - padding;
    const paddedWidth = width + padding * 2;
    const paddedHeight = height + padding * 2;

    return {
      viewBox: `${x} ${y} ${paddedWidth} ${paddedHeight}`,
      flipAxis: y * 2 + paddedHeight,
    };
  }, [edgeData.edges]);

  return (
    <DxfPreviewCanvas
      edges={edgeData.edges}
      viewBox={viewport.viewBox}
      flipAxis={viewport.flipAxis}
    />
  );
}
