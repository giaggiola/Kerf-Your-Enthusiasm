import type { Metadata } from 'next';
import './globals.css';
import { AppChrome } from '@/components/AppChrome';
import { MigrationPrompt } from '@/components/migration/MigrationPrompt';

export const metadata: Metadata = {
  title: 'Kerf — Cut Planning Studio',
  description: 'Turn CAD parts and cut lists into efficient, shop-ready sheet layouts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppChrome>{children}</AppChrome>
        <MigrationPrompt />
      </body>
    </html>
  );
}
