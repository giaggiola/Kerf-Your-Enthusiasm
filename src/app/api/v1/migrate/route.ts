import { NextRequest, NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/lib/session';
import { db } from '@/db';
import { projects, stocks, cuts } from '@/db/schema';

interface LocalStock {
  name: string;
  l: number;
  w: number;
  qty: number;
  mat: string;
}

interface LocalCut {
  label: string;
  l: number;
  w: number;
  qty: number;
  mat: string;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const localStocks: LocalStock[] = body.stocks || [];
  const localCuts: LocalCut[] = body.cuts || [];

  let projectId: string | null = null;

  // Create a project for imported stocks/cuts if any exist
  if (localStocks.length > 0 || localCuts.length > 0) {
    const [project] = await db
      .insert(projects)
      .values({
        userId: session.user.id,
        name: 'Imported from Browser',
        description: 'Automatically imported from your browser storage',
        kerf: 0.125,
      })
      .returning();

    projectId = project.id;

    // Import stocks
    if (localStocks.length > 0) {
      await db.insert(stocks).values(
        localStocks.map((s, i) => ({
          projectId: project.id,
          name: s.name,
          length: s.l,
          width: s.w,
          quantity: s.qty,
          material: s.mat,
          sortOrder: i,
        }))
      );
    }

    // Import cuts
    if (localCuts.length > 0) {
      await db.insert(cuts).values(
        localCuts.map((c, i) => ({
          projectId: project.id,
          label: c.label,
          length: c.l,
          width: c.w,
          quantity: c.qty,
          material: c.mat || '',
          sortOrder: i,
        }))
      );
    }
  }

  return NextResponse.json({
    success: true,
    projectId,
    imported: {
      stocks: localStocks.length,
      cuts: localCuts.length,
    },
  });
}
