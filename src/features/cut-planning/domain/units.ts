import { convertDim } from '@/lib/unit-utils';
import type { ManualOverrides, UnitSystem } from '@/types';

// The legacy canvas and stock presets work in inches. Convert at persistence
// boundaries; the display toggle must never change a project's storage units.
export function layoutDimension(value: number, from: UnitSystem, to: UnitSystem) {
  if (from === to) return value;
  const converted = convertDim(value, from, to);
  // Keep full working precision in inches; round only at the metric boundary.
  // Rounding both directions compounds error over repeated saves.
  return to === 'mm' ? Number(converted.toPrecision(14)) : converted;
}

export function layoutOverridesInUnits(overrides: ManualOverrides, from: UnitSystem, to: UnitSystem): ManualOverrides {
  return Object.fromEntries(Object.entries(overrides).map(([id, override]) => [id, {
    ...override,
    ...(override.x === undefined ? {} : { x: layoutDimension(override.x, from, to) }),
    ...(override.y === undefined ? {} : { y: layoutDimension(override.y, from, to) }),
  }]));
}

type StoredDimensions = { length: number; width: number; thickness: number | null };
export function dimensionsToLayout<T extends StoredDimensions>(part: T, units: UnitSystem): T {
  return {
    ...part,
    length: layoutDimension(part.length, units, 'in'),
    width: layoutDimension(part.width, units, 'in'),
    thickness: layoutDimension(part.thickness ?? 0, units, 'in'),
  };
}

export function dimensionsFromLayout<T extends { l: number; w: number; t: number }>(part: T, units: UnitSystem): T {
  return {
    ...part,
    l: layoutDimension(part.l, 'in', units),
    w: layoutDimension(part.w, 'in', units),
    t: layoutDimension(part.t, 'in', units),
  };
}
