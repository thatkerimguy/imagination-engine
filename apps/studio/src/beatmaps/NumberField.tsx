import { useRef, useState } from 'react';

interface Props {
  readonly label: string;
  readonly value: number;
  readonly onCommit: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly testId?: string;
}

/**
 * A number typed in full before it applies (on Enter or leaving the field), so a half-typed
 * time doesn't move a note to 0 on the way to 1250. Escape keeps the old value.
 */
export function NumberField({ label, value, onCommit, min, max, testId }: Props) {
  const [text, setText] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = () => {
    const typed = text;
    setText(null);
    if (cancelled.current || typed === null) {
      cancelled.current = false;
      return;
    }
    const n = Number(typed.replace(',', '.'));
    if (typed.trim() === '' || !Number.isFinite(n)) return;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label className="labelled">
      <span className="ie-label">{label}</span>
      <input
        className="field field--number"
        inputMode="decimal"
        value={text ?? String(value)}
        data-testid={testId}
        onFocus={() => setText(String(value))}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancelled.current = true;
          if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
