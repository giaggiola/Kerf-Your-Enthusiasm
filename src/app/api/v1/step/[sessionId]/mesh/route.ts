import { NextRequest } from 'next/server';

import { FASTAPI, readJsonResponse, stepBackendUnavailable } from '../../_utils';
import { getSession, unauthorized } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { sessionId } = await params;
  try {
    const upstream = await fetch(`${FASTAPI}/session/${sessionId}/mesh`);
    return readJsonResponse(upstream, 'Mesh fetch failed');
  } catch {
    return stepBackendUnavailable('STEP backend unavailable');
  }
}
