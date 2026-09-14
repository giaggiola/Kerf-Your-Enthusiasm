import type { Metadata } from 'next';
import { PartsWorkspace } from '@/features/cut-lists/components/PartsWorkspace';
export const metadata: Metadata = { title: 'Parts' };
export default async function PartsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PartsWorkspace key={id} id={id} />;
}
