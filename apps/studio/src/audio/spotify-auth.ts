import {
  authorizeUrl,
  codeChallenge,
  createVerifier,
  exchangeCode,
  refreshTokens,
  spotifyTokensSchema,
} from '@ie/audio';
import { readParsed } from '@ie/core';
import { readPref, removePref, writePref } from '@ie/ui-kit';
import { z } from 'zod';
import { create } from 'zustand';
import { projectStore } from '../project/storage.ts';

/*
 * Spotify sign-in for private playthroughs (ADR 0012). The author registers their own app on the
 * Spotify dashboard and enters its client ID here; there is no secret. Tokens stay on this device
 * in IndexedDB.
 */

const CLIENT_KEY = 'ie.studio.spotifyClientId';
const TOKENS = 'spotify:tokens';
const PENDING = 'spotify:pending';
const pendingSchema = z.object({ verifier: z.string(), state: z.string(), clientId: z.string() });

export const useSpotify = create<{ readonly signedIn: boolean; readonly error: string | null }>()(
  () => ({ signedIn: false, error: null }),
);

export function spotifyClientId(): string {
  return readPref(CLIENT_KEY) ?? '';
}

export function setSpotifyClientId(id: string): void {
  if (id.trim()) writePref(CLIENT_KEY, id.trim());
  else removePref(CLIENT_KEY);
}

/** The Studio's own address; register exactly this as a redirect URI on the dashboard. */
export function spotifyRedirectUri(): string {
  return `${location.origin}${location.pathname}`;
}

export async function startSpotifySignIn(): Promise<void> {
  const clientId = spotifyClientId();
  if (!clientId) return;
  const verifier = createVerifier();
  const state = createVerifier().slice(0, 16);
  await (await projectStore()).set(PENDING, { verifier, state, clientId });
  location.assign(
    authorizeUrl({
      clientId,
      redirectUri: spotifyRedirectUri(),
      challenge: await codeChallenge(verifier),
      state,
    }),
  );
}

/** At startup: finishes a sign-in that just came back from Spotify, or picks up saved tokens. */
export async function initSpotify(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const state = params.get('state');
  const store = await projectStore();
  if (state && (params.has('code') || params.has('error'))) {
    history.replaceState(null, '', spotifyRedirectUri());
    const pending = await readParsed(store, PENDING, pendingSchema);
    await store.delete(PENDING);
    const code = params.get('code');
    if (pending?.state === state && code) {
      try {
        const tokens = await exchangeCode({
          clientId: pending.clientId,
          code,
          redirectUri: spotifyRedirectUri(),
          verifier: pending.verifier,
        });
        await store.set(TOKENS, tokens);
      } catch (error) {
        useSpotify.setState({ error: error instanceof Error ? error.message : String(error) });
      }
    } else {
      useSpotify.setState({ error: params.get('error') ?? 'state' });
    }
  }
  const tokens = await readParsed(store, TOKENS, spotifyTokensSchema);
  useSpotify.setState({ signedIn: tokens !== undefined });
}

/** A fresh access token, refreshed when it is about to expire. */
export async function spotifyToken(): Promise<string> {
  const store = await projectStore();
  let tokens = await readParsed(store, TOKENS, spotifyTokensSchema);
  if (!tokens) throw new Error('Not signed in to Spotify.');
  if (tokens.expiresAt - Date.now() < 60_000) {
    tokens = await refreshTokens(spotifyClientId(), tokens);
    await store.set(TOKENS, tokens);
  }
  return tokens.accessToken;
}

export async function signOutSpotify(): Promise<void> {
  await (await projectStore()).delete(TOKENS);
  useSpotify.setState({ signedIn: false, error: null });
}
