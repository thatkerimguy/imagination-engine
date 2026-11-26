// Web build: no remote crash reporting (the local ring buffer still works). Safe no-op.
import type { CrashReporterPort } from './crash-reporter.ts';

export const sentryAdapter: CrashReporterPort | undefined = undefined;
