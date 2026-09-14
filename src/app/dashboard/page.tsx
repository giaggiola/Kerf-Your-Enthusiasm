'use client';

import { createId } from '@/lib/id';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

interface Project {
  id: string;
  name: string;
  description: string | null;
  kerf: number;
  createdAt: string;
  updatedAt: string;
  stocks: Array<{ id: string; name: string }>;
  cuts: Array<{ id: string; label: string }>;
}

interface ProjectDetailsResponse {
  id: string;
  name: string;
  description: string | null;
  kerf: number;
  units?: string | null;
  groupMultipliers?: string | null;
  layoutOverrides?: Record<string, unknown>;
  layoutExcludedKeys?: string[];
  layoutPadding?: number;
  layoutHasActive?: boolean;
  stepActiveFileId?: string | null;
  stocks: Array<{
    id: string;
    name: string;
    length: number;
    width: number;
    thickness: number | null;
    quantity: number;
    material: string;
  }>;
  cuts: Array<{
    id: string;
    label: string;
    length: number;
    width: number;
    thickness: number | null;
    quantity: number;
    material: string;
    groupName?: string | null;
    stepFileId?: string | null;
    stepSessionId?: string | null;
    stepBodyIndex?: number | null;
    stepFaceIndex?: number | null;
  }>;
  stepFiles: Array<{
    id: string;
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
    sessionId: string | null;
  }>;
}

interface UploadResult {
  id: string;
}

interface ImportedProjectStock {
  id?: string;
  dbId?: string;
  name: string;
  l: number;
  w: number;
  t?: number;
  qty: number;
  mat: string;
}

interface ImportedProjectCut {
  id?: string;
  dbId?: string;
  label: string;
  l: number;
  w: number;
  t?: number;
  qty: number;
  mat: string;
  group?: string;
  stepFileId?: string | null;
  stepSessionId?: string | null;
  stepBodyIndex?: number | null;
  stepFaceIndex?: number | null;
}

interface ImportedStepFile {
  id?: string;
  fileName: string;
  filename?: string;
  sortOrder?: number;
  selectedBodyIndex?: number;
  bodyState?: Array<{
    bodyIndex: number;
    name: string;
    included: boolean;
    confirmed: boolean;
    selectedFaceIndex?: number;
  }>;
  exported?: boolean;
  error?: string;
}

interface ProjectBundle {
  format: string;
  version: number;
  project?: {
    name: string;
    description?: string | null;
    settings?: {
      kerf?: number;
      padding?: number;
      units?: string;
      groupMultipliers?: Record<string, number>;
    };
    layout?: {
      overrides?: Record<string, unknown>;
      excludedKeys?: string[];
    };
    stepActiveFileId?: string | null;
    stepFiles?: ImportedStepFile[];
    stocks?: ImportedProjectStock[];
    cuts?: ImportedProjectCut[];
  };
  stepSessions?: Array<{
    sessionId: string;
    fileName: string;
    exported?: boolean;
    error?: string;
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const bundleInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingStep, setCreatingStep] = useState(false);
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);
  const [importingBundle, setImportingBundle] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/v1/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName }),
      });

      if (res.ok) {
        const project = await res.json();
        setProjects([project, ...projects]);
        setNewProjectName('');
        setShowNewForm(false);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleNewStepProject = async () => {
    setCreatingStep(true);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New STEP Project' }),
      });
      if (res.ok) {
        const project = await res.json();
        router.push(`/projects/${project.id}/step`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreatingStep(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const res = await fetch(`/api/v1/projects/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setProjects(projects.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const makeDuplicateProjectName = (name: string) => {
    const trimmed = name.trim() || 'Untitled Project';
    const match = trimmed.match(/^(.*) Copy(?: (\d+))?$/);
    if (!match) return `${trimmed} Copy`;
    const baseName = match[1].trim() || 'Untitled Project';
    const copyIndex = match[2] ? parseInt(match[2], 10) + 1 : 2;
    return `${baseName} Copy ${copyIndex}`;
  };

  const scheduleAutoOptimize = (projectId: string) => {
    try {
      sessionStorage.setItem(`project-auto-optimize-${projectId}`, '1');
    } catch {
      // Ignore browser storage failures and still allow navigation.
    }
  };

  const createProjectShell = async (name: string, description?: string | null) => {
    const createRes = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description ?? null }),
    });

    if (!createRes.ok) {
      const errorPayload = await createRes.json().catch(() => ({}));
      throw new Error(errorPayload.error ?? errorPayload.detail ?? `Project creation failed (${createRes.status})`);
    }

    return createRes.json() as Promise<Project>;
  };

  const uploadStepFileToProject = async (projectId: string, fileName: string, blob: Blob) => {
    const formData = new FormData();
    formData.append('file', new File([blob], fileName, { type: 'application/octet-stream' }));

    const uploadRes = await fetch(`/api/v1/projects/${projectId}/step-files`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      const errorPayload = await uploadRes.json().catch(() => ({}));
      throw new Error(errorPayload.detail ?? `Upload failed (${uploadRes.status})`);
    }

    return uploadRes.json() as Promise<UploadResult>;
  };

  const patchProjectStepFileState = async (
    projectId: string,
    fileId: string,
    stepFile: Pick<ImportedStepFile, 'sortOrder' | 'selectedBodyIndex' | 'bodyState'>
  ) => {
    await fetch(`/api/v1/projects/${projectId}/step-files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sortOrder: stepFile.sortOrder ?? 0,
        selectedBodyIndex: stepFile.selectedBodyIndex ?? 0,
        bodyState: stepFile.bodyState ?? [],
      }),
    });
  };

  const remapInstanceKey = (key: string, cutIdMap: Map<string, string>) => {
    const match = key.match(/^(.*)-(\d+)$/);
    if (!match) return key;
    const [, oldCutId, instanceIndex] = match;
    const nextCutId = cutIdMap.get(oldCutId);
    return nextCutId ? `${nextCutId}-${instanceIndex}` : null;
  };

  const remapLayoutState = (
    layout: { overrides?: Record<string, unknown>; excludedKeys?: string[] } | undefined,
    cutIdMap: Map<string, string>
  ) => {
    const overrides = layout?.overrides ?? {};
    const remappedOverrides = Object.fromEntries(
      Object.entries(overrides).flatMap(([key, value]) => {
        const mappedKey = remapInstanceKey(key, cutIdMap);
        return mappedKey ? [[mappedKey, value]] : [];
      })
    );
    const remappedExcludedKeys = (layout?.excludedKeys ?? [])
      .map((key) => remapInstanceKey(key, cutIdMap))
      .filter((key): key is string => Boolean(key));

    return {
      overrides: remappedOverrides,
      excludedKeys: remappedExcludedKeys,
    };
  };

  const startRenamingProject = (project: Project) => {
    setBundleError(null);
    setRenamingProjectId(project.id);
    setRenameDraft(project.name);
  };

  const cancelRenamingProject = () => {
    setRenamingProjectId(null);
    setRenameDraft('');
  };

  const handleRenameProject = async (project: Project) => {
    const nextName = renameDraft.trim();
    if (!nextName) return;
    if (nextName === project.name) {
      cancelRenamingProject();
      return;
    }

    setSavingRenameId(project.id);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? errorPayload.detail ?? `Failed to rename project (${res.status})`);
      }

      const updatedProject = await res.json() as Project;
      setProjects((prev) => prev.map((p) => (p.id === project.id ? updatedProject : p)));
      cancelRenamingProject();
    } catch (error) {
      console.error('Failed to rename project:', error);
      setBundleError(error instanceof Error ? error.message : 'Project rename failed');
    } finally {
      setSavingRenameId(null);
    }
  };

  const handleDuplicateProject = async (projectId: string) => {
    setDuplicatingProjectId(projectId);
    try {
      const sourceRes = await fetch(`/api/v1/projects/${projectId}`);
      if (!sourceRes.ok) {
        throw new Error(`Failed to load project (${sourceRes.status})`);
      }

      const sourceProject = await sourceRes.json() as ProjectDetailsResponse;
      let parsedGroupMultipliers: Record<string, number> = {};
      try {
        const parsed = JSON.parse(sourceProject.groupMultipliers ?? '{}');
        if (parsed && typeof parsed === 'object') {
          parsedGroupMultipliers = parsed as Record<string, number>;
        }
      } catch {
        parsedGroupMultipliers = {};
      }

      const duplicatedProject = await createProjectShell(
        makeDuplicateProjectName(sourceProject.name),
        sourceProject.description ?? null
      );

      const stepFileIdMap = new Map<string, string>();
      for (const stepFile of sourceProject.stepFiles ?? []) {
        const fileRes = await fetch(`/api/v1/projects/${projectId}/step-files/${stepFile.id}/file`);
        if (!fileRes.ok) {
          throw new Error(`Failed to duplicate STEP file ${stepFile.filename}`);
        }
        const uploadData = await uploadStepFileToProject(
          duplicatedProject.id,
          stepFile.filename,
          await fileRes.blob()
        );
        stepFileIdMap.set(stepFile.id, uploadData.id);
        await patchProjectStepFileState(duplicatedProject.id, uploadData.id, stepFile);
      }

      const cutIdMap = new Map<string, string>(
        sourceProject.cuts.map((cut) => [cut.id, createId()])
      );
      const remappedLayout = remapLayoutState(
        {
          overrides: sourceProject.layoutOverrides ?? {},
          excludedKeys: sourceProject.layoutExcludedKeys ?? [],
        },
        cutIdMap
      );

      const updateRes = await fetch(`/api/v1/projects/${duplicatedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: makeDuplicateProjectName(sourceProject.name),
          description: sourceProject.description ?? null,
          kerf: sourceProject.kerf,
          units: sourceProject.units ?? 'in',
          groupMultipliers: parsedGroupMultipliers,
          layoutOverrides: remappedLayout.overrides,
          layoutExcludedKeys: remappedLayout.excludedKeys,
          layoutPadding: sourceProject.layoutPadding ?? 0.5,
          layoutHasActive: sourceProject.layoutHasActive ?? false,
          stepActiveFileId: sourceProject.stepActiveFileId
            ? stepFileIdMap.get(sourceProject.stepActiveFileId) ?? null
            : null,
          stocks: sourceProject.stocks.map((stock) => ({
            id: createId(),
            name: stock.name,
            l: stock.length,
            w: stock.width,
            t: stock.thickness ?? 0,
            qty: stock.quantity,
            mat: stock.material,
          })),
          cuts: sourceProject.cuts.map((cut) => ({
            id: cutIdMap.get(cut.id) ?? createId(),
            label: cut.label,
            l: cut.length,
            w: cut.width,
            t: cut.thickness ?? 0,
            qty: cut.quantity,
            mat: cut.material ?? '',
            group: cut.groupName ?? undefined,
            stepFileId: cut.stepFileId ? stepFileIdMap.get(cut.stepFileId) ?? undefined : undefined,
            stepBodyIndex: cut.stepBodyIndex ?? undefined,
            stepFaceIndex: cut.stepFaceIndex ?? undefined,
          })),
        }),
      });

      if (!updateRes.ok) {
        const errorPayload = await updateRes.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? errorPayload.detail ?? `Failed to finalize duplicate (${updateRes.status})`);
      }

      scheduleAutoOptimize(duplicatedProject.id);
      setProjects((prev) => [duplicatedProject, ...prev]);
      router.push(`/projects/${duplicatedProject.id}`);
    } catch (error) {
      console.error('Failed to duplicate project:', error);
      setBundleError(error instanceof Error ? error.message : 'Project duplication failed');
    } finally {
      setDuplicatingProjectId(null);
    }
  };

  const importProjectBundle = async (file: File) => {
    setImportingBundle(true);
    setBundleError(null);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      const projectEntry = zip.file('project.json');

      if (!projectEntry) {
        throw new Error('This zip does not contain a project.json bundle manifest.');
      }

      const bundle = JSON.parse(await projectEntry.async('string')) as ProjectBundle;
      if (bundle.format !== 'kerfuffle-project-bundle' || !bundle.project?.name) {
        throw new Error('This does not look like a Kerfuffle project bundle.');
      }

      const importedProject = await createProjectShell(
        bundle.project.name,
        bundle.project.description ?? null
      );

      const stepFileIdMap = new Map<string, string>();
      const legacySessionMap = new Map<string, string>();
      const missingStepFiles: string[] = [];

      for (const stepFile of bundle.project.stepFiles ?? []) {
        if (!stepFile?.fileName) continue;

        const stepEntry = zip.file(`step-files/${stepFile.fileName}`);
        if (!stepEntry) {
          missingStepFiles.push(stepFile.fileName);
          continue;
        }

        try {
          const uploadData = await uploadStepFileToProject(
            importedProject.id,
            stepFile.filename ?? stepFile.fileName,
            await stepEntry.async('blob')
          );
          if (stepFile.id) {
            stepFileIdMap.set(stepFile.id, uploadData.id);
          }
          await patchProjectStepFileState(importedProject.id, uploadData.id, stepFile);
        } catch (error) {
          missingStepFiles.push(
            `${stepFile.fileName} (${error instanceof Error ? error.message : 'Upload failed'})`
          );
        }
      }

      for (const stepSession of bundle.stepSessions ?? []) {
        if (!stepSession?.sessionId || !stepSession?.fileName) continue;

        const stepEntry = zip.file(`step-files/${stepSession.fileName}`);
        if (!stepEntry) {
          missingStepFiles.push(stepSession.fileName);
          continue;
        }

        try {
          const uploadData = await uploadStepFileToProject(
            importedProject.id,
            stepSession.fileName,
            await stepEntry.async('blob')
          );
          legacySessionMap.set(stepSession.sessionId, uploadData.id);
        } catch (error) {
          missingStepFiles.push(
            `${stepSession.fileName} (${error instanceof Error ? error.message : 'Upload failed'})`
          );
        }
      }

      const getBundleCutSourceId = (cut: ImportedProjectCut, index: number) =>
        String(cut.dbId ?? cut.id ?? `legacy-${index}`);
      const cutIdMap = new Map<string, string>(
        (bundle.project.cuts ?? []).map((cut, index) => [
          getBundleCutSourceId(cut, index),
          createId(),
        ])
      );
      const remappedLayout = remapLayoutState(bundle.project.layout, cutIdMap);

      const importedCuts = (bundle.project.cuts ?? []).map((cut, index) => {
        const mappedStepFileId = cut.stepFileId
          ? stepFileIdMap.get(cut.stepFileId) ?? null
          : cut.stepSessionId
          ? legacySessionMap.get(cut.stepSessionId) ?? null
          : null;
        const sourceCutId = getBundleCutSourceId(cut, index);

        return {
          id: cutIdMap.get(sourceCutId) ?? createId(),
          label: cut.label,
          l: cut.l,
          w: cut.w,
          t: cut.t ?? 0,
          qty: cut.qty ?? 1,
          mat: cut.mat ?? '',
          group: cut.group ?? undefined,
          stepFileId: mappedStepFileId ?? undefined,
          stepBodyIndex: mappedStepFileId ? cut.stepBodyIndex ?? undefined : undefined,
          stepFaceIndex: mappedStepFileId ? cut.stepFaceIndex ?? undefined : undefined,
        };
      });

      const updateRes = await fetch(`/api/v1/projects/${importedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bundle.project.name,
          description: bundle.project.description ?? null,
          kerf: bundle.project.settings?.kerf ?? 0.125,
          units: bundle.project.settings?.units ?? 'in',
          groupMultipliers: bundle.project.settings?.groupMultipliers ?? {},
          layoutOverrides: remappedLayout.overrides,
          layoutExcludedKeys: remappedLayout.excludedKeys,
          layoutPadding: bundle.project.settings?.padding ?? 0.5,
          layoutHasActive: false,
          stepActiveFileId: bundle.project.stepActiveFileId
            ? stepFileIdMap.get(bundle.project.stepActiveFileId) ?? null
            : null,
          stocks: (bundle.project.stocks ?? []).map((stock) => ({
            id: createId(),
            name: stock.name,
            l: stock.l,
            w: stock.w,
            t: stock.t ?? 0,
            qty: stock.qty,
            mat: stock.mat,
          })),
          cuts: importedCuts,
        }),
      });

      if (!updateRes.ok) {
        const errorPayload = await updateRes.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? errorPayload.detail ?? `Import failed (${updateRes.status})`);
      }

      scheduleAutoOptimize(importedProject.id);

      if (missingStepFiles.length > 0) {
        alert(
          `${missingStepFiles.length} STEP file${missingStepFiles.length === 1 ? '' : 's'} could not be restored. `
          + 'Those parts were still imported as dimension-based cuts.'
        );
      }

      router.push(`/projects/${importedProject.id}`);
    } catch (error) {
      console.error('Failed to import bundle:', error);
      setBundleError(error instanceof Error ? error.message : 'Bundle import failed');
    } finally {
      setImportingBundle(false);
      if (bundleInputRef.current) bundleInputRef.current.value = '';
    }
  };

  const handleBundleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importProjectBundle(file);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl py-10 sm:py-14">
        <div className="animate-pulse space-y-7">
          <div className="h-10 w-64 rounded-lg bg-black/10" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 rounded-2xl bg-black/10" />
            <div className="h-48 rounded-2xl bg-black/10" />
          </div>
          <div className="h-40 rounded-2xl bg-black/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl py-10 sm:py-14">
      <input
        ref={bundleInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={(e) => { void handleBundleInput(e); }}
        className="hidden"
      />

      <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="app-eyebrow">Project library</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl">
            What are we cutting?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Welcome back, {session?.user.name?.split(' ')[0] || 'there'}. Start with a CAD model or build a cut list by hand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => bundleInputRef.current?.click()}
            disabled={importingBundle}
            className="app-button-secondary"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 16.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2.5M8 8l4-4 4 4M12 4v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {importingBundle ? 'Importing…' : 'Import bundle'}
          </button>
          <button
            onClick={() => setShowNewForm(true)}
            className="app-button-primary"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New project
          </button>
        </div>
      </div>

      {bundleError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bundleError}
        </div>
      )}

      {showNewForm && (
        <div className="app-card mb-6 border-[var(--accent)]/30 bg-[var(--accent-soft)]/45 p-5">
          <form onSubmit={handleCreateProject} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--foreground)]">Project name</span>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Walnut media console"
                className="app-input w-full"
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newProjectName.trim()}
                className="app-button-primary"
              >
                {creating ? 'Creating…' : 'Create project'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setNewProjectName('');
                }}
                className="app-button-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="mb-11 grid gap-4 md:grid-cols-2">
        <button
          onClick={handleNewStepProject}
          disabled={creatingStep}
          className="group relative min-h-48 overflow-hidden rounded-2xl bg-[var(--ink)] p-6 text-left text-white shadow-[0_14px_36px_rgba(29,41,36,0.16)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-white/10" />
          <div className="absolute -right-2 -top-8 h-32 w-32 rounded-full border border-white/10" />
          <div className="relative flex h-full flex-col justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#f3a27b]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" strokeLinejoin="round" />
                <path d="m5 7 7 4 7-4M12 11v10" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.025em]">
                  {creatingStep ? 'Opening workspace…' : 'Start from CAD'}
                </h2>
                <span className="text-xl transition-transform group-hover:translate-x-1">→</span>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/60">
                Upload STEP files, choose the cut faces, then send the parts straight into optimization.
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowNewForm(true)}
          className="app-card group min-h-48 p-6 text-left transition-transform hover:-translate-y-0.5 hover:border-[#c8ccc5]"
        >
          <div className="flex h-full flex-col justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-dark)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.025em] text-[var(--ink)]">Build a cut list</h2>
                <span className="text-xl text-[var(--muted)] transition-transform group-hover:translate-x-1">→</span>
              </div>
              <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
                Enter sheet stock and part dimensions manually for a fast, saved project.
              </p>
            </div>
          </div>
        </button>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="app-eyebrow">Recent work</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
              {projects.length === 0 ? 'Your projects will live here' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
            </h2>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#cfd2cb] px-6 py-10 text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">No saved projects yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Choose one of the starting points above to make the first one.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="app-card group p-5 transition-transform hover:-translate-y-0.5 hover:border-[#c8ccc5]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef0eb] text-[var(--foreground)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 7.5h6l1.5-2H20v13H4z" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  {renamingProjectId === project.id ? (
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleRenameProject(project);
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelRenamingProject();
                        }
                      }}
                      className="app-input h-10 w-full py-1.5 text-base font-semibold"
                      autoFocus
                    />
                  ) : (
                    <Link
                      href={`/projects/${project.id}`}
                      className="block truncate text-base font-semibold tracking-[-0.015em] text-[var(--ink)] hover:text-[var(--accent-dark)]"
                    >
                      {project.name}
                    </Link>
                  )}
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                    <span><b className="font-semibold text-[var(--foreground)]">{project.cuts.length}</b> parts</span>
                    <span><b className="font-semibold text-[var(--foreground)]">{project.stocks.length}</b> stock types</span>
                    <span>{project.kerf}&quot; kerf</span>
                  </div>
                </div>
                <div className="shrink-0">
                  {renamingProjectId === project.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { void handleRenameProject(project); }}
                        disabled={savingRenameId === project.id || !renameDraft.trim()}
                        className="rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {savingRenameId === project.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelRenamingProject}
                        disabled={savingRenameId === project.id}
                        className="rounded-lg px-2 py-2 text-xs text-[var(--muted)] hover:bg-black/5 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <details className="relative">
                      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/5 [&::-webkit-details-marker]:hidden" aria-label={`Actions for ${project.name}`}>
                        <span className="mb-2 text-xl leading-none">•••</span>
                      </summary>
                      <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[var(--line)] bg-white p-1.5 text-sm shadow-xl">
                        <button
                          onClick={() => startRenamingProject(project)}
                          disabled={duplicatingProjectId !== null || savingRenameId !== null}
                          className="block w-full rounded-lg px-3 py-2 text-left text-[var(--foreground)] hover:bg-black/[0.04] disabled:opacity-50"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => { void handleDuplicateProject(project.id); }}
                          disabled={duplicatingProjectId !== null || renamingProjectId !== null}
                          className="block w-full rounded-lg px-3 py-2 text-left text-[var(--foreground)] hover:bg-black/[0.04] disabled:opacity-50"
                        >
                          {duplicatingProjectId === project.id ? 'Duplicating…' : 'Duplicate'}
                        </button>
                        <Link href={`/projects/${project.id}/step`} className="block rounded-lg px-3 py-2 text-[var(--foreground)] hover:bg-black/[0.04]">
                          Add STEP files
                        </Link>
                        <div className="my-1 h-px bg-[var(--line)]" />
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="block w-full rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50"
                        >
                          Delete project
                        </button>
                      </div>
                    </details>
                  )}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4">
                <span className="text-xs text-[var(--muted)]">Updated {formatDate(project.updatedAt)}</span>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]"
                >
                  Open workspace <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </div>
            </div>
          ))}
          </div>
        )}
      </section>
    </div>
  );
}
