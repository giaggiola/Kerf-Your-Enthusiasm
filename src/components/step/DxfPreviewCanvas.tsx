'use client';

import {
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface DxfLine {
  type: 'line';
  start: [number, number];
  end: [number, number];
  layer?: string;
}

export interface DxfArc {
  type: 'arc';
  center: [number, number];
  radius: number;
  start_angle: number;
  end_angle: number;
  is_full_circle?: boolean;
  start: [number, number];
  end: [number, number];
  layer?: string;
}

export interface DxfPolyline {
  type: 'polyline';
  points: [number, number][];
  layer?: string;
}

export type DxfEdge = DxfLine | DxfArc | DxfPolyline;

interface EdgeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Props {
  edges: DxfEdge[];
  viewBox: string;
  flipAxis: number;
  className?: string;
  overlays?: ReactNode;
}

function angleInArc(angle: number, start: number, end: number): boolean {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  const normalizedStart = ((start % 360) + 360) % 360;
  const normalizedEnd = ((end % 360) + 360) % 360;
  if (normalizedStart <= normalizedEnd) {
    return normalizedStart <= normalizedAngle && normalizedAngle <= normalizedEnd;
  }
  return normalizedAngle >= normalizedStart || normalizedAngle <= normalizedEnd;
}

export function getDxfEdgeBounds(edges: DxfEdge[]): EdgeBounds | null {
  if (!edges.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const expand = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const edge of edges) {
    if (edge.type === 'line') {
      expand(...edge.start);
      expand(...edge.end);
      continue;
    }

    if (edge.type === 'polyline') {
      for (const point of edge.points) expand(...point);
      continue;
    }

    const [cx, cy] = edge.center;
    const radius = edge.radius;
    if (edge.is_full_circle) {
      expand(cx - radius, cy - radius);
      expand(cx + radius, cy + radius);
      continue;
    }

    expand(...edge.start);
    expand(...edge.end);
    for (const [angle, dx, dy] of [
      [0, radius, 0],
      [90, 0, radius],
      [180, -radius, 0],
      [270, 0, -radius],
    ] as const) {
      if (angleInArc(angle, edge.start_angle, edge.end_angle)) {
        expand(cx + dx, cy + dy);
      }
    }
  }

  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function layerStyle(layer?: string): {
  color: string;
  strokeWidth: string;
  priority: number;
} {
  if (layer === 'SHEET_BOUNDARY') {
    return { color: '#94a3b8', strokeWidth: '1.5', priority: 0 };
  }
  if (layer?.startsWith('DEPTH_') || layer?.startsWith('POCKET_')) {
    return { color: '#2563eb', strokeWidth: '0.5', priority: 1 };
  }
  if (!layer || layer === 'PROFILE' || layer === 'OUTSIDE_PROFILE') {
    return { color: '#334155', strokeWidth: '0.65', priority: 2 };
  }
  if (layer === 'HOLES' || layer === 'INTERIOR_OPENINGS') {
    return { color: '#dc2626', strokeWidth: '0.65', priority: 3 };
  }
  return { color: '#94a3b8', strokeWidth: '0.5', priority: 1 };
}

export function DxfPreviewCanvas({
  edges,
  viewBox,
  flipAxis,
  className = '',
  overlays,
}: Props) {
  const paths = useMemo(() => {
    const flip = (y: number) => flipAxis - y;
    const result: {
      d: string;
      color: string;
      strokeWidth: string;
      key: number;
      priority: number;
    }[] = [];

    for (let index = 0; index < edges.length; index += 1) {
      const edge = edges[index];
      const style = layerStyle(edge.layer);
      let path = '';

      if (edge.type === 'line') {
        path = `M ${edge.start[0]} ${flip(edge.start[1])} L ${edge.end[0]} ${flip(edge.end[1])}`;
      } else if (edge.type === 'polyline') {
        if (edge.points.length < 2) continue;
        path = edge.points
          .map(([x, y], pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${x} ${flip(y)}`)
          .join(' ');
      } else if (edge.is_full_circle) {
        path = [
          `M ${edge.center[0] - edge.radius} ${flip(edge.center[1])}`,
          `A ${edge.radius} ${edge.radius} 0 1 0 ${edge.center[0] + edge.radius} ${flip(edge.center[1])}`,
          `A ${edge.radius} ${edge.radius} 0 1 0 ${edge.center[0] - edge.radius} ${flip(edge.center[1])}`,
        ].join(' ');
      } else {
        const [cx, sourceCy] = edge.center;
        const cy = flip(sourceCy);
        const startRadians = (edge.start_angle * Math.PI) / 180;
        const endRadians = (edge.end_angle * Math.PI) / 180;
        const startX = cx + edge.radius * Math.cos(startRadians);
        const startY = cy - edge.radius * Math.sin(startRadians);
        const endX = cx + edge.radius * Math.cos(endRadians);
        const endY = cy - edge.radius * Math.sin(endRadians);
        let sweep = edge.end_angle - edge.start_angle;
        if (sweep <= 0) sweep += 360;
        path = `M ${startX} ${startY} A ${edge.radius} ${edge.radius} 0 ${sweep > 180 ? 1 : 0} 0 ${endX} ${endY}`;
      }

      result.push({ d: path, key: index, ...style });
    }

    return result.sort((a, b) => a.priority - b.priority || a.key - b.key);
  }, [edges, flipAxis]);

  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragging = useRef(false);
  const lastPosition = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    setTransform((previous) => {
      const scale = Math.max(0.1, Math.min(80, previous.scale * factor));
      const ratio = scale / previous.scale;
      return {
        scale,
        tx: mouseX - ratio * (mouseX - previous.tx),
        ty: mouseY - ratio * (mouseY - previous.ty),
      };
    });
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    dragging.current = true;
    lastPosition.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = event.clientX - lastPosition.current.x;
    const dy = event.clientY - lastPosition.current.y;
    lastPosition.current = { x: event.clientX, y: event.clientY };
    setTransform((previous) => ({
      ...previous,
      tx: previous.tx + dx,
      ty: previous.ty + dy,
    }));
  }, []);

  const stopDragging = useCallback(() => {
    dragging.current = false;
  }, []);

  const isTransformed =
    transform.scale !== 1 || transform.tx !== 0 || transform.ty !== 0;

  return (
    <div
      className={`w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing select-none ${className}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerLeave={stopDragging}
    >
      <div
        style={{
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
        }}
      >
        <svg
          viewBox={viewBox}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {paths.map(({ d, color, strokeWidth, key }) => (
            <path
              key={key}
              d={d}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        {isTransformed && (
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 shadow-sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setTransform({ scale: 1, tx: 0, ty: 0 });
            }}
          >
            Reset
          </button>
        )}
        <span className="text-xs text-slate-400 bg-white/80 rounded px-1.5 py-0.5">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {overlays}
    </div>
  );
}
