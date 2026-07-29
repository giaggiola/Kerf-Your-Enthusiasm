'use client';

import { UnitSystem } from '@/types';

interface Props {
  value: UnitSystem;
  onChange: (u: UnitSystem) => void;
}

export function UnitToggle({ value, onChange }: Props) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-[var(--line)] bg-white text-xs">
      {(['in', 'mm'] as UnitSystem[]).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`px-2.5 py-2 font-medium transition-colors ${
            value === u ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-black/[0.03]'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
