// Web has no home-screen widget: the payload is dropped.
import type { WidgetPayload } from './widget-state.ts';

export const pushWidget: (p: WidgetPayload) => void = () => undefined;
