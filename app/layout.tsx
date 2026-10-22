import type { Metadata, Viewport } from 'next';
import { Anton, Archivo_Black, Space_Mono, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const anton = Anton({ subsets: ['latin'], weight: ['400'], display: 'swap', variable: '--font-anton' });
const archivoBlack = Archivo_Black({ subsets: ['latin'], weight: ['400'], display: 'swap', variable: '--font-archivo-black' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], display: 'swap', variable: '--font-space-mono' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], display: 'swap', variable: '--font-jetbrains-mono' });

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
    <html lang="id">
      <body
        className={`${anton.variable} ${archivoBlack.variable} ${spaceMono.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: `var(--font-inter), system-ui, sans-serif` }}
      >
        {children}
      </body>
    </html>
  );
}
