// Name a folder (new or rename) in a Folio sheet with one Field.
import { useEffect, useState, type ReactNode } from 'react';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export interface NameSheetProps {
  visible: boolean;
  title: string;
  initial: string;
  confirmLabel: string;
  onSubmit(name: string): void;
  onClose(): void;
}

export function NameSheet(p: NameSheetProps): ReactNode {
  const [name, setName] = useState(p.initial);
  useEffect(() => {
    if (p.visible) setName(p.initial);
  }, [p.visible, p.initial]);
  const ok = name.trim().length > 0;
  const submit = (): void => {
    if (ok) p.onSubmit(name.trim());
  };
  return (
    <Sheet
      visible={p.visible}
      title={p.title}
      onClose={p.onClose}
      testID="name-sheet"
      footer={
        <ActionButton label={p.confirmLabel} disabled={!ok} onPress={submit} testID="name-save" />
      }
    >
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        autoFocus
        returnKeyType="done"
        placeholder="Folder name"
        testID="name-field"
      />
    </Sheet>
  );
}
