import type { Metadata, Viewport } from 'next';
import { Outfit, Bebas_Neue, Bungee, Orbitron, Cinzel_Decorative, Metal_Mania } from 'next/font/google';
import './globals.css';
import VolumeControl from '@/components/VolumeControl';

// All self-hosted by next/font at build time, so the deployed app makes no
// external font requests at runtime.
//
// Four display faces rather than one, because each round picks the one that
// suits it (see game/theme.ts) and the game should not look the same from the
// buzzer round to the map round. Four is the ceiling — every extra family is
// real weight on the wire for a decorative return.
const body = Outfit({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
/** Condensed caps. The house face. */
const display = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
/** Fat and loud, for the rounds with a klaxon in them. */
const impact = Bungee({ subsets: ['latin'], weight: '400', variable: '--font-impact', display: 'swap' });
/** Squared-off and technical, for the ones the machine scores. */
const tech = Orbitron({ subsets: ['latin'], weight: ['600', '900'], variable: '--font-tech', display: 'swap' });
/** Engraved, for money on the table. */
const serif = Cinzel_Decorative({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-serif', display: 'swap' });
/** Spiked blackletter — the anime-poster face the hero headings are set in. */
const blade = Metal_Mania({ subsets: ['latin'], weight: '400', variable: '--font-blade', display: 'swap' });

export const metadata: Metadata = {
  title: 'Quiz Arena',
  description:
    'A two-team quiz game show — anime, Minecraft, Terraria, Marvel, music, Malaysia, plus a head-to-head Japanese duel.',
};

export const viewport: Viewport = {
  themeColor: '#08080d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${impact.variable} ${tech.variable} ${serif.variable} ${blade.variable}`}
    >
      <body>
        {children}
        {/* Outside the routes so the room's level survives every navigation.
            Every screen keeps its own exit in the left rail, so this corner
            stays clear. */}
        <VolumeControl />
      </body>
    </html>
  );
}
