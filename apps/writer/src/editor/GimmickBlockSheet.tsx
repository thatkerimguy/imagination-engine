// Binds a module block to the schema-driven GimmickSheet: saves validated props back to the draft.
import type { ChapterDocument } from '@kn/core';
import type { ReactNode } from 'react';
import { GimmickSheet } from '../forms/GimmickSheet.tsx';
import type { WriterModule } from '../modules/registry.ts';
import { replaceBlock } from '../store/chapter-ops.ts';
import type { ModuleBlockT } from './block-types.ts';

export function GimmickBlockSheet(p: {
  block: ModuleBlockT;
  module: WriterModule;
  enabledModules: readonly string[];
  update(fn: (c: ChapterDocument) => ChapterDocument): void;
  onDone(): void;
}): ReactNode {
  const { block, module } = p;
  return (
    <GimmickSheet
      visible
      module={module}
      initialProps={block.props}
      disabledInNovel={!p.enabledModules.includes(block.moduleId)}
      onSave={(props) => {
        p.update((c) => replaceBlock(c, { ...block, moduleVersion: module.meta.version, props }));
        p.onDone();
      }}
      onClose={p.onDone}
    />
  );
}
