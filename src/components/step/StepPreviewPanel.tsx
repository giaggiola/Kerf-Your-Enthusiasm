'use client';

import { useState, useEffect, useCallback } from 'react';
import { SvgPreview } from './SvgPreview';
import { StepBody, StepFace } from './StepBodyRow';
import { mmToIn } from '@/lib/unit-utils';
import { UnitSystem } from '@/types';

interface EdgeData {
  edges: unknown[];
  face_dims_mm?: [number, number, number] | null;
}

interface Props {
  sessionId: string;
  body: StepBody;
  units: UnitSystem;
  /** OCC face index forced by a 3D viewer click. If set, jumps to that face. */
  forcedFaceOccIndex?: number;
  onFaceSelected: (faceIndex: number) => void;
  /** Called with [l, w, t] in mm whenever the projected face dimensions change. */
  onFaceDims?: (dims: [number, number, number]) => void;
  /** Called whenever the user explicitly navigates faces (◀/▶), to mark confirmed. */
  onFaceNavigated?: () => void;
}

function fmt(val: number, units: UnitSystem): string {
  const n = units === 'mm' ? val : mmToIn(val);
  return n.toFixed(units === 'mm' ? 1 : 3);
}

export function StepPreviewPanel({
  sessionId,
  body,
  units,
  forcedFaceOccIndex,
  onFaceSelected,
  onFaceDims,
  onFaceNavigated,
}: Props) {
  const planarFaces = body.faces.filter((f) => f.is_planar);
  const topFaceIdx = planarFaces.findIndex((f) => f.is_top_face);
  const [planarIdx, setPlanarIdx] = useState(topFaceIdx >= 0 ? topFaceIdx : 0);
  const [edgeData, setEdgeData] = useState<EdgeData | null>(null);
  const [faceDims, setFaceDims] = useState<[number, number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFace: StepFace | undefined = planarFaces[planarIdx];
  const recommendedFace: StepFace | undefined =
    topFaceIdx >= 0 ? planarFaces[topFaceIdx] : undefined;
  const isLikelyEndFace =
    currentFace !== undefined &&
    recommendedFace !== undefined &&
    currentFace.index !== recommendedFace.index &&
    currentFace.area < recommendedFace.area * 0.25;

  // When 3D viewer forces a face selection, find it in planarFaces and jump to it
  useEffect(() => {
    if (forcedFaceOccIndex === undefined) return;
    const idx = planarFaces.findIndex((f) => f.index === forcedFaceOccIndex);
    if (idx >= 0) setPlanarIdx(idx);
    // If the face isn't planar, don't jump — but the 3D click still updates selection
  }, [forcedFaceOccIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to top face when body changes
  useEffect(() => {
    const top = planarFaces.findIndex((f) => f.is_top_face);
    setPlanarIdx(top >= 0 ? top : 0);
  }, [body.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPreview = useCallback(async () => {
    if (!currentFace) return;
    setLoading(true);
    setError(null);
    setEdgeData(null);
    setFaceDims(null);
    try {
      const res = await fetch(`/api/v1/step/${sessionId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body_index: body.index,
          face_index: currentFace.index,
          face_centroid: currentFace.centroid,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Preview failed (${res.status})`);
      }
      const data = await res.json();
      setEdgeData(data);
      if (data.face_dims_mm) {
        setFaceDims(data.face_dims_mm);
        onFaceDims?.(data.face_dims_mm);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  }, [sessionId, body.index, currentFace, onFaceDims]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (currentFace) onFaceSelected(currentFace.index);
  }, [currentFace, onFaceSelected]);

  const prev = () => { setPlanarIdx((i) => (i - 1 + planarFaces.length) % planarFaces.length); onFaceNavigated?.(); };
  const next = () => { setPlanarIdx((i) => (i + 1) % planarFaces.length); onFaceNavigated?.(); };
  const useRecommendedFace = () => {
    if (topFaceIdx < 0) return;
    setPlanarIdx(topFaceIdx);
    onFaceNavigated?.();
  };

  const dims = faceDims ?? body.bbox_mm;
  const dimLabel = units === 'mm' ? 'mm' : 'in';

  return (
    <div className="flex h-full flex-col">
      {/* SVG preview area */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] bg-[#f3f4f0]">
        {loading && <div className="text-sm text-[var(--muted)]">Projecting face…</div>}
        {!loading && error && (
          <div className="px-4 text-center text-sm text-red-500">{error}</div>
        )}
        {!loading && !error && edgeData && (
          <div className="w-full h-full p-3">
            <SvgPreview edgeData={edgeData as Parameters<typeof SvgPreview>[0]['edgeData']} />
          </div>
        )}
        {!loading && !error && !edgeData && (
          <div className="text-sm text-[var(--muted)]">Select a planar face to preview</div>
        )}
      </div>

      {/* Face nav + info */}
      <div className="mt-3 shrink-0 space-y-3">
        {planarFaces.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--foreground)]">
                Face {planarIdx + 1} <span className="font-normal text-[var(--muted)]">of {planarFaces.length}</span>
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={prev}
                  disabled={planarFaces.length <= 1}
                  aria-label="Previous planar face"
                  title="Previous planar face"
                  className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs hover:bg-black/[0.03] disabled:opacity-40"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={planarFaces.length <= 1}
                  aria-label="Next planar face"
                  title="Next planar face"
                  className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs hover:bg-black/[0.03] disabled:opacity-40"
                >
                  ▶
                </button>
              </div>
            </div>

            {currentFace && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[#f3f4f0] p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Face area</p>
                  <p className="mt-0.5 font-semibold text-[var(--ink)]">{(currentFace.area / 100).toFixed(1)} cm²</p>
                </div>
                {dims && (
                  <div className="rounded-lg bg-[#f3f4f0] p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Part size</p>
                    <p className="mt-0.5 whitespace-nowrap font-semibold text-[var(--ink)]">
                      {fmt(dims[0], units)} × {fmt(dims[1], units)} × {fmt(dims[2], units)} {dimLabel}
                    </p>
                  </div>
                )}
              </div>
            )}

            {isLikelyEndFace && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                <span>This looks like a small end face, not the main cut outline.</span>
                <button
                  type="button"
                  onClick={useRecommendedFace}
                  className="shrink-0 rounded bg-amber-100 px-2 py-1 font-medium hover:bg-amber-200"
                >
                  Use largest face
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-[var(--muted)]">No planar faces on this body</p>
        )}
      </div>
    </div>
  );
}
