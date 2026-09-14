import type { Metadata } from 'next';
import { PartsWorkspace } from '@/features/cut-lists/components/PartsWorkspace';
export const metadata: Metadata = { title: 'New cut list' };
export default function NewCutListPage() {
  return <PartsWorkspace />;
}
