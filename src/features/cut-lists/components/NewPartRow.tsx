'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createId } from '@/lib/id';
import type { UnitSystem } from '@/types';
import { parseDimension, validateDocument, type Part } from '../domain/parts';
import { fieldLabels, isDimension, partFields, type PartField } from '../domain/inline-parts';

export const fieldClass: Record<PartField, string> = {
  name: 'parts-name', quantity: 'parts-quantity', length: 'parts-dimension parts-length',
  width: 'parts-dimension parts-width', thickness: 'parts-dimension parts-thickness', material: 'parts-material',
};

export function NewPartRow({ units, onAdd, onCancel }: {
  units: UnitSystem; onAdd: (part: Part) => void; onCancel: () => void;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  useEffect(() => { nameInput.current?.focus(); }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!/^\d+$/.test(String(data.get('quantity')).trim())) {
      setError('Quantity must be a positive whole number.');
      return;
    }
    const part: Part = {
      id: createId(), name: String(data.get('name')).trim(), quantity: Number(data.get('quantity')),
      length: parseDimension(String(data.get('length')), units) ?? -1,
      width: parseDimension(String(data.get('width')), units) ?? -1,
      thickness: parseDimension(String(data.get('thickness') || '0'), units) ?? -1,
      material: String(data.get('material')).trim(), group: '',
    };
    const problem = validateDocument({ name: 'Parts', parts: [part] });
    if (problem) { setError(problem); return; }
    onAdd(part);
  }
  return (
    <>
      <tr className="parts-new-row" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
      }}>
        {partFields.map((field) => (
          <td key={field} className={fieldClass[field]}>
            <span className="parts-mobile-label" aria-hidden="true">{fieldLabels[field]}</span>
            <input
              ref={field === 'name' ? nameInput : undefined}
              className="part-cell-input" form="new-inline-part" name={field}
              aria-label={`New part ${fieldLabels[field].toLowerCase()}`}
              defaultValue={field === 'quantity' ? '1' : ''}
              placeholder={field === 'name' ? 'Part name' : field === 'material' || field === 'thickness' ? 'Optional' : ''}
              inputMode={field === 'quantity' ? 'numeric' : isDimension(field) && units === 'mm' ? 'decimal' : 'text'}
              maxLength={200} required={!['thickness', 'material'].includes(field)}
              list={field === 'material' ? 'inline-part-materials' : undefined}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
              }}
            />
          </td>
        ))}
        <td className="parts-row-actions">
          <form id="new-inline-part" onSubmit={submit}>
            <button type="submit" className="parts-text-button" aria-label="Add this part">Add</button>
            <button type="button" className="parts-remove-button" onClick={onCancel} aria-label="Cancel new part">×</button>
          </form>
        </td>
      </tr>
      {error && <tr className="parts-row-notice"><td colSpan={7}><p role="alert">{error}</p></td></tr>}
    </>
  );
}
