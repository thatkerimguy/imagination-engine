import { z } from 'zod';
import type { ClockSource } from '../conductor.ts';

/*
 * Spotify, for private playthroughs only (PLAN §5): sign-in with PKCE (no secret in the app),
 * then the Web Playback SDK turns this tab into a Spotify Connect device. Needs Premium and a
 * client ID from the Spotify developer dashboard with this page's /callback as a redirect URI.
 */

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
];

/** `spotify:track:<id>` from a share link or a URI. */
export function parseSpotifyUri(input: string): string | null {
  const s = input.trim();
  const m = s.match(
    /(?:spotify:track:|open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/)([A-Za-z0-9]{22})/,
  );
  return m ? `spotify:track:${m[1]}` : null;
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random PKCE code verifier (64 URL-safe characters). */
export function createVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(48)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    response_type: 'code',
    redirect_uri: options.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: options.challenge,
    state: options.state,
    scope: SPOTIFY_SCOPES.join(' '),
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export const spotifyTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Epoch milliseconds. */
  expiresAt: z.number(),
});
export type SpotifyTokens = z.infer<typeof spotifyTokensSchema>;

const tokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
});

async function tokenRequest(
  body: Record<string, string>,
  previous?: string,
): Promise<SpotifyTokens> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!response.ok) throw new Error(`Spotify sign-in failed (${response.status}).`);
  const t = tokenResponse.parse(await response.json());
  const refreshToken = t.refresh_token ?? previous;
  if (!refreshToken) throw new Error('Spotify sent no refresh token.');
  return { accessToken: t.access_token, refreshToken, expiresAt: Date.now() + t.expires_in * 1000 };
}

export function exchangeCode(options: {
  clientId: string;
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<SpotifyTokens> {
  return tokenRequest({
    grant_type: 'authorization_code',
    client_id: options.clientId,
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.verifier,
  });
}

export function refreshTokens(clientId: string, tokens: SpotifyTokens): Promise<SpotifyTokens> {
  return tokenRequest(
    { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refreshToken },
    tokens.refreshToken,
  );
}

interface SdkState {
  position: number;
  paused: boolean;
}
interface SdkPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (payload: never) => void): void;
  getCurrentState(): Promise<SdkState | null>;
  resume(): Promise<void>;
  pause(): Promise<void>;
}
interface SdkNamespace {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SdkPlayer;
}

let sdk: Promise<SdkNamespace> | null = null;

function loadSdk(): Promise<SdkNamespace> {
  const w = window as unknown as {
    Spotify?: SdkNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  };
  sdk ??= new Promise((resolve, reject) => {
    if (w.Spotify) return resolve(w.Spotify);
    w.onSpotifyWebPlaybackSDKReady = () =>
      w.Spotify ? resolve(w.Spotify) : reject(new Error('No Spotify SDK.'));
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => {
      sdk = null;
      reject(new Error('The Spotify player could not load.'));
    };
    document.head.append(script);
  });
  return sdk;
}

/** How often the SDK state is read; between reads the position is extrapolated. */
const POLL_MS = 500;

/**
 * This tab as a Spotify Connect device. The SDK only reports positions asynchronously, so a poll
 * keeps the latest reading and `position()` extrapolates from it; the conductor smooths the rest.
 */
export class SpotifySource implements ClockSource {
  readonly exact = false;
  private reading = { position: 0, paused: true, at: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  private constructor(
    private readonly player: SdkPlayer,
    private readonly deviceId: string,
    private readonly token: () => Promise<string>,
  ) {}

  static async connect(
    token: () => Promise<string>,
    name = 'Imagination Engine',
  ): Promise<SpotifySource> {
    const Spotify = await loadSdk();
    const player = new Spotify.Player({ name, getOAuthToken: (cb) => void token().then(cb) });
    const deviceId = await new Promise<string>((resolve, reject) => {
      player.addListener('ready', (p: { device_id: string }) => resolve(p.device_id));
      player.addListener('initialization_error', (e: { message: string }) =>
        reject(new Error(e.message)),
      );
      player.addListener('authentication_error', (e: { message: string }) =>
        reject(new Error(e.message)),
      );
      player.addListener('account_error', () =>
        reject(new Error('Spotify playback needs Premium.')),
      );
      void player.connect();
    });
    const source = new SpotifySource(player, deviceId, token);
    source.timer = setInterval(() => void source.poll(), POLL_MS);
    return source;
  }

  get playing(): boolean {
    return !this.reading.paused;
  }

  position(): number {
    const r = this.reading;
    return r.paused ? r.position : r.position + (performance.now() - r.at) / 1000;
  }

  /** Starts a track on this device. */
  async play(uri: string, positionMs = 0): Promise<void> {
    const response = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(this.deviceId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${await this.token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
      },
    );
    if (!response.ok && response.status !== 204)
      throw new Error(`Spotify would not play (${response.status}).`);
  }

  pause(): Promise<void> {
    return this.player.pause();
  }

  resume(): Promise<void> {
    return this.player.resume();
  }

  disconnect(): void {
    if (this.timer) clearInterval(this.timer);
    this.player.disconnect();
  }

  private async poll(): Promise<void> {
    const state = await this.player.getCurrentState();
    if (state)
      this.reading = {
        position: state.position / 1000,
        paused: state.paused,
        at: performance.now(),
      };
  }
}
