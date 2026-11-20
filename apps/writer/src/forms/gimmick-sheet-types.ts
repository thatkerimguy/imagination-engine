import type { WriterModule } from '../modules/registry.ts';

export interface GimmickSheetProps {
  visible: boolean;
  module: WriterModule;
  /** The block's stored props (may be partial or stale; defaults fill the gaps). */
  initialProps: Record<string, unknown>;
  /** Called with props that passed `module.schema.validate()`. */
  onSave(props: Record<string, unknown>): void;
  onClose(): void;
  /** Shown in the sheet when the module is not in the novel's enabledModules. */
  disabledInNovel?: boolean;
}
