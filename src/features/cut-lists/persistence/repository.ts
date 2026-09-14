import {
  partFromStorage,
  partToStorage,
  type PartsDocument,
  type StoredPart,
} from '../domain/parts';
import type { UnitSystem } from '@/types';

export interface ProjectRecord {
  id: string;
  name: string;
  units: UnitSystem | null;
  updatedAt: string;
  cuts: StoredPart[];
  stepFiles?: { id: string; filename: string }[];
}

export async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Your session has ended. Log in again to save your work.'
        : data.error || 'Could not save your changes. Please try again.',
    );
  return data as T;
}

export function documentFromProject(project: ProjectRecord): PartsDocument {
  const filenames = Object.fromEntries(
    (project.stepFiles ?? []).map((file) => [file.id, file.filename]),
  );
  return {
    name: project.name,
    parts: [...project.cuts]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((part) => partFromStorage(part, project.units ?? 'in', filenames)),
  };
}

export async function fetchProject(id: string, signal?: AbortSignal) {
  return readResponse<ProjectRecord>(
    await fetch(`/api/v1/projects/${id}`, { signal }),
  );
}

export async function saveParts(
  id: string,
  document: PartsDocument,
  updatedAt: string,
) {
  return readResponse<{ updatedAt: string }>(
    await fetch(`/api/v1/projects/${id}/parts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...document, updatedAt }),
    }),
  );
}

export async function createCutList(document: PartsDocument) {
  // Keep the existing layout and STEP workflows in their established storage units.
  return readResponse<ProjectRecord>(
    await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.name,
        units: 'in',
        stocks: [],
        cuts: document.parts.map((part) => partToStorage(part, 'in')),
      }),
    }),
  );
}
