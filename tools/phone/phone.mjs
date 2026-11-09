#!/usr/bin/env node
// `pnpm phone`: tunnels the dev (or preview) servers to the Android phone over USB and opens Chrome.
// The servers stay bound to 127.0.0.1; `adb reverse` maps the phone's 127.0.0.1 ports to this PC,
// which also makes the pages a secure context on the phone (service workers, OPFS, WebGPU).
import { execFileSync } from 'node:child_process';

const HELP = `Usage: pnpm phone [options]

Opens the Player (or Studio) in Chrome on the phone connected over USB.

Options
  --studio    open the Studio instead of the Player
  --preview   use the production preview servers (run "pnpm build && pnpm preview" first);
              use this to test offline install
  --diag      open straight to the Diagnostics panel
  --hud       turn on the performance overlay
  --no-open   only set up the tunnel, don't open Chrome
  --help      show this text

Environment
  ANDROID_SERIAL  pick a device when more than one is connected
  ADB             path to adb if it isn't on PATH
`;

const NO_DEVICE = `No phone found.

On the phone (Redmi Note 12 / HyperOS):
  1. Settings → About phone → tap "OS version" seven times to unlock Developer options.
  2. Settings → Additional settings → Developer options → turn on "USB debugging".
  3. Connect the USB cable and accept the "Allow USB debugging?" prompt (tick "Always allow").
  4. If the phone asks what the USB connection is for, choose "File transfer".

Then run "pnpm phone" again. "adb devices" should list the phone as "device".`;

const PORTS = { player: { dev: 5173, preview: 4173 }, studio: { dev: 5174, preview: 4174 } };
const ALL_PORTS = [5173, 5174, 4173, 4174];

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  console.log(HELP);
  process.exit(0);
}
const known = ['--studio', '--preview', '--diag', '--hud', '--no-open'];
for (const arg of args) {
  if (!known.includes(arg)) fail(`Unknown option "${arg}".\n\n${HELP}`);
}

const adbPath = process.env.ADB || 'adb';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function adb(adbArgs, { serial, quiet = false } = {}) {
  const full = serial ? ['-s', serial, ...adbArgs] : adbArgs;
  try {
    return execFileSync(adbPath, full, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'],
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      fail(
        'adb was not found. Install Android platform-tools (winget install Google.PlatformTools) or set ADB.',
      );
    }
    throw error;
  }
}

function pickDevice() {
  const lines = adb(['devices']).split(/\r?\n/).slice(1).filter(Boolean);
  const devices = lines.map((line) => {
    const [serial, state] = line.trim().split(/\s+/);
    return { serial, state };
  });
  const wanted = process.env.ANDROID_SERIAL;
  const candidates = wanted ? devices.filter((d) => d.serial === wanted) : devices;
  if (candidates.length === 0)
    fail(wanted ? `Device "${wanted}" (ANDROID_SERIAL) is not connected.` : NO_DEVICE);
  const ready = candidates.filter((d) => d.state === 'device');
  if (ready.length === 0) {
    const state = candidates[0].state;
    if (state === 'unauthorized')
      fail(
        'The phone is connected but not authorised. Unlock it and accept the USB debugging prompt.',
      );
    fail(`The phone is connected but its state is "${state}". Reconnect the cable and try again.`);
  }
  if (ready.length > 1) {
    fail(
      `More than one device is connected: ${ready.map((d) => d.serial).join(', ')}.\nSet ANDROID_SERIAL to choose one.`,
    );
  }
  return ready[0].serial;
}

async function isServing(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const app = args.has('--studio') ? 'studio' : 'player';
const mode = args.has('--preview') ? 'preview' : 'dev';
const port = PORTS[app][mode];

const serial = pickDevice();
const model = adb(['shell', 'getprop', 'ro.product.model'], { serial, quiet: true }).trim();
console.log(`Phone: ${model || 'unknown model'} (${serial})`);

for (const p of ALL_PORTS) adb(['reverse', `tcp:${p}`, `tcp:${p}`], { serial });
console.log(`Tunnel: phone 127.0.0.1:{${ALL_PORTS.join(',')}} → this PC`);

if (!(await isServing(port))) {
  const start = mode === 'dev' ? 'pnpm dev' : 'pnpm build && pnpm preview';
  console.warn(
    `\nNothing is answering on 127.0.0.1:${port} yet. Start it with "${start}" in another terminal.`,
  );
}

const url = `http://127.0.0.1:${port}/${args.has('--hud') ? '?hud' : ''}${args.has('--diag') ? '#diagnostics' : ''}`;

if (!args.has('--no-open')) {
  // adb joins these into one command for the phone's shell, so the URL is single-quoted there.
  const intent = ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'${url}'`];
  try {
    adb([...intent, 'com.android.chrome'], { serial, quiet: true });
  } catch {
    // Chrome isn't installed (or is disabled): let Android pick a browser. Prefer Chrome over Mi Browser.
    adb(intent, { serial });
    console.warn(
      'Chrome was not found on the phone, so the default browser opened. Test in Chrome.',
    );
  }
  console.log(`Opened: ${url}`);
}

console.log(`
Debug from this PC: chrome://inspect/#devices (console, network, performance, screencast).
GPU check on the phone: open chrome://gpu and look for "WebGPU: Hardware accelerated".`);
