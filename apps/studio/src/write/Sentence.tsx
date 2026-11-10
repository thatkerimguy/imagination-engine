import { Fragment, type ReactNode } from 'react';

/**
 * Renders a translated sentence template with controls in its slots: "Set {var} to {value}" in
 * English, "{var} değerini {value} yap" in Turkish. Templates are translated whole, never glued
 * from pieces, because word order differs between the languages (PLAN §3.4).
 */
export function Sentence({
  template,
  slots,
}: {
  readonly template: string;
  readonly slots: Readonly<Record<string, ReactNode>>;
}) {
  const parts = template.split(/(\{\w+\})/);
  return (
    <span className="sentence">
      {parts.map((part, i) => {
        const slot = /^\{(\w+)\}$/.exec(part)?.[1];
        if (slot !== undefined && slot in slots) return <Fragment key={i}>{slots[slot]}</Fragment>;
        return part.trim() ? (
          <span key={i} className="sentence__text">
            {part.trim()}
          </span>
        ) : null;
      })}
    </span>
  );
}
