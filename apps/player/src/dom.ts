type Attrs = Readonly<Record<string, string | boolean | undefined>>;

/** Tiny element builder: `h('button', { class: 'ie-button', type: 'button' }, 'Close')`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  el.append(...children);
  return el;
}

/** A segmented control whose buttons report the chosen value. */
export function segmented<V extends string>(
  options: readonly { value: V; label: string }[],
  current: V,
  onPick: (value: V) => void,
  label: string,
): HTMLElement {
  const group = h('div', { class: 'ie-segmented', role: 'group', 'aria-label': label });
  for (const option of options) {
    const button = h(
      'button',
      { type: 'button', 'aria-pressed': String(option.value === current) },
      option.label,
    );
    button.addEventListener('click', () => onPick(option.value));
    group.append(button);
  }
  return group;
}
