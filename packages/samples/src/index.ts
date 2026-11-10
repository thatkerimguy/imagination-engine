import rainAlley from './rain-alley.story.json';

/** Raw story documents. Pass them to `compileStory()`; they are validated there, never trusted. */
export const samples = {
  rainAlley: rainAlley as unknown,
} as const;
