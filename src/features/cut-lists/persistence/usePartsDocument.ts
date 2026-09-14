'use client';

import { useEffect, useState } from 'react';
import {
  createCutList,
  documentFromProject,
  fetchProject,
  saveParts,
} from './repository';
import {
  validateDocument,
  type Part,
  type PartsDocument,
} from '../domain/parts';

const emptyDocument: PartsDocument = { name: 'Untitled cut list', parts: [] };
type Draft = { document: PartsDocument; updatedAt: string; dirty: boolean };
const draftKey = (id?: string) => `kerf-parts-draft:${id ?? 'new'}`;

function readDraft(id?: string): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null');
    return value &&
      typeof value.document?.name === 'string' &&
      Array.isArray(value.document.parts) &&
      !validateDocument({ ...value.document, name: 'Draft' })
      ? value
      : null;
  } catch {
    return null;
  }
}

export function usePartsDocument(id?: string) {
  const [draft, setDraft] = useState<Draft>({
    document: emptyDocument,
    updatedAt: '',
    dirty: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      setLoadFailed(false);
      try {
        const local = readDraft(id);
        if (id) {
          const project = await fetchProject(id, controller.signal);
          if (controller.signal.aborted) return;
          if (local?.dirty) {
            setDraft(local);
            if (local.updatedAt !== project.updatedAt)
              setError(
                'The saved list changed while this browser had a draft. Reload the saved list to review the latest parts.',
              );
          } else
            setDraft({
              document: documentFromProject(project),
              updatedAt: project.updatedAt,
              dirty: false,
            });
        } else
          setDraft(
            local ?? { document: emptyDocument, updatedAt: '', dirty: false },
          );
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error ? e.message : 'Could not load this cut list.',
          );
          setLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [id, reload]);

  useEffect(() => {
    if (loading || loadFailed) return;
    try {
      localStorage.setItem(draftKey(id), JSON.stringify(draft));
    } catch {
      setError(
        'Browser draft storage is unavailable. Save your changes before leaving.',
      );
    }
  }, [draft, id, loading, loadFailed]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!draft.dirty) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [draft.dirty]);

  function change(document: PartsDocument) {
    setDraft((previous) => ({ ...previous, document, dirty: true }));
  }

  async function save(): Promise<string | null> {
    const error = validateDocument(draft.document);
    if (error) {
      setError(error);
      return null;
    }
    setSaving(true);
    setError('');
    try {
      if (id) {
        if (!draft.dirty) return id;
        const saved = await saveParts(id, draft.document, draft.updatedAt);
        const next = { ...draft, dirty: false, updatedAt: saved.updatedAt };
        try {
          localStorage.setItem(draftKey(id), JSON.stringify(next));
        } catch {
          /* Server save succeeded. */
        }
        setDraft(next);
        return id;
      }
      const created = await createCutList(draft.document);
      try {
        localStorage.removeItem(draftKey());
      } catch {
        /* Server save succeeded. */
      }
      return created.id;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save this cut list.',
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  function reloadSaved() {
    // Keep a recoverable copy when the user chooses the newer server version.
    const existing = localStorage.getItem(draftKey(id));
    if (existing) localStorage.setItem(`${draftKey(id)}:previous`, existing);
    localStorage.removeItem(draftKey(id));
    setReload((value) => value + 1);
  }

  function updatePart(part: Part) {
    setDraft((previous) => {
      const parts = previous.document.parts;
      return {
        ...previous,
        dirty: true,
        document: {
          ...previous.document,
          parts: parts.some((row) => row.id === part.id)
            ? parts.map((row) => row.id === part.id ? part : row)
            : [...parts, part],
        },
      };
    });
  }

  return {
    ...draft,
    loading,
    saving,
    error,
    loadFailed,
    change,
    save,
    reloadSaved,
    updatePart,
    setError,
  };
}
