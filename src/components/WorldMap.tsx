'use client';

/**
 * The clickable world map.
 *
 * Country outlines are Natural Earth's, decoded from TopoJSON at build time
 * into plain rings of [lng, lat] (see scripts/build-world.mjs) and drawn as SVG
 * paths in an equirectangular projection. No tile server, no API key, nothing
 * loaded at play time — which also means no attribution banner to keep, since
 * Natural Earth is public domain.
 *
 * The outlines are a 165KB pack, so they are imported dynamically: only a game
 * that actually reaches the map round pays for them.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { project, unproject, type LatLng } from '@/game/geo';

interface Shape { name: string; polygons: [number, number][][] }

export interface Pin { at: LatLng; colour: string; label?: string; kind: 'guess' | 'target' }

// One shared promise: the pack is fetched once however many rounds are played.
let shapesPromise: Promise<Shape[]> | null = null;
const loadShapes = () => (shapesPromise ??= import('@/content/packs/world-map.json').then((m) => m.default as Shape[]));

/** Viewbox units. The aspect is 2:1 because equirectangular spans 360° by 180°. */
const W = 1000;
const H = 500;

export default function WorldMap({
  pins = [], lines = [], onPick, disabled = false,
}: {
  pins?: Pin[];
  /** Guess-to-target pairs, drawn once the answer is out. */
  lines?: { from: LatLng; to: LatLng; colour: string }[];
  onPick?: (at: LatLng) => void;
  disabled?: boolean;
}) {
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let live = true;
    void loadShapes().then((s) => { if (live) setShapes(s); });
    return () => { live = false; };
  }, []);

  // Path strings never change, so build them once the pack lands.
  const paths = useMemo(
    () => (shapes ?? []).map((s) => ({
      name: s.name,
      d: s.polygons
        .map((ring) => {
          // Russia and Fiji cross the 180th meridian, and in a flat projection
          // that puts consecutive points at opposite edges — joining them drew
          // a stray line straight across the map. Lift the pen instead.
          let prevLng: number | null = null;
          let started = false;
          return ring
            .map(([lng, lat]) => {
              const { x, y } = project({ lat, lng }, W, H);
              const jumped = prevLng !== null && Math.abs(lng - prevLng) > 180;
              prevLng = lng;
              const cmd = !started || jumped ? 'M' : 'L';
              started = true;
              return `${cmd}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join('') + 'Z';
        })
        .join(' '),
    })),
    [shapes],
  );

  const pick = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg || disabled || !onPick) return;
    const box = svg.getBoundingClientRect();
    // The SVG scales to its box, so work in fractions rather than pixels.
    const x = ((clientX - box.left) / box.width) * W;
    const y = ((clientY - box.top) / box.height) * H;
    onPick(unproject(x, y, W, H));
  };

  if (!shapes) return <div className="world-map world-map-loading">Loading the map…</div>;

  return (
    <svg
      ref={svgRef}
      className="world-map"
      viewBox={`0 0 ${W} ${H}`}
      role={onPick ? 'button' : 'img'}
      aria-label={onPick ? 'Click the map to place your guess' : 'World map'}
      data-live={Boolean(onPick) && !disabled}
      onClick={(e) => pick(e.clientX, e.clientY)}
    >
      <rect x={0} y={0} width={W} height={H} className="world-sea" />
      <g className="world-land">
        {paths.map((p) => <path key={p.name} d={p.d} />)}
      </g>

      {lines.map((l, i) => {
        const a = project(l.from, W, H);
        const b = project(l.to, W, H);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.colour} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.85} />;
      })}

      {pins.map((pin, i) => {
        const { x, y } = project(pin.at, W, H);
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            {pin.kind === 'target' ? (
              <>
                <circle r={9} fill="none" stroke={pin.colour} strokeWidth={2.5} />
                <circle r={3} fill={pin.colour} />
              </>
            ) : (
              <circle r={5.5} fill={pin.colour} stroke="#000" strokeWidth={1.2} />
            )}
            {pin.label && (
              <text y={-13} textAnchor="middle" className="world-pin-label" fill={pin.colour}>{pin.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
