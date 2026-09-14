'use client';

import { useEffect, useRef, useState } from 'react';
import type { UnitSystem } from '@/types';
import type { Part } from '../domain/parts';
import { fieldLabels, partFields, type PartField } from '../domain/inline-parts';
import { PartCell } from './PartCell';
import { NewPartRow, fieldClass } from './NewPartRow';

export function PartsTable({ parts, units, disabled, onEdit, onChange, onRemove, onBlockedChange }: {
  parts: Part[]; units: UnitSystem; disabled: boolean;
  onEdit: (part: Part) => void; onChange: (part: Part) => void; onRemove: (part: Part) => void;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const addButton = useRef<HTMLButtonElement>(null);
  const blocked = adding || invalid.size > 0;
  useEffect(() => { onBlockedChange(blocked); }, [blocked, onBlockedChange]);

  function validity(part: Part, field: PartField, hasError: boolean) {
    setInvalid((current) => {
      const next = new Set(current);
      const key = `${part.id}:${field}`;
      if (hasError) next.add(key); else next.delete(key);
      return next;
    });
  }
  function finishAdding(part?: Part) {
    if (part) onChange(part);
    setAdding(false);
    requestAnimationFrame(() => addButton.current?.focus());
  }

  return (
    <div className="parts-table-scroll">
      <table className="parts-table parts-inline-table">
        <caption className="sr-only">Editable parts to cut. Dimensions in {units === 'mm' ? 'millimetres' : 'inches'}.</caption>
        <thead><tr>
          {partFields.map((field) => <th key={field} scope="col" className={fieldClass[field]}>{field === 'quantity' ? 'Qty' : fieldLabels[field]}</th>)}
          <th scope="col"><span className="sr-only">Actions</span></th>
        </tr></thead>
        <tbody>
          {parts.map((part) => (
            <tr key={part.id} data-part-id={part.id}>
              {partFields.map((field) => (
                <td key={field} className={fieldClass[field]}>
                  <PartCell key={`${field}:${units}`} part={part} field={field} units={units} disabled={disabled}
                    onChange={onChange} onValidity={(field, error) => validity(part, field, error)} />
                  {field === 'name' && part.source && <span className="part-source-label" title={part.source.filename}>3D</span>}
                </td>
              ))}
              <td className="parts-row-actions">
                <button type="button" className="parts-text-button" disabled={disabled || invalid.size > 0}
                  onClick={() => onEdit(part)} aria-label={`Details for ${part.name}`} title="Group and source details">···</button>
                <button type="button" className="parts-remove-button" disabled={disabled}
                  onClick={() => {
                    setInvalid((current) => new Set([...current].filter((key) => !key.startsWith(`${part.id}:`))));
                    onRemove(part);
                  }} aria-label={`Remove ${part.name}`} title="Remove part">×</button>
              </td>
            </tr>
          ))}
          {adding ? <NewPartRow units={units} onAdd={finishAdding} onCancel={() => finishAdding()} /> : (
            <tr className="parts-add-row"><td colSpan={7}>
              <button ref={addButton} type="button" disabled={disabled} onClick={() => setAdding(true)}>+ Add part</button>
            </td></tr>
          )}
        </tbody>
      </table>
      <datalist id="inline-part-materials">
        {['Plywood', 'Baltic Birch', 'MDF', 'Oak', 'Walnut', 'Pine'].map((value) => <option key={value} value={value} />)}
      </datalist>
    </div>
  );
}
