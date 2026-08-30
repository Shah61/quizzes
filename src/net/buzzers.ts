'use client';

/**
 * Online play.
 *
 * The host's browser IS the server: it opens a PeerJS peer under a short room
 * code, every player connects straight to it over WebRTC, and the host
 * broadcasts a full snapshot of the game whenever anything changes. Players
 * render from that snapshot and send back only what they did — a buzz or a
 * locked-in answer.
 *
 * This needs no backend and no database, which is what lets the whole game
 * deploy to Vercel for free.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import type { TeamId } from '@/game/types';
import { ICE_CONFIG, ROOM_PREFIX, type Player, type Snapshot, type ToHost, type ToPlayer } from './protocol';

export type { Player } from './protocol';
export type HostStatus = 'idle' | 'connecting' | 'open' | 'error';
export type PlayerStatus = 'idle' | 'connecting' | 'joined' | 'error';
export interface TeamBrief { name: string; colour: string }

// Ambiguous characters are left out so a code is easy to read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const randomCode = () =>
  Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

/* ------------------------------------------------------------------ host */

export function useGameHost(
  teams: Record<TeamId, TeamBrief>,
  onAction: (team: TeamId, action: { type: 'buzz' } | { type: 'lock'; choice: string } | { type: 'vote'; team: TeamId }, playerName: string) => void,
) {
  const [status, setStatus] = useState<HostStatus>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  // Mirrors `players` so an incoming message can resolve its sender without
  // reading state inside a setState updater (React runs those during render).
  const playersRef = useRef<Player[]>([]);
  const snapshotRef = useRef<Snapshot | null>(null);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  const open = useCallback(async () => {
    if (peerRef.current) return;
    setStatus('connecting');
    const roomCode = randomCode();
    const peer = new Peer(ROOM_PREFIX + roomCode, { config: ICE_CONFIG });
    peerRef.current = peer;

    peer.on('open', () => { setCode(roomCode); setStatus('open'); });
    peer.on('error', () => setStatus('error'));

    peer.on('connection', (conn) => {
      conn.on('open', () => { connsRef.current.set(conn.peer, conn); });

      conn.on('data', (raw) => {
        const msg = raw as ToHost;
        if (!msg?.type) return;

        if (msg.type === 'join') {
          connsRef.current.set(conn.peer, conn);
          playersRef.current = [
            ...playersRef.current.filter((p) => p.id !== conn.peer),
            { id: conn.peer, name: msg.name.slice(0, 18) || 'Player', team: msg.team },
          ];
          setPlayers(playersRef.current);
          const t = teamsRef.current;
          conn.send({
            type: 'welcome',
            teamNames: { a: t.a.name, b: t.b.name },
            teamColours: { a: t.a.colour, b: t.b.colour },
          } satisfies ToPlayer);
          // Bring the newcomer straight up to date.
          if (snapshotRef.current) conn.send({ type: 'state', snapshot: snapshotRef.current } satisfies ToPlayer);
          return;
        }

        const player = playersRef.current.find((p) => p.id === conn.peer);
        if (!player) return;
        if (msg.type === 'buzz') onActionRef.current(player.team, { type: 'buzz' }, player.name);
        if (msg.type === 'lock') onActionRef.current(player.team, { type: 'lock', choice: msg.choice }, player.name);
        if (msg.type === 'vote') onActionRef.current(player.team, { type: 'vote', team: msg.team }, player.name);
      });

      conn.on('close', () => {
        connsRef.current.delete(conn.peer);
        playersRef.current = playersRef.current.filter((p) => p.id !== conn.peer);
        setPlayers(playersRef.current);
      });
    });
  }, []);

  const close = useCallback(() => {
    connsRef.current.forEach((c) => c.close());
    connsRef.current.clear();
    peerRef.current?.destroy();
    peerRef.current = null;
    playersRef.current = [];
    snapshotRef.current = null;
    setPlayers([]);
    setCode(null);
    setStatus('idle');
  }, []);

  /** Push the current state of the game to every connected device. */
  const broadcast = useCallback((snapshot: Snapshot) => {
    snapshotRef.current = snapshot;
    connsRef.current.forEach((c) => {
      if (c.open) {
        try { c.send({ type: 'state', snapshot } satisfies ToPlayer); } catch { /* dropped frame is fine */ }
      }
    });
  }, []);

  useEffect(() => () => { peerRef.current?.destroy(); }, []);

  return { status, code, players, open, close, broadcast };
}

/* ---------------------------------------------------------------- player */

export function useGameClient() {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [brand, setBrand] = useState<{ names: Record<TeamId, string>; colours: Record<TeamId, string> } | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const peerRef = useRef<Peer | null>(null);

  const join = useCallback(async (code: string, name: string, team: TeamId) => {
    setStatus('connecting');
    const peer = new Peer({ config: ICE_CONFIG });
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(ROOM_PREFIX + code.toUpperCase().trim(), { reliable: true });
      connRef.current = conn;

      conn.on('open', () => {
        conn.send({ type: 'join', name, team } satisfies ToHost);
        setStatus('joined');
      });
      conn.on('data', (raw) => {
        const msg = raw as ToPlayer;
        if (msg?.type === 'welcome') setBrand({ names: msg.teamNames, colours: msg.teamColours });
        if (msg?.type === 'state') setSnapshot(msg.snapshot);
      });
      conn.on('close', () => setStatus('error'));
      conn.on('error', () => setStatus('error'));
    });
    peer.on('error', () => setStatus('error'));

    // If nothing has connected in fifteen seconds the code is probably wrong,
    // the host has closed the room, or the network is blocking WebRTC.
    setTimeout(() => setStatus((s) => (s === 'connecting' ? 'error' : s)), 15000);
  }, []);

  const send = useCallback((msg: ToHost) => {
    const conn = connRef.current;
    if (conn?.open) conn.send(msg);
  }, []);

  const leave = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
    setSnapshot(null);
    setStatus('idle');
  }, []);

  useEffect(() => () => { peerRef.current?.destroy(); }, []);

  return { status, snapshot, brand, join, send, leave };
}
