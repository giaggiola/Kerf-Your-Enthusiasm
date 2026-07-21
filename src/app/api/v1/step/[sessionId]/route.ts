import { NextRequest } from 'next/server';

import { FASTAPI, readJsonResponse, stepBackendUnavailable } from '../_utils';
import { getSession, unauthorized } from '@/lib/session';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { sessionId } = await params;
  try {
    const upstream = await fetch(`${FASTAPI}/session/${sessionId}`, { method: 'DELETE' });
    return readJsonResponse(upstream, 'Failed to delete STEP session');
  } catch {
    return stepBackendUnavailable('STEP backend unavailable');
  }
}
