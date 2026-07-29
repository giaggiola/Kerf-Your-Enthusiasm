'use client';

import { useState, useCallback, use, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StepSidebar, BodyState } from '@/components/step/StepSidebar';
import { StepPreviewPanel } from '@/components/step/StepPreviewPanel';
import { StepBody } from '@/components/step/StepBodyRow';
import type { BodyMeshData } from '@/components/step/StepViewer3D';
import { mmToIn } from '@/lib/unit-utils';
import { UnitSystem } from '@/types';

const StepViewer3D = dynamic(
  () => import('@/components/step/StepViewer3D').then((m) => m.StepViewer3D),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Loading 3D…</div> }
);

interface UploadResult {
  id: string;
  filename: string;
  sessionId: string;
  selectedBodyIndex: number;
  sortOrder: number;
  bodyState: Array<{
    bodyIndex: number;
    name: string;
    included: boolean;
    confirmed: boolean;
    selectedFaceIndex?: number;
  }>;
  bodies: StepBody[];
}

interface SessionData {
  stepFileId: string;
  sessionId: string;
  filename: string;
  sortOrder: number;
  bodyStates: BodyState[];
  selectedFaceIndices: Record<number, number>;
  /** Projected face dimensions [l, w, t] in mm, keyed by body array index. */
  faceDimsMap: Record<number, [number, number, number]>;
  selectedBodyIdx: number;
}

interface StoredProjectStepFile {
  id: string;
  sessionId: string | null;
  filename: string;
  sortOrder: number;
  selectedBodyIndex: number;
  bodyState: Array<{
    bodyIndex: number;
    name: string;
    included: boolean;
    confirmed: boolean;
    selectedFaceIndex?: number;
  }>;
}

interface ProjectStepWorkspaceResponse {
  name?: string;
  units?: UnitSystem | null;
  stepActiveFileId?: string | null;
  stepFiles?: StoredProjectStepFile[];
}

export default function StepWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Multi-session state ───────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [addingNew, setAddingNew] = useState(false);

  // ── Mesh cache (keyed by sessionId, so switching tabs doesn't re-fetch) ──
  const [meshCache, setMeshCache] = useState<Record<string, BodyMeshData[]>>({});
  const [meshLoading, setMeshLoading] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [projectName, setProjectName] = useState('Project');
  const [projectUnits, setProjectUnits] = useState<UnitSystem>('in');
  const [units, setUnits] = useState<UnitSystem>('in');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [restoring, setRestoring] = useState(true);

  // ── Derived: active session ───────────────────────────────────────────────
  const activeSession = sessions[activeIdx] ?? null;

  const updateActiveSession = useCallback(
    (patch: Partial<SessionData> | ((s: SessionData) => Partial<SessionData>)) => {
      setSessions((prev) =>
        prev.map((s, i) => {
          if (i !== activeIdx) return s;
          const p = typeof patch === 'function' ? patch(s) : patch;
          return { ...s, ...p };
        })
      );
    },
    [activeIdx]
  );

  const fetchSessionBodies = useCallback(async (sessionId: string): Promise<StepBody[]> => {
    const r = await fetch(`/api/v1/step/${sessionId}/bodies`);
    if (!r.ok) throw new Error('session gone');
    const data = await r.json();
    return data.bodies as StepBody[];
  }, []);

  const buildSessionFromBodies = useCallback((seed: StoredProjectStepFile, bodies: StepBody[]): SessionData => {
    const selectedFaceIndices = Object.fromEntries(
      bodies.flatMap((body, bodyArrayIndex) => {
        const stored = seed.bodyState.find((entry) => entry.bodyIndex === body.index);
        return typeof stored?.selectedFaceIndex === 'number'
          ? [[bodyArrayIndex, stored.selectedFaceIndex]]
          : [];
      })
    );

    return {
      stepFileId: seed.id,
      sessionId: seed.sessionId ?? '',
      filename: seed.filename,
      sortOrder: seed.sortOrder ?? 0,
      bodyStates: bodies.map((b) => {
        const stored = seed.bodyState.find((entry) => entry.bodyIndex === b.index);
        return {
          body: b,
          name: stored?.name ?? b.name,
          included: stored?.included ?? true,
          confirmed: stored?.confirmed ?? false,
        };
      }),
      selectedFaceIndices,
      faceDimsMap: {},
      selectedBodyIdx: seed.selectedBodyIndex ?? 0,
    };
  }, []);

  const serializeBodyState = useCallback((sessionData: SessionData) => (
    sessionData.bodyStates.map((bs, bodyArrayIndex) => ({
      bodyIndex: bs.body.index,
      name: bs.name,
      included: bs.included,
      confirmed: bs.confirmed,
      selectedFaceIndex: sessionData.selectedFaceIndices[bodyArrayIndex],
    }))
  ), []);

  const persistWorkspaceToProject = useCallback(async (workspaceSessions: SessionData[], workspaceActiveIdx: number) => {
    await Promise.all(
      workspaceSessions.map((sessionData, index) =>
        fetch(`/api/v1/projects/${id}/step-files/${sessionData.stepFileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedBodyIndex: sessionData.selectedBodyIdx,
            sortOrder: index,
            bodyState: serializeBodyState(sessionData),
          }),
        }).catch(() => null)
      )
    );

    await fetch(`/api/v1/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepActiveFileId: workspaceSessions[workspaceActiveIdx]?.stepFileId ?? null,
      }),
    }).catch(() => null);
  }, [id, serializeBodyState]);

  // ── Restore from the persisted project-backed STEP workspace ─────────────
  useEffect(() => {
    let cancelled = false;

    const restoreWorkspace = async () => {
      setRestoring(true);
      try {
        const response = await fetch(`/api/v1/projects/${id}`);
        if (!response.ok) {
          if (response.status === 404) router.push('/dashboard');
          return;
        }
        const data = await response.json() as ProjectStepWorkspaceResponse;
        if (cancelled) return;

        setProjectName(data.name?.trim() || 'Project');
        const nextUnits = (data.units as UnitSystem | null) ?? 'in';
        setProjectUnits(nextUnits);
        setUnits(nextUnits);

        const restoredSessions: SessionData[] = [];
        for (const seed of [...(data.stepFiles ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
          if (!seed.sessionId) continue;
          try {
            const bodies = await fetchSessionBodies(seed.sessionId);
            restoredSessions.push(buildSessionFromBodies(seed, bodies));
          } catch {
            // Skip missing/expired sessions and keep restoring the rest.
          }
        }

        if (cancelled) return;

        setSessions(restoredSessions);
        if (restoredSessions.length === 0) {
          setActiveIdx(0);
          return;
        }

        const activeStepFileId = data.stepActiveFileId ?? null;
        const restoredActiveIdx = activeStepFileId
          ? restoredSessions.findIndex((sessionData) => sessionData.stepFileId === activeStepFileId)
          : restoredSessions.length - 1;
        setActiveIdx(
          restoredActiveIdx >= 0 && restoredActiveIdx < restoredSessions.length
            ? restoredActiveIdx
            : restoredSessions.length - 1
        );
      } finally {
        if (!cancelled) setRestoring(false);
      }
    };

    void restoreWorkspace();

    return () => {
      cancelled = true;
    };
  }, [buildSessionFromBodies, fetchSessionBodies, id, router]);

  // ── Persist workspace changes back to the project ────────────────────────
  useEffect(() => {
    if (restoring) return;
    const timeout = window.setTimeout(() => {
      void persistWorkspaceToProject(sessions, activeIdx);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [activeIdx, persistWorkspaceToProject, restoring, sessions]);

  // ── Load mesh for active session (cached) ─────────────────────────────────
  useEffect(() => {
    const sid = activeSession?.sessionId;
    if (!sid) return;
    if (meshCache[sid]) return; // already have it
    setMeshLoading(true);
    fetch(`/api/v1/step/${sid}/mesh`)
      .then((r) => r.json())
      .then((data) => setMeshCache((prev) => ({ ...prev, [sid]: data.bodies ?? [] })))
      .catch(console.error)
      .finally(() => setMeshLoading(false));
  }, [activeSession?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload ────────────────────────────────────────────────────────────────
  const uploadSingleFile = useCallback(async (file: File): Promise<SessionData> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/v1/projects/${id}/step-files`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Upload failed (${res.status})`);
    }
    const data: UploadResult = await res.json();
    return {
      stepFileId: data.id,
      sessionId: data.sessionId,
      filename: data.filename,
      sortOrder: data.sortOrder,
      bodyStates: data.bodies.map((b) => {
        const stored = data.bodyState.find((entry) => entry.bodyIndex === b.index);
        return {
          body: b,
          name: stored?.name ?? b.name,
          included: stored?.included ?? true,
          confirmed: stored?.confirmed ?? false,
        };
      }),
      selectedFaceIndices: Object.fromEntries(
        (data.bodyState ?? [])
          .filter((entry) => typeof entry.selectedFaceIndex === 'number')
          .map((entry) => [entry.bodyIndex, entry.selectedFaceIndex as number])
      ),
      faceDimsMap: {},
      selectedBodyIdx: data.selectedBodyIndex ?? 0,
    };
  }, [id]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles = files.filter((file) => file.name.match(/\.(step|stp)$/i));
    const invalidFiles = files.filter((file) => !file.name.match(/\.(step|stp)$/i));

    if (validFiles.length === 0) {
      setUploadError('Files must be .step or .stp');
      return;
    }

    setUploading(true);
    setUploadProgress(null);
    setUploadError(null);
    setAddedCount(null);

    const uploadedSessions: SessionData[] = [];
    const failedUploads: string[] = [];

    try {
      for (const [index, file] of validFiles.entries()) {
        setUploadProgress(
          validFiles.length === 1
            ? `Parsing ${file.name}…`
            : `Parsing ${index + 1} of ${validFiles.length}: ${file.name}…`
        );

        try {
          uploadedSessions.push(await uploadSingleFile(file));
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Upload failed';
          failedUploads.push(`${file.name} (${detail})`);
        }
      }

      if (uploadedSessions.length > 0) {
        setSessions((prev) => {
          const next = [...prev, ...uploadedSessions];
          setActiveIdx(next.length - 1);
          return next;
        });
        setAddingNew(false);
      }

      const issues: string[] = [];
      if (invalidFiles.length > 0) {
        const invalidNames = invalidFiles.map((file) => file.name).join(', ');
        issues.push(`Skipped non-STEP files: ${invalidNames}`);
      }
      if (failedUploads.length > 0) {
        issues.push(`Failed: ${failedUploads.join('; ')}`);
      }

      if (uploadedSessions.length === 0 && issues.length === 0) {
        setUploadError('No files were uploaded');
      } else if (issues.length > 0) {
        setUploadError(issues.join('  '));
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [uploadSingleFile]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void handleFiles(files);
  };
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void handleFiles(files);
    e.target.value = ''; // allow re-selecting same file
  };

  // ── Remove a session tab ──────────────────────────────────────────────────
  const handleRemoveSession = async (idx: number) => {
    const target = sessions[idx];
    if (!target) return;

    try {
      const res = await fetch(`/api/v1/projects/${id}/step-files/${target.stepFileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.detail ?? `Delete failed (${res.status})`);
      }

      setSessions((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        setActiveIdx((prevActive) => {
          if (prevActive > idx) return prevActive - 1;
          if (prevActive === idx) return Math.max(0, idx - 1);
          return prevActive;
        });
        return next;
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to remove STEP file');
    }
  };

  // ── Face selection ────────────────────────────────────────────────────────
  const handleSelectFace3D = useCallback(
    (bodyIdx: number, faceIdx: number) => {
      updateActiveSession((s) => ({
        selectedBodyIdx: bodyIdx,
        selectedFaceIndices: { ...s.selectedFaceIndices, [bodyIdx]: faceIdx },
        bodyStates: s.bodyStates.map((bs, i) => (i === bodyIdx ? { ...bs, confirmed: true } : bs)),
      }));
    },
    [updateActiveSession]
  );

  const handleFaceSelectedFromPreview = useCallback(
    (faceIndex: number) => {
      updateActiveSession((s) => ({
        selectedFaceIndices: { ...s.selectedFaceIndices, [s.selectedBodyIdx]: faceIndex },
      }));
    },
    [updateActiveSession]
  );

  const handleFaceDims = useCallback(
    (dims: [number, number, number]) => {
      updateActiveSession((s) => ({
        faceDimsMap: { ...s.faceDimsMap, [s.selectedBodyIdx]: dims },
      }));
    },
    [updateActiveSession]
  );

  const handleFaceNavigated = useCallback(() => {
    updateActiveSession((s) => ({
      bodyStates: s.bodyStates.map((bs, i) =>
        i === s.selectedBodyIdx ? { ...bs, confirmed: true } : bs
      ),
    }));
  }, [updateActiveSession]);

  const handleConfirmAll = useCallback(() => {
    updateActiveSession((s) => ({
      bodyStates: s.bodyStates.map((bs) => ({ ...bs, confirmed: true })),
    }));
  }, [updateActiveSession]);

  // ── Add confirmed parts to cut list ──────────────────────────────────────
  const handleAddToCutList = async () => {
    if (!activeSession) return;
    setAdding(true);
    try {
      const { stepFileId, bodyStates, selectedFaceIndices, faceDimsMap } = activeSession;
      const toAdd = bodyStates.filter((bs) => bs.included && bs.confirmed);
      const cutsPayload = toAdd.map((bs) => {
        const bodyArrayIdx = bodyStates.indexOf(bs);
        // Use projected face dims when available, fall back to body bbox
        const dims = faceDimsMap[bodyArrayIdx] ?? bs.body.bbox_mm;
        const faceIdx =
          selectedFaceIndices[bodyArrayIdx] ??
          bs.body.faces.find((f) => f.is_top_face)?.index ?? 0;
        const toProjectUnit = projectUnits === 'mm' ? (v: number) => v : mmToIn;
        return {
          label: bs.name,
          l: dims ? toProjectUnit(dims[0]) : 0,
          w: dims ? toProjectUnit(dims[1]) : 0,
          t: dims ? toProjectUnit(dims[2]) : 0,
          qty: 1,
          mat: '',
          stepFileId,
          stepBodyIndex: bs.body.index,
          stepFaceIndex: faceIdx,
        };
      });
      const res = await fetch(`/api/v1/projects/${id}/cuts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuts: cutsPayload }),
      });
      if (!res.ok) throw new Error('Failed to add cuts');
      const data = await res.json();
      setAddedCount(data.added);
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  // ── Export all DXFs ───────────────────────────────────────────────────────
  const [exportingAll, setExportingAll] = useState(false);
  const handleExportAllDxfs = async () => {
    if (!activeSession) return;
    setExportingAll(true);
    try {
      const { sessionId, filename, bodyStates, selectedFaceIndices } = activeSession;
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (const bs of bodyStates.filter((b) => b.included)) {
        const bodyArrayIdx = bodyStates.indexOf(bs);
        const faceIdx =
          selectedFaceIndices[bodyArrayIdx] ??
          bs.body.faces.find((f) => f.is_top_face)?.index ??
          bs.body.faces.find((f) => f.is_planar)?.index ?? 0;
        const res = await fetch('/api/v1/step/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            body_index: bs.body.index,
            body_name: bs.name,
            face_index: faceIdx,
          }),
        });
        if (!res.ok) continue;
        zip.file(`${bs.name}.dxf`, await res.blob());
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename.replace(/\.(step|stp)$/i, '')}_dxfs.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExportingAll(false);
    }
  };

  // ── Resizable right panel ─────────────────────────────────────────────────
  const [previewWidth, setPreviewWidth] = useState(360);
  const sepDragging = useRef(false);
  const onSepPointerDown = (e: React.PointerEvent) => {
    sepDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onSepPointerMove = (e: React.PointerEvent) => {
    if (!sepDragging.current) return;
    setPreviewWidth((w) => Math.max(180, Math.min(640, w - e.movementX)));
  };
  const onSepPointerUp = () => { sepDragging.current = false; };

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const dropzone = (
    <div
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => fileInputRef.current?.click()}
      className={`group rounded-2xl border border-dashed px-6 py-14 text-center cursor-pointer transition-all ${
        dragOver
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_4px_rgba(215,104,54,0.08)]'
          : 'border-[#c9cdc6] bg-white hover:border-[var(--accent)] hover:bg-[#fffaf6]'
      }`}
    >
      <input ref={fileInputRef} type="file" accept=".step,.stp" multiple className="hidden" onChange={onFileInput} />
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-dark)] transition-transform group-hover:-translate-y-0.5">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" />
        </svg>
      </div>
      {uploading ? (
        <>
          <p className="font-semibold text-[var(--ink)]">{uploadProgress ?? 'Parsing STEP files…'}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Complex assemblies can take a moment.</p>
        </>
      ) : (
        <>
          <p className="font-semibold text-[var(--ink)]">Drop STEP files here</p>
          <p className="mt-1 text-sm text-[var(--muted)]">or browse your computer · .step and .stp supported</p>
        </>
      )}
      {uploadError && <p className="mx-auto mt-4 max-w-md text-sm text-red-600">{uploadError}</p>}
    </div>
  );

  // ── Loading / empty states ────────────────────────────────────────────────
  if (restoring) {
    return (
      <div className="flex h-[calc(100vh-68px)] items-center justify-center gap-3 text-sm text-[var(--muted)]">
        <svg className="h-5 w-5 animate-spin text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        Restoring your STEP workspace…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link href={`/projects/${id}`} className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
          <span>←</span> {projectName}
        </Link>
        <div className="mb-8">
          <p className="app-eyebrow">Step 1 of 3 · Import</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">Bring in your CAD parts</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Upload one part or a full assembly. Next, you&apos;ll review each body and choose the face that should lie on the sheet.
          </p>
        </div>
        {dropzone}
        <div className="mt-5 grid gap-3 text-xs text-[var(--muted)] sm:grid-cols-3">
          <span className="flex items-center gap-2"><b className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5e8e2] text-[10px] text-[var(--ink)]">1</b> Upload STEP</span>
          <span className="flex items-center gap-2"><b className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5e8e2] text-[10px] text-[var(--ink)]">2</b> Confirm cut faces</span>
          <span className="flex items-center gap-2"><b className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5e8e2] text-[10px] text-[var(--ink)]">3</b> Optimize sheets</span>
        </div>
      </div>
    );
  }

  // ── Workspace ──────────────────────────────────────────────────────────────
  const { bodyStates, selectedFaceIndices, selectedBodyIdx } = activeSession!;
  const activeMeshData = meshCache[activeSession!.sessionId] ?? [];
  const confirmedCount = bodyStates.filter((bs) => bs.included && bs.confirmed).length;
  const selectedBody = bodyStates[selectedBodyIdx]?.body;
  const forcedFaceOccIndex = selectedFaceIndices[selectedBodyIdx];

  return (
    <div className="flex h-[calc(100vh-68px)] flex-col overflow-hidden bg-[#f5f4f0]">
      {/* Workspace header */}
      <div className="shrink-0 border-b border-[var(--line)] bg-white">
        <div className="flex min-h-[64px] items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/projects/${id}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:bg-black/[0.03] hover:text-[var(--ink)]" aria-label="Back to project">
              ←
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{projectName}</p>
              <p className="text-xs text-[var(--muted)]">Prepare CAD parts</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs lg:flex">
            <span className="flex items-center gap-2 text-[var(--success)]">
              <b className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e4f0e9] text-[10px]">✓</b>
              Import
            </span>
            <span className="h-px w-8 bg-[var(--line)]" />
            <span className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <b className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] text-[var(--accent-dark)]">2</b>
              Select faces
            </span>
            <span className="h-px w-8 bg-[var(--line)]" />
            <span className="flex items-center gap-2 text-[var(--muted)]">
              <b className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef0eb] text-[10px]">3</b>
              Optimize
            </span>
          </div>

          {addingNew ? (
            <button
              onClick={() => { setAddingNew(false); setUploadError(null); }}
              className="app-button-secondary min-h-9 py-1.5 text-xs"
            >
              Cancel upload
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="hidden overflow-hidden rounded-lg border border-[var(--line)] text-xs sm:flex">
                {(['mm', 'in'] as UnitSystem[]).map((u) => (
                  <button key={u} onClick={() => setUnits(u)}
                    className={`px-2.5 py-2 transition-colors ${units === u ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-black/[0.03]'}`}>
                    {u}
                  </button>
                ))}
              </div>
              <div className="hidden md:block">
                <button
                  onClick={handleExportAllDxfs}
                  disabled={exportingAll || !bodyStates.some((b) => b.included)}
                  className="app-button-secondary min-h-9 py-1.5 text-xs"
                >
                  {exportingAll ? 'Exporting…' : 'Export DXFs'}
                </button>
              </div>
              <button
                onClick={handleAddToCutList}
                disabled={adding || confirmedCount === 0}
                className="app-button-primary min-h-9 py-1.5 text-xs"
              >
                <span className="sm:hidden">{adding ? 'Adding…' : 'Add parts'}</span>
                <span className="hidden sm:inline">{adding ? 'Adding…' : `Add ${confirmedCount || ''} part${confirmedCount === 1 ? '' : 's'} to project`}</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>

        {/* File tabs */}
        <div className="flex min-h-11 items-center gap-3 border-t border-[var(--line)] px-4 lg:px-6">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Files</span>
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto py-1.5">
            {sessions.map((s, i) => (
              <div
                key={s.sessionId}
                className={`flex shrink-0 select-none items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  i === activeIdx && !addingNew
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                    : 'cursor-pointer border-[var(--line)] bg-white text-[var(--muted)] hover:border-[#c5c9c2]'
                }`}
              >
                <span
                  onClick={() => { setActiveIdx(i); setAddingNew(false); }}
                  className="max-w-[140px] truncate cursor-pointer"
                >
                  {s.filename}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveSession(i); }}
                  className={`ml-1 flex h-4 w-4 items-center justify-center rounded-full leading-none transition-colors ${
                    i === activeIdx && !addingNew ? 'hover:bg-white/20' : 'hover:bg-slate-300'
                  }`}
                  title="Remove this STEP"
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add-new tab */}
            <button
              onClick={() => { setAddingNew(true); setUploadError(null); }}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                addingNew
                  ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                  : 'border-dashed border-[#bdc2ba] text-[var(--accent-dark)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]'
              }`}
              title="Load one or more STEP files"
            >
              + Add STEP
            </button>
          </div>

          {!addingNew && meshLoading && (
            <span className="shrink-0 animate-pulse text-xs text-[var(--muted)]">Building 3D preview…</span>
          )}
        </div>
      </div>

      {/* Success banner */}
      {addedCount !== null && !addingNew && (
        <div className="flex shrink-0 items-center justify-between border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-emerald-800 font-medium">
              {addedCount} part{addedCount !== 1 ? 's are' : ' is'} ready in your project.
            </span>
          </div>
          <button
            onClick={() => router.push(`/projects/${id}`)}
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
          >
            Continue to stock &amp; layout →
          </button>
        </div>
      )}

      {/* "Adding new" dropzone */}
      {addingNew ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-xl">{dropzone}</div>
        </div>
      ) : (
        /* Three-column workspace */
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Left: Parts tree */}
          <div className="h-44 w-full shrink-0 overflow-hidden border-b border-[var(--line)] bg-white lg:h-auto lg:w-64 lg:border-b-0 lg:border-r">
            <StepSidebar
              bodyStates={bodyStates}
              selectedIndex={selectedBodyIdx}
              onSelect={(i) => updateActiveSession({ selectedBodyIdx: i })}
              onConfirmAll={handleConfirmAll}
              onToggle={(i) =>
                updateActiveSession((s) => ({
                  bodyStates: s.bodyStates.map((bs, idx) =>
                    idx === i ? { ...bs, included: !bs.included } : bs
                  ),
                }))
              }
              onRename={(i, name) =>
                updateActiveSession((s) => ({
                  bodyStates: s.bodyStates.map((bs, idx) =>
                    idx === i ? { ...bs, name } : bs
                  ),
                }))
              }
            />
          </div>

          {/* Center: 3D viewer */}
          <div className="relative min-h-[360px] min-w-0 flex-1 bg-[#eeefeb]">
            {activeMeshData.length > 0 ? (
              <StepViewer3D
                meshData={activeMeshData}
                bodyStates={bodyStates}
                selectedBodyIdx={selectedBodyIdx}
                selectedFaceIndices={selectedFaceIndices}
                onSelectFace={handleSelectFace3D}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                {meshLoading ? (
                  <>
                    <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    <span className="text-sm">Tessellating geometry…</span>
                  </>
                ) : (
                  <span className="text-sm">No 3D data</span>
                )}
              </div>
            )}
            {activeMeshData.length > 0 && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-black/5 bg-white/85 px-3 py-1.5 text-[11px] text-[var(--muted)] shadow-sm backdrop-blur">
                Orbit: drag · Pan: shift-drag · Select: click a face
              </div>
            )}
            {activeMeshData.length > 0 && (
              <div className="pointer-events-none absolute left-4 top-4 max-w-56 rounded-xl border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold text-[var(--ink)]">Choose the sheet face</p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">Click the broad, flat face that should be cut from your stock.</p>
              </div>
            )}
          </div>

          {/* Drag separator */}
          <div
            className="group/sep hidden w-[5px] shrink-0 cursor-col-resize select-none items-center justify-center bg-[#e5e6e1] transition-colors hover:bg-[#ecc4ae] active:bg-[var(--accent)] lg:flex"
            onPointerDown={onSepPointerDown}
            onPointerMove={onSepPointerMove}
            onPointerUp={onSepPointerUp}
            onPointerLeave={onSepPointerUp}
          >
            <div className="flex flex-col gap-[3px] pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[3px] w-[3px] rounded-full bg-[#b6bbb3] group-hover/sep:bg-[var(--accent)]" />
              ))}
            </div>
          </div>

          {/* Right: 2D face preview */}
          <div
            style={{ '--preview-width': `${previewWidth}px` } as React.CSSProperties}
            className="flex min-h-[420px] w-full shrink-0 flex-col overflow-hidden border-t border-[var(--line)] bg-white p-4 lg:min-h-0 lg:w-[var(--preview-width)] lg:border-t-0"
          >
            {selectedBody ? (
              <>
                <div className="mb-3 flex shrink-0 items-start gap-2 border-b border-[var(--line)] pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Selected part</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
                      {bodyStates[selectedBodyIdx]?.name ?? selectedBody.name}
                    </p>
                  </div>
                  {!bodyStates[selectedBodyIdx]?.confirmed ? (
                    <button
                      onClick={() =>
                        updateActiveSession((s) => ({
                          bodyStates: s.bodyStates.map((bs, i) =>
                            i === s.selectedBodyIdx ? { ...bs, confirmed: true } : bs
                          ),
                        }))
                      }
                      className="shrink-0 rounded-lg bg-[#e5f1ea] px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-[#d7e9df]"
                    >
                      Confirm face
                    </button>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#e5f1ea] px-2 py-1 text-[10px] font-semibold text-emerald-700">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Ready
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <StepPreviewPanel
                    key={selectedBody.index}
                    sessionId={activeSession!.sessionId}
                    body={selectedBody}
                    units={units}
                    forcedFaceOccIndex={forcedFaceOccIndex}
                    onFaceSelected={handleFaceSelectedFromPreview}
                    onFaceDims={handleFaceDims}
                    onFaceNavigated={handleFaceNavigated}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center">
                Click a face in the 3D view to preview its projection
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
