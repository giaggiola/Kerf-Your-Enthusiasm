'use client';

import { createId } from '@/lib/id';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { convertDim } from '@/lib/unit-utils';
import type { UnitSystem } from '@/types';
import { parseDimension, validateDocument, type Part } from '../domain/parts';

export function PartEditor({
  part,
  units,
  onSave,
  onClose,
  onSource,
}: {
  part?: Part;
  units: UnitSystem;
  onSave: (part: Part) => void;
  onClose: () => void;
  onSource?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const imported = !!part?.source;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const dim = (value: number | undefined) =>
    value ? String(Number(convertDim(value, 'mm', units).toPrecision(12))) : '';
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Part = {
      id: part?.id ?? createId(),
      name: String(form.get('name')).trim(),
      quantity: Number(form.get('quantity')),
      length:
        part && (imported || String(form.get('length')) === dim(part.length))
          ? part.length
          : (parseDimension(String(form.get('length')), units) ?? -1),
      width:
        part && (imported || String(form.get('width')) === dim(part.width))
          ? part.width
          : (parseDimension(String(form.get('width')), units) ?? -1),
      thickness:
        part &&
        (imported || String(form.get('thickness')) === dim(part.thickness))
          ? part.thickness
          : (parseDimension(String(form.get('thickness') || '0'), units) ?? -1),
      material: String(form.get('material')).trim(),
      group: String(form.get('group') ?? '').trim(),
      source: part?.source,
    };
    const problem = validateDocument({ name: 'Parts', parts: [next] });
    if (problem) {
      setError(problem);
      return;
    }
    onSave(next);
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      className="part-dialog"
      aria-labelledby="part-editor-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form onSubmit={submit} className="part-editor">
        <div className="parts-dialog-heading">
          <h2 id="part-editor-title">{part ? 'Edit part' : 'Add part'}</h2>
          <button
            type="button"
            className="parts-icon-button"
            onClick={onClose}
            aria-label="Close part editor"
          >
            ×
          </button>
        </div>
        <label className="parts-field">
          Name
          <input
            name="name"
            defaultValue={part?.name ?? ''}
            autoFocus
            required
            maxLength={200}
            placeholder="e.g. Shelf"
          />
        </label>
        <div className="parts-form-dimensions">
          <label className="parts-field">
            Length ({units})
            <input
              name="length"
              defaultValue={dim(part?.length)}
              inputMode={units === 'mm' ? 'decimal' : 'text'}
              readOnly={imported}
              required
            />
          </label>
          <label className="parts-field">
            Width ({units})
            <input
              name="width"
              defaultValue={dim(part?.width)}
              inputMode={units === 'mm' ? 'decimal' : 'text'}
              readOnly={imported}
              required
            />
          </label>
          <label className="parts-field">
            Thickness ({units})
            <input
              name="thickness"
              defaultValue={dim(part?.thickness)}
              inputMode={units === 'mm' ? 'decimal' : 'text'}
              readOnly={imported}
              placeholder="Optional"
            />
          </label>
        </div>
        <div className="parts-form-pair">
          <label className="parts-field">
            Quantity
            <input
              name="quantity"
              type="number"
              min="1"
              step="1"
              defaultValue={part?.quantity ?? 1}
              required
            />
          </label>
          <label className="parts-field">
            Material
            <input
              name="material"
              list="part-materials"
              defaultValue={part?.material ?? ''}
              placeholder="Unspecified"
              maxLength={200}
            />
          </label>
        </div>
        <datalist id="part-materials">
          <option value="Plywood" />
          <option value="MDF" />
          <option value="Oak" />
          <option value="Walnut" />
          <option value="Pine" />
        </datalist>
        <details className="parts-details" open={!!part?.group || imported}>
          <summary>Details</summary>
          <label className="parts-field">
            Assembly group
            <input
              name="group"
              defaultValue={part?.group ?? ''}
              placeholder="Optional"
              maxLength={200}
            />
          </label>
          {imported && (
            <div className="parts-source">
              <p>{part.source?.filename || 'Imported 3D model'}</p>
              <p>Dimensions follow the selected CAD face.</p>
              <button
                type="button"
                className="parts-text-button"
                onClick={onSource}
              >
                Review source →
              </button>
            </div>
          )}
        </details>
        {error && (
          <p className="parts-error" role="alert">
            {error}
          </p>
        )}
        <div className="parts-dialog-actions">
          <button type="button" className="parts-text-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="app-button-primary">
            {part ? 'Apply changes' : 'Add part'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
