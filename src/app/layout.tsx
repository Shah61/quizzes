import type { Metadata, Viewport } from 'next';
import { Outfit, Bebas_Neue } from 'next/font/google';
import './globals.css';

// Both are self-hosted by next/font at build time, so the deployed app makes no
// external font requests at runtime.
const body = Outfit({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Quiz Arena',
  description:
    'A two-team quiz game show — anime, Minecraft, Terraria, Marvel, music, Malaysia, plus a head-to-head Japanese duel.',
};

export const viewport: Viewport = {
  themeColor: '#07070e',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
