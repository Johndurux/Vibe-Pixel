import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Vibe Pixel Wall',
  description: 'Papan pixel 100x100 untuk karyamu: klaim sel, catat, dan tampilkan.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body
        className={`${spaceGrotesk.className} ${inter.className} ${jetbrainsMono.className} antialiased`}
        style={{ fontFamily: `var(--font-space-grotesk), var(--font-inter), system-ui, sans-serif` }}
      >
        {children}
      </body>
    </html>
  );
}
