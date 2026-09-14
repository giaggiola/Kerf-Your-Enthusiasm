import { convertDim } from '@/lib/unit-utils';
import type { UnitSystem } from '@/types';

/** Dimensions in this feature are always millimetres; adapters handle existing project units. */
export interface Part {
  id: string;
  name: string;
  quantity: number;
  length: number;
  width: number;
  thickness: number;
  material: string;
  group: string;
  source?: {
    fileId?: string;
    sessionId?: string;
    bodyIndex?: number;
    faceIndex?: number;
    filename?: string;
  };
}

export interface PartsDocument {
  name: string;
  parts: Part[];
}

export interface StoredPart {
  id: string;
  label: string;
  quantity: number;
  length: number;
  width: number;
  thickness: number | null;
  material: string | null;
  groupName: string | null;
  sortOrder?: number | null;
  stepFileId?: string | null;
  stepSessionId?: string | null;
  stepBodyIndex?: number | null;
  stepFaceIndex?: number | null;
}

function convertStoredDimension(
  value: number,
  from: UnitSystem,
  to: UnitSystem,
) {
  // Avoid binary conversion noise turning an exact stock fit into a kerf-sized miss.
  return Number(convertDim(value, from, to).toPrecision(14));
}

export function partFromStorage(
  part: StoredPart,
  units: UnitSystem,
  filenames: Record<string, string> = {},
): Part {
  return {
    id: part.id,
    name: part.label,
    quantity: part.quantity,
    length: convertStoredDimension(part.length, units, 'mm'),
    width: convertStoredDimension(part.width, units, 'mm'),
    thickness: convertStoredDimension(part.thickness ?? 0, units, 'mm'),
    material: part.material ?? '',
    group: part.groupName ?? '',
    source:
      part.stepFileId || part.stepSessionId
        ? {
            fileId: part.stepFileId ?? undefined,
            sessionId: part.stepSessionId ?? undefined,
            bodyIndex: part.stepBodyIndex ?? undefined,
            faceIndex: part.stepFaceIndex ?? undefined,
            filename: part.stepFileId ? filenames[part.stepFileId] : undefined,
          }
        : undefined,
  };
}

export function partToStorage(part: Part, units: UnitSystem) {
  return {
    id: part.id,
    label: part.name.trim(),
    qty: part.quantity,
    l: convertStoredDimension(part.length, 'mm', units),
    w: convertStoredDimension(part.width, 'mm', units),
    t: convertStoredDimension(part.thickness, 'mm', units),
    mat: part.material.trim(),
    group: part.group.trim(),
    stepFileId: part.source?.fileId,
    stepSessionId: part.source?.sessionId,
    stepBodyIndex: part.source?.bodyIndex,
    stepFaceIndex: part.source?.faceIndex,
  };
}

export function formatDimension(mm: number, units: UnitSystem) {
  return Number(
    convertDim(mm, 'mm', units).toFixed(units === 'mm' ? 3 : 5),
  ).toString();
}

/** Accept decimal dimensions and inch fractions without evaluating an expression. */
export function parseDimension(
  input: string,
  units: UnitSystem,
): number | null {
  const value = input.trim();
  const fraction =
    units === 'in' ? /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(value) : null;
  let parsed: number;
  if (fraction) {
    const denominator = Number(fraction[3]);
    if (!denominator) return null;
    parsed = Number(fraction[1] ?? 0) + Number(fraction[2]) / denominator;
  } else {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
    parsed = Number(value);
  }
  return Number.isFinite(parsed) ? convertDim(parsed, units, 'mm') : null;
}

export function validateDocument(document: PartsDocument): string | null {
  if (!document.name.trim()) return 'Give this cut list a name.';
  if (document.name.length > 200)
    return 'Keep the cut list name under 200 characters.';
  const ids = new Set<string>();
  for (const part of document.parts) {
    if (!part.id || ids.has(part.id))
      return 'Each part needs a unique identity.';
    ids.add(part.id);
    if (!part.name.trim() || part.name.length > 200)
      return 'Give each part a name under 200 characters.';
    if (!Number.isSafeInteger(part.quantity) || part.quantity < 1)
      return `${part.name}: quantity must be a positive whole number.`;
    if (![part.length, part.width].every((v) => Number.isFinite(v) && v > 0))
      return `${part.name}: length and width must be greater than zero.`;
    if (!Number.isFinite(part.thickness) || part.thickness < 0)
      return `${part.name}: thickness cannot be negative.`;
  }
  return null;
}
