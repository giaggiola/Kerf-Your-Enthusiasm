import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { cuts, projects } from '@/db/schema';
import { getSession, unauthorized } from '@/lib/session';
import {
  partToStorage,
  validateDocument,
  type PartsDocument,
} from '@/features/cut-lists/domain/parts';

function isDocument(
  value: unknown,
): value is PartsDocument & { updatedAt: string } {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.name === 'string' &&
    typeof data.updatedAt === 'string' &&
    Number.isFinite(Date.parse(data.updatedAt)) &&
    Array.isArray(data.parts) &&
    data.parts.length <= 10000 &&
    data.parts.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        ['id', 'name', 'material', 'group'].every(
          (key) => typeof p[key] === 'string',
        ) &&
        ['quantity', 'length', 'width', 'thickness'].every(
          (key) => typeof p[key] === 'number',
        ),
    )
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (!isDocument(body))
    return NextResponse.json({ error: 'Invalid parts list.' }, { status: 400 });
  const error = validateDocument(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const [project] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
      .for('update');
    if (!project) return { error: 'Cut list not found.', status: 404 };
    if (project.updatedAt.getTime() !== new Date(body.updatedAt).getTime()) {
      return {
        error:
          'This cut list changed elsewhere. Your draft is kept in this browser. Reload the saved list before replacing those changes.',
        status: 409,
      };
    }
    const previous = await tx.select().from(cuts).where(eq(cuts.projectId, id));
    const byId = new Map(previous.map((part) => [part.id, part]));
    // Source references belong to the imported part, and cannot be supplied by a manual row.
    const incoming = body.parts.map((part) => {
      const stored = partToStorage(part, project.units === 'mm' ? 'mm' : 'in');
      const old = byId.get(part.id);
      return {
        id: stored.id,
        projectId: id,
        label: stored.label,
        length: stored.l,
        width: stored.w,
        thickness: stored.t,
        quantity: stored.qty,
        material: stored.mat,
        groupName: stored.group,
        stepFileId: old?.stepFileId ?? null,
        stepSessionId: old?.stepSessionId ?? null,
        stepBodyIndex: old?.stepBodyIndex ?? null,
        stepFaceIndex: old?.stepFaceIndex ?? null,
      };
    });
    // Refuse IDs belonging to another list instead of relying on a primary-key failure.
    if (incoming.length) {
      const occupied = await tx
        .select({ projectId: cuts.projectId })
        .from(cuts)
        .where(
          inArray(
            cuts.id,
            incoming.map((part) => part.id),
          ),
        );
      if (occupied.some((part) => part.projectId !== id))
        return { error: 'Invalid part identity.', status: 400 };
    }
    const geometryChanged =
      previous.length !== incoming.length ||
      incoming.some((part) => {
        const old = byId.get(part.id);
        return (
          !old ||
          old.quantity !== part.quantity ||
          old.material !== part.material ||
          old.groupName !== part.groupName ||
          Math.abs(old.length - part.length) > 1e-9 ||
          Math.abs(old.width - part.width) > 1e-9 ||
          Math.abs((old.thickness ?? 0) - part.thickness) > 1e-9
        );
      });
    const updatedAt = new Date();
    await tx
      .update(projects)
      .set({
        name: body.name.trim(),
        updatedAt,
        ...(geometryChanged
          ? {
              layoutHasActive: false,
              layoutOverrides: '{}',
              layoutExcludedKeys: '[]',
            }
          : {}),
      })
      .where(eq(projects.id, id));
    await tx.delete(cuts).where(eq(cuts.projectId, id));
    if (incoming.length)
      await tx
        .insert(cuts)
        .values(incoming.map((part, sortOrder) => ({ ...part, sortOrder })));
    return { updatedAt: updatedAt.toISOString(), status: 200 };
  });
  return NextResponse.json(result, { status: result.status });
}
