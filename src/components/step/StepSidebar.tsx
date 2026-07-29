'use client';

import { useState } from 'react';
import { StepBodyRow, StepBody } from './StepBodyRow';

export interface BodyState {
  body: StepBody;
  name: string;
  included: boolean;
  confirmed: boolean; // user explicitly selected a face for this body
}

interface Props {
  bodyStates: BodyState[];
  selectedIndex: number;
  onSelect: (idx: number) => void;
  onToggle: (idx: number) => void;
  onRename: (idx: number, name: string) => void;
  onConfirmAll: () => void;
}

// ── Tree types ────────────────────────────────────────────────────────────────

type BodyNode = { type: 'body'; stateIdx: number };
type FolderNode = { type: 'folder'; name: string; pathKey: string; children: TreeNode[] };
type TreeNode = BodyNode | FolderNode;

function buildTree(bodyStates: BodyState[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const folderByPath = new Map<string, FolderNode>();

  for (let i = 0; i < bodyStates.length; i++) {
    const path = bodyStates[i].body.folder_path;
    let children = roots;
    let pathKey = '';

    for (const segment of path) {
      pathKey += '/' + segment;
      if (!folderByPath.has(pathKey)) {
        const folder: FolderNode = { type: 'folder', name: segment, pathKey, children: [] };
        folderByPath.set(pathKey, folder);
        children.push(folder);
      }
      children = folderByPath.get(pathKey)!.children;
    }

    children.push({ type: 'body', stateIdx: i });
  }

  return roots;
}

// ── FolderRow ─────────────────────────────────────────────────────────────────

function FolderRow({
  node, depth, bodyStates, selectedIndex, expanded, onToggleExpand,
  onSelect, onToggle, onRename,
}: {
  node: FolderNode; depth: number; bodyStates: BodyState[]; selectedIndex: number;
  expanded: boolean; onToggleExpand: () => void;
  onSelect: (idx: number) => void; onToggle: (idx: number) => void; onRename: (idx: number, name: string) => void;
}) {
  return (
    <>
      <div
        className="flex cursor-pointer select-none items-center gap-1.5 py-2 text-[var(--muted)] hover:bg-black/[0.025]"
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={onToggleExpand}
      >
        <span className="w-3 shrink-0 text-xs">{expanded ? '▾' : '▸'}</span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-[#bd754b]"
          fill="currentColor" viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span className="truncate text-xs font-semibold">{node.name}</span>
      </div>
      {expanded && (
        <TreeLevel
          nodes={node.children} depth={depth + 1} bodyStates={bodyStates}
          selectedIndex={selectedIndex} onSelect={onSelect} onToggle={onToggle} onRename={onRename}
        />
      )}
    </>
  );
}

// ── TreeLevel ─────────────────────────────────────────────────────────────────

function TreeLevel({
  nodes, depth, bodyStates, selectedIndex, onSelect, onToggle, onRename,
}: {
  nodes: TreeNode[]; depth: number; bodyStates: BodyState[]; selectedIndex: number;
  onSelect: (idx: number) => void; onToggle: (idx: number) => void; onRename: (idx: number, name: string) => void;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(nodes.filter((n) => n.type === 'folder').map((n) => (n as FolderNode).pathKey))
  );

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'body') {
          const bs = bodyStates[node.stateIdx];
          return (
            <div key={`body-${node.stateIdx}`} style={{ paddingLeft: `${depth * 14}px` }}>
              <StepBodyRow
                included={bs.included} name={bs.name} confirmed={bs.confirmed}
                selected={node.stateIdx === selectedIndex}
                onSelect={() => onSelect(node.stateIdx)}
                onToggle={() => onToggle(node.stateIdx)}
                onRename={(name) => onRename(node.stateIdx, name)}
              />
            </div>
          );
        }
        return (
          <FolderRow
            key={`folder-${node.pathKey}`} node={node} depth={depth} bodyStates={bodyStates}
            selectedIndex={selectedIndex} expanded={expandedFolders.has(node.pathKey)}
            onToggleExpand={() => toggleFolder(node.pathKey)}
            onSelect={onSelect} onToggle={onToggle} onRename={onRename}
          />
        );
      })}
    </>
  );
}

// ── Main StepSidebar ──────────────────────────────────────────────────────────

export function StepSidebar({ bodyStates, selectedIndex, onSelect, onToggle, onRename, onConfirmAll }: Props) {
  const includedCount = bodyStates.filter((b) => b.included).length;
  const confirmedCount = bodyStates.filter((b) => b.included && b.confirmed).length;
  const progress = includedCount > 0 ? Math.round((confirmedCount / includedCount) * 100) : 0;
  const tree = buildTree(bodyStates);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-[var(--line)] px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--ink)]">Assembly parts</p>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">{includedCount} of {bodyStates.length} included</p>
          </div>
          <button
            onClick={onConfirmAll}
            className="text-[11px] font-semibold text-[var(--accent-dark)] hover:underline"
          >
            Confirm all
          </button>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-[var(--muted)]">
            <span>Faces confirmed</span>
            <span>{confirmedCount}/{includedCount}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e6e8e3]">
            <div className="h-full rounded-full bg-[var(--success)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        <TreeLevel
          nodes={tree} depth={0} bodyStates={bodyStates} selectedIndex={selectedIndex}
          onSelect={onSelect} onToggle={onToggle} onRename={onRename}
        />
      </div>
    </div>
  );
}
