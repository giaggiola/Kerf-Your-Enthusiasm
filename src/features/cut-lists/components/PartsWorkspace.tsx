'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { UnitSystem } from '@/types';
import { partToStorage, type Part } from '../domain/parts';
import { usePartsDocument } from '../persistence/usePartsDocument';
import { PartEditor } from './PartEditor';
import { PartsTable } from './PartsTable';

export function PartsWorkspace({ id }: { id?: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const state = usePartsDocument(id);
  const [units, setUnits] = useLocalStorage<UnitSystem>(
    'kerf-parts-display-unit',
    'mm',
  );
  const [editor, setEditor] = useState<Part | null>(null);
  const [tableBlocked, setTableBlocked] = useState(false);
  const [removed, setRemoved] = useState<{ part: Part; index: number } | null>(
    null,
  );
  const count = state.document.parts.reduce(
    (sum, part) => sum + part.quantity,
    0,
  );

  async function saveAndOpen(
    destination: 'parts' | 'step' | 'layout',
    source?: Part['source'],
  ) {
    if (!session) {
      if (destination === 'layout') {
        try {
          localStorage.setItem(
            'kerf-your-enthusiasm-cuts',
            JSON.stringify(
              state.document.parts.map((part, index) => ({
                ...partToStorage(part, 'in'),
                id: index + 1,
              })),
            ),
          );
          router.push('/cut-list/layout');
        } catch {
          state.setError(
            'Browser storage is unavailable. Log in to save this cut list.',
          );
        }
      } else {
        const callback = id ? `/projects/${id}` : '/cut-list/new';
        router.push(`/login?callbackUrl=${encodeURIComponent(callback)}`);
      }
      return;
    }
    const savedId = await state.save();
    if (!savedId) return;
    const query = source?.fileId
      ? `?file=${encodeURIComponent(source.fileId)}&body=${source.bodyIndex ?? 0}`
      : '';
    router.push(
      `/projects/${savedId}${destination === 'parts' ? '' : `/${destination}`}${query}`,
    );
  }

  function remove(part: Part) {
    setRemoved({
      part,
      index: state.document.parts.findIndex((row) => row.id === part.id),
    });
    state.change({
      ...state.document,
      parts: state.document.parts.filter((row) => row.id !== part.id),
    });
  }
  function undoRemove() {
    if (!removed) return;
    const parts = [...state.document.parts];
    parts.splice(removed.index, 0, removed.part);
    state.change({ ...state.document, parts });
    setRemoved(null);
  }
  function downloadDraft() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state.document, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kerf-parts-draft.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (state.loading)
    return (
      <p className="parts-loading" role="status">
        Loading cut list…
      </p>
    );
  if (state.loadFailed)
    return (
      <div className="parts-page">
        <p role="alert">{state.error}</p>
        <button className="parts-text-button" onClick={state.reloadSaved}>
          Try again
        </button>
        <Link className="parts-back" href="/cut-list">
          ← Cut lists
        </Link>
      </div>
    );

  return (
    <div className="parts-page">
      <Link href="/cut-list" className="parts-back">
        ← Cut lists
      </Link>
      <header className="parts-page-header">
        <div className="parts-title-wrap">
          <h1>
            <input
              className="parts-title"
              aria-label="Cut list name"
              value={state.document.name}
              maxLength={200}
              disabled={state.saving}
              onChange={(e) =>
                state.change({ ...state.document, name: e.target.value })
              }
            />
          </h1>
          <span className="parts-save-status" role="status">
            {state.saving ? 'Saving…' : state.dirty || !id ? 'Draft' : 'Saved'}
          </span>
        </div>
        <div className="parts-header-actions">
          {(state.dirty || !id) && (
            <button
              type="button"
              className="parts-text-button"
              disabled={state.saving || isPending || tableBlocked}
              onClick={() => void saveAndOpen('parts')}
            >
              {session ? 'Save' : 'Log in to save'}
            </button>
          )}
          <button
            type="button"
            className="app-button-secondary"
            disabled={state.saving || isPending || tableBlocked || !state.document.parts.length}
            onClick={() => void saveAndOpen('layout')}
          >
            Open layout →
          </button>
        </div>
      </header>
      {state.error && (
        <div className="parts-notice" role="alert">
          <p>{state.error}</p>
          {id && (
            <div>
              <button className="parts-text-button" onClick={downloadDraft}>
                Download draft
              </button>
              <button className="parts-text-button" onClick={state.reloadSaved}>
                Load saved version
              </button>
            </div>
          )}
        </div>
      )}
      <section aria-labelledby="parts-heading">
        <div className="parts-toolbar">
          <div className="parts-toolbar-title">
            <h2 id="parts-heading">Parts</h2>
            <div
              className="parts-units"
              role="group"
              aria-label="Dimension units"
            >
              {(['mm', 'in'] as UnitSystem[]).map((unit) => (
                <button
                  type="button"
                  key={unit}
                  aria-pressed={units === unit}
                  disabled={tableBlocked}
                  onClick={() => setUnits(unit)}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
          <div className="parts-toolbar-actions">
            <button
              type="button"
              className="parts-text-button"
              disabled={state.saving || isPending || tableBlocked}
              onClick={() => void saveAndOpen('step')}
            >
              Import 3D
            </button>
          </div>
        </div>
        <PartsTable
          key={`${id ?? 'new'}:${state.updatedAt}`}
          parts={state.document.parts}
          units={units}
          disabled={state.saving}
          onEdit={setEditor}
          onChange={state.updatePart}
          onRemove={remove}
          onBlockedChange={setTableBlocked}
        />
        <div className="parts-table-footer">
          <span>
            {count} {count === 1 ? 'piece' : 'pieces'}
          </span>
          {removed && (
            <span className="parts-undo" role="status">
              Removed {removed.part.name}.{' '}
              <button
                type="button"
                className="parts-text-button"
                disabled={state.saving}
                onClick={undoRemove}
              >
                Undo
              </button>
              <button
                type="button"
                className="parts-remove-button"
                aria-label="Dismiss undo"
                onClick={() => setRemoved(null)}
              >
                ×
              </button>
            </span>
          )}
        </div>
      </section>
      {editor && (
        <PartEditor
          part={editor}
          units={units}
          onSave={state.updatePart}
          onClose={() => setEditor(null)}
          onSource={() => {
            const source = editor.source;
            setEditor(null);
            void saveAndOpen('step', source);
          }}
        />
      )}
    </div>
  );
}
