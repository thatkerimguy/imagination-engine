// Renders a module's declarative fields as live controls. This is the web twin of the Phase 2
// native bottom sheet: both are driven by the same FieldDescriptor list, with no per-module UI.
import { isFieldVisible, type FieldDescriptor } from '@kn/core';
import { h } from '../dom.ts';

type Props = Record<string, unknown>;
type Change = (key: string, value: unknown) => void;

export function renderForm(
  fields: readonly FieldDescriptor[],
  props: Props,
  onChange: Change,
): HTMLElement {
  const form = h('div', { class: 'sb-form' });
  for (const field of fields) {
    if (!isFieldVisible(field, props)) continue;
    form.append(
      h(
        'div',
        { class: 'sb-field', 'data-type': field.type },
        h('span', { class: 'sb-label' }, field.label),
        control(field, props[field.key], (v) => onChange(field.key, v)),
        field.help ? h('span', { class: 'sb-help' }, field.help) : null,
      ),
    );
  }
  return form;
}

function control(field: FieldDescriptor, value: unknown, set: (v: unknown) => void): HTMLElement {
  switch (field.type) {
    case 'text':
    case 'asset': {
      const placeholder =
        field.type === 'asset' ? `assets/${field.assetKind}/…` : (field.placeholder ?? '');
      const input = h('input', {
        type: 'text',
        value: String(value ?? ''),
        placeholder,
        maxlength: field.type === 'text' ? field.maxLength : undefined,
      });
      input.addEventListener('change', () => set(input.value));
      return input;
    }
    case 'multiline': {
      const area = h('textarea', { rows: 3, maxlength: field.maxLength }, String(value ?? ''));
      area.addEventListener('change', () => set(area.value));
      return area;
    }
    case 'number': {
      const out = h('output', {}, `${String(value)}${field.unit ?? ''}`);
      const range = h('input', {
        type: 'range',
        min: field.min,
        max: field.max,
        step: field.step,
        value: String(value),
      });
      range.addEventListener(
        'input',
        () => (out.textContent = `${range.value}${field.unit ?? ''}`),
      );
      range.addEventListener('change', () => set(Number(range.value)));
      return h('div', { class: 'sb-row' }, range, out);
    }
    case 'toggle': {
      const box = h('input', { type: 'checkbox', role: 'switch', checked: value === true });
      box.addEventListener('change', () => set(box.checked));
      return h('label', { class: 'sb-switch' }, box, h('span', {}, value ? 'On' : 'Off'));
    }
    case 'select':
      return chips(
        field.options,
        (v) => v === value,
        (v) => set(v),
        'radio',
      );
    case 'multi-select': {
      const current = Array.isArray(value) ? (value as string[]) : [];
      return chips(
        field.options,
        (v) => current.includes(v),
        (v) => set(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]),
        'checkbox',
      );
    }
    case 'color': {
      const input = h('input', { type: 'color', value: String(value ?? '#000000') });
      input.addEventListener('change', () => set(input.value));
      const swatches = (field.swatches ?? []).map((c) => {
        const b = h('button', {
          type: 'button',
          class: 'sb-swatch',
          'aria-label': c,
          onClick: () => set(c),
        });
        b.style.background = c;
        return b;
      });
      return h('div', { class: 'sb-row' }, input, ...swatches);
    }
    case 'string-list':
    case 'number-list':
      return list(field, Array.isArray(value) ? (value as unknown[]) : [], set);
  }
}

function chips(
  options: readonly { value: string; label: string }[],
  isOn: (v: string) => boolean,
  pick: (v: string) => void,
  role: 'radio' | 'checkbox',
): HTMLElement {
  return h(
    'div',
    { class: 'kn-chips', role: role === 'radio' ? 'radiogroup' : 'group' },
    ...options.map((o) =>
      h(
        'button',
        {
          type: 'button',
          class: 'kn-chip',
          role,
          'aria-checked': String(isOn(o.value)),
          onClick: () => pick(o.value),
        },
        o.label,
      ),
    ),
  );
}

function list(
  field: Extract<FieldDescriptor, { type: 'string-list' | 'number-list' }>,
  items: unknown[],
  set: (v: unknown) => void,
): HTMLElement {
  const numeric = field.type === 'number-list';
  const max = field.maxItems ?? Infinity;
  const rows = items.map((item, i) => {
    const input = numeric
      ? h('input', {
          type: 'number',
          inputmode: 'numeric',
          min: field.min,
          max: field.max,
          step: field.step,
          value: String(item),
        })
      : h('input', {
          type: 'text',
          value: String(item),
          placeholder: `${field.itemLabel ?? 'Item'} ${i + 1}`,
        });
    input.addEventListener('change', () => {
      const next = [...items];
      next[i] = numeric ? Number(input.value) : input.value;
      set(next);
    });
    const remove = h(
      'button',
      {
        type: 'button',
        class: 'sb-mini',
        'aria-label': 'Remove',
        onClick: () => set(items.filter((_, j) => j !== i)),
      },
      '×',
    );
    return h('div', { class: 'sb-row' }, input, remove);
  });
  const add = h(
    'button',
    {
      type: 'button',
      class: 'sb-mini sb-add',
      disabled: items.length >= max,
      onClick: () => set([...items, numeric ? field.min : '']),
    },
    '+ Add',
  );
  return h('div', { class: 'sb-list' }, ...rows, add);
}
