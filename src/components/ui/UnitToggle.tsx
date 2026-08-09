'use client';

import { UnitSystem } from '@/types';

interface Props {
  value: UnitSystem;
  onChange: (u: UnitSystem) => void;
  compact?: boolean;
}

export function UnitToggle({ value, onChange, compact = false }: Props) {
  return (
    <div className={`flex overflow-hidden border border-[var(--line)] bg-white text-xs ${compact ? 'rounded-md' : 'rounded-lg'}`}>
      {(['in', 'mm'] as UnitSystem[]).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'} font-medium transition-colors ${
            value === u ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-black/[0.03]'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
