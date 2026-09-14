'use client';

import { useState } from 'react';
import type { UnitSystem } from '@/types';
import { parseDimension } from '@/features/cut-lists/domain/parts';
import { layoutDimension } from '../domain/units';

export function LayoutDimensionInput({ value, units, onChange, label, className = '' }: {
  value: number; units: UnitSystem; onChange: (value: number) => void; label: string; className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = String(Number(layoutDimension(value, 'in', units).toFixed(units === 'mm' ? 3 : 5)));
  return <input className={className} aria-label={`${label} (${units})`}
    inputMode={units === 'mm' ? 'decimal' : 'text'} value={draft ?? formatted}
    onFocus={() => setDraft(formatted)} onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      if (draft !== null && draft !== formatted) {
        const mm = parseDimension(draft, units);
        if (mm !== null && Number.isFinite(mm)) onChange(layoutDimension(mm, 'mm', 'in'));
      }
      setDraft(null);
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') setDraft(null);
    }} />;
}
