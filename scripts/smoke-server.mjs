// Reader preview server for scripts/smoke.mjs: refuses a stale server on the port, runs vite in its
// own process group, and always takes it down (normal exit, Ctrl+C, timeout).
import { spawn, spawnSync } from 'node:child_process';

/** Starts `pnpm --filter @kn/reader preview`, waits until `base` answers, returns a stop function. */
export async function startPreviewServer(base) {
  // A server left on :4173 by an interrupted run would answer instead of ours and vanish mid-run.
  if (await reachable(base)) {
    console.error('Port 4173 is already serving (a stale preview server?). Stop it and re-run.');
    process.exit(2);
  }
  // Windows needs a shell to find pnpm.cmd and a tree kill; elsewhere the server gets its own
  // process group so pnpm and the vite process behind it stop together.
  const win = process.platform === 'win32';
  const server = spawn('pnpm', ['--filter', '@kn/reader', 'preview'], {
    stdio: 'ignore',
    shell: win,
    detached: !win,
  });
  const stopServer = () => {
    if (win) return spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill();
    }
  };
  // An interrupted run (Ctrl+C, timeout) still takes its server down.
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (stopServer(), process.exit(130)));
  try {
    await waitFor(base);
  } catch (err) {
    stopServer();
    throw err;
  }
  return stopServer;
}

export async function reachable(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitFor(url) {
  for (let i = 0; i < 50; i++) {
    if (await reachable(url)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}
