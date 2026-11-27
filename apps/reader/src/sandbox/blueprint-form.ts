// Renders a v2 blueprint's author form contract (`fields`) as live web controls — the same
// declarative specs the writer will render natively. No per-blueprint UI.
import type {
  BlueprintFieldSpec,
  BlueprintPropValue,
  BlueprintProps,
  BlueprintRecord,
} from '@kn/core/gimmicks';
import { h } from '../dom.ts';

type Change = (key: string, value: BlueprintPropValue) => void;

/** Records edit as one line per item: `col1 | col2 | …` in column order. */
function recordsToText(cols: { key: string }[], v: BlueprintPropValue | undefined): string {
  if (!Array.isArray(v)) return '';
  return v
    .map((r) => (typeof r === 'object' ? cols.map((c) => String(r[c.key] ?? '')).join(' | ') : r))
    .join('\n');
}

function textToRecords(
  cols: { key: string; type: string; optional?: boolean }[],
  text: string,
): BlueprintRecord[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      const rec: BlueprintRecord = {};
      cols.forEach((c, i) => {
        const raw = parts[i] ?? '';
        if (raw === '' && c.optional) return;
        rec[c.key] = c.type === 'number' ? Number(raw) : raw;
      });
      return rec;
    });
}

function control(
  f: BlueprintFieldSpec,
  v: BlueprintPropValue | undefined,
  set: (x: BlueprintPropValue) => void,
): HTMLElement {
  const on = <E extends HTMLElement>(el: E, ev: string, read: () => BlueprintPropValue): E => {
    el.addEventListener(ev, () => set(read()));
    return el;
  };
  switch (f.type) {
    case 'text': {
      const i = h('input', { type: 'text', value: String(v ?? ''), maxlength: f.maxLength });
      return on(i, 'change', () => i.value);
    }
    case 'multiline': {
      const a = h('textarea', { rows: 3, maxlength: f.maxLength }, String(v ?? ''));
      return on(a, 'change', () => a.value);
    }
    case 'list': {
      const a = h('textarea', { rows: 3 }, Array.isArray(v) ? v.join('\n') : '');
      return on(a, 'change', () => a.value.split('\n').filter((l) => l.trim()));
    }
    case 'records': {
      const a = h('textarea', { rows: 4 }, recordsToText(f.columns, v));
      const help = f.columns.map((c) => c.key).join(' | ');
      a.setAttribute('placeholder', help);
      return on(a, 'change', () => textToRecords(f.columns, a.value));
    }
    case 'select': {
      const s = h(
        'select',
        {},
        ...f.options.map((o) => h('option', { value: o.value, selected: o.value === v }, o.label)),
      );
      return on(s, 'change', () => s.value);
    }
    case 'number': {
      const out = h('output', {}, `${String(v ?? '')}${f.unit ?? ''}`);
      const r = h('input', {
        type: 'range',
        min: f.min,
        max: f.max,
        step: f.step,
        value: String(v ?? f.min),
      });
      r.addEventListener('input', () => (out.textContent = `${r.value}${f.unit ?? ''}`));
      on(r, 'change', () => Number(r.value));
      return h('div', { class: 'sb-row' }, r, out);
    }
    case 'boolean': {
      const c = h('input', { type: 'checkbox', checked: v === true });
      return h(
        'label',
        { class: 'sb-switch' },
        on(c, 'change', () => c.checked),
        v ? 'On' : 'Off',
      );
    }
    case 'color': {
      const c = h('input', { type: 'color', value: String(v ?? '#000000') });
      return on(c, 'change', () => c.value);
    }
  }
}

export function renderBlueprintForm(
  fields: readonly BlueprintFieldSpec[],
  props: BlueprintProps,
  onChange: Change,
): HTMLElement {
  return h(
    'div',
    { class: 'sb-form' },
    ...fields.map((f) =>
      h(
        'div',
        { class: 'sb-field', 'data-type': f.type },
        h('span', { class: 'sb-label' }, f.label),
        control(f, props[f.key], (x) => onChange(f.key, x)),
        f.help ? h('span', { class: 'sb-help' }, f.help) : null,
      ),
    ),
  );
}
