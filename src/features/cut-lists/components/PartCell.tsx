'use client';

import { useRef, useState } from 'react';
import type { UnitSystem } from '@/types';
import type { Part } from '../domain/parts';
import { editPartField, fieldLabels, isDimension, partFieldText, type PartField } from '../domain/inline-parts';

export function PartCell({ part, field, units, disabled, onChange, onValidity }: {
  part: Part; field: PartField; units: UnitSystem; disabled: boolean;
  onChange: (part: Part) => void;
  onValidity: (field: PartField, invalid: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const original = useRef(part[field]);
  const readOnly = !!part.source && isDimension(field);
  const label = `${fieldLabels[field]} for ${part.name}`;
  const errorId = `${part.id}-${field}-error`;

  return (
    <div className="part-cell">
      <span className="parts-mobile-label" aria-hidden="true">{fieldLabels[field]}</span>
      <input
        className="part-cell-input"
        aria-label={label}
        title={readOnly ? 'Dimensions follow the CAD source.' : `${partFieldText(part, field, units)}${isDimension(field) ? ` ${units}` : ''}`}
        value={editing || error ? text : partFieldText(part, field, units)}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        inputMode={field === 'quantity' ? 'numeric' : isDimension(field) && units === 'mm' ? 'decimal' : 'text'}
        maxLength={200}
        list={field === 'material' ? 'inline-part-materials' : undefined}
        onFocus={() => {
          original.current = part[field];
          if (!error) setText(partFieldText(part, field, units));
          setEditing(true);
        }}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          const result = editPartField(part, field, value, units);
          setError(result.error ?? '');
          onValidity(field, !!result.error);
          if (result.part) onChange(result.part);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            const restored = { ...part, [field]: original.current };
            if (restored[field] !== part[field]) onChange(restored);
            setText(partFieldText(restored, field, units));
            setError('');
            onValidity(field, false);
            event.currentTarget.blur();
          }
        }}
      />
      {error && <span className="part-cell-error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}
