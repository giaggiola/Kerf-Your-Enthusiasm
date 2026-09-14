import type { Metadata } from 'next';
import { CutListLibrary } from '@/features/cut-lists/components/CutListLibrary';
export const metadata: Metadata = { title: 'Cut lists' };
export default function CutListsPage() {
  return <CutListLibrary />;
}
