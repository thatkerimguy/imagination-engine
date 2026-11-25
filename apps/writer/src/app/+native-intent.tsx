// Android verified App Links (`https://<KN_APP_LINK_HOST>/share/<slug>`, `/r/<slug>`) arrive as
// system paths. Rewrite them to the `/open` landing so they never hit an unmatched-route screen.
import { appLinkRedirect } from '../routes.ts';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return appLinkRedirect(path) ?? path;
  } catch {
    return '/';
  }
}
