import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vibe Pixel Wall',
  description: 'Papan pixel kolektif dengan nuansa neon & vaporwave',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
