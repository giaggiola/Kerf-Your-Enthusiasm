import type { Metadata } from 'next';
import './globals.css';
import '@/features/cut-lists/parts.css';
import { AppChrome } from '@/components/AppChrome';

export const metadata: Metadata = {
  title: { default: 'Kerf Your Entursiasm', template: '%s — Kerf' },
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
      </body>
    </html>
  );
}
