import type { ClockSource } from '../conductor.ts';

/** The parts of the YouTube IFrame API we use. */
interface YTPlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

const PLAYING = 1;
const BUFFERING = 3;

let api: Promise<YTNamespace> | null = null;

/** Loads the IFrame API script once. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };
  api ??= new Promise((resolve, reject) => {
    if (w.YT?.Player) return resolve(w.YT);
    w.onYouTubeIframeAPIReady = () => (w.YT ? resolve(w.YT) : reject(new Error('No YouTube API.')));
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      api = null;
      reject(new Error('The YouTube player could not load.'));
    };
    document.head.append(script);
  });
  return api;
}

/** The 11-character video ID from a YouTube link or a bare ID. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/**
 * A visible YouTube player (its terms require that) as a clock source. Positions come from
 * `getCurrentTime()`, which is coarse; the conductor smooths it. Buffering is reported so a fight
 * can pause instead of drifting.
 */
export class YouTubeSource implements ClockSource {
  readonly exact = false;
  private player: YTPlayer | null = null;
  private state = -1;

  private constructor(private readonly onStall?: (stalled: boolean) => void) {}

  static async create(
    element: HTMLElement,
    videoId: string,
    onStall?: (stalled: boolean) => void,
  ): Promise<YouTubeSource> {
    const YT = await loadYouTubeApi();
    const source = new YouTubeSource(onStall);
    await new Promise<void>((resolve, reject) => {
      source.player = new YT.Player(element, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => resolve(),
          onError: (e) => reject(new Error(`YouTube error ${e.data}.`)),
          onStateChange: (e) => {
            const was = source.state;
            source.state = e.data;
            if (e.data === BUFFERING || was === BUFFERING) source.onStall?.(e.data === BUFFERING);
          },
        },
      });
    });
    return source;
  }

  get playing(): boolean {
    return this.state === PLAYING;
  }

  position(): number {
    return this.player?.getCurrentTime() ?? 0;
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(seconds, true);
  }

  destroy(): void {
    this.player?.destroy();
    this.player = null;
  }
}
