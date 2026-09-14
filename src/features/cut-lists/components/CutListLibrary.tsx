'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { readResponse } from '../persistence/repository';

interface ListSummary {
  id: string;
  name: string;
  updatedAt: string;
  cuts: { quantity: number }[];
}

export function CutListLibrary() {
  const { data: session, isPending } = useSession();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    fetch('/api/v1/projects', { signal: controller.signal })
      .then(readResponse<ListSummary[]>)
      .then((data) => {
        if (!controller.signal.aborted) setLists(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Could not load cut lists.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session, retry]);

  return (
    <div className="parts-page cut-list-library">
      <header className="parts-page-header">
        <h1 className="parts-heading">Cut lists</h1>
        <div className="parts-header-actions">
          <Link href="/cut-list/new" className="app-button-primary">
            New cut list
          </Link>
          {session && (
            <details className="parts-library-menu">
              <summary aria-label="More cut list actions">···</summary>
              <Link href="/dashboard">Import &amp; manage project bundles</Link>
            </details>
          )}
        </div>
      </header>
      {isPending || (session && loading) ? (
        <p className="parts-loading" role="status">
          Loading cut lists…
        </p>
      ) : !session ? (
        <div className="parts-empty">
          <p>Your next cut starts here.</p>
          <span>
            Create a list, or{' '}
            <Link href="/login?callbackUrl=/cut-list">log in</Link> to open
            saved work.
          </span>
          <Link className="parts-text-button" href="/cut-list/new">
            Continue draft →
          </Link>
        </div>
      ) : error ? (
        <div className="parts-notice" role="alert">
          <p>{error}</p>
          <button
            className="parts-text-button"
            onClick={() => {
              setLoading(true);
              setError('');
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : lists.length === 0 ? (
        <div className="parts-empty">
          <p>No cut lists yet.</p>
          <span>Start with dimensions or a 3D model.</span>
        </div>
      ) : (
        <>
          {lists.length > 5 && (
            <input
              className="parts-search"
              type="search"
              aria-label="Find a cut list"
              placeholder="Find a cut list"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          )}
          <div className="cut-list-rows">
            {lists
              .filter((list) =>
                list.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .map((list) => (
                <Link
                  key={list.id}
                  href={`/projects/${list.id}`}
                  className="cut-list-row"
                >
                  <span>{list.name}</span>
                  <span className="cut-list-count">
                    {list.cuts.reduce((sum, part) => sum + part.quantity, 0)}{' '}
                    {list.cuts.reduce((sum, part) => sum + part.quantity, 0) === 1 ? 'piece' : 'pieces'}
                  </span>
                  <time dateTime={list.updatedAt}>
                    {new Date(list.updatedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </time>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
          </div>
          {filter &&
            !lists.some((list) =>
              list.name.toLowerCase().includes(filter.toLowerCase()),
            ) && <p className="parts-loading">No matching cut lists.</p>}
        </>
      )}
    </div>
  );
}
