import { beforeAll, describe, expect, it } from 'vitest';
import { renderInline } from './inline.ts';

// Minimal DOM shim (vitest runs in node): just what renderInline touches, plus serialisation
// that escapes text exactly like a browser's innerHTML.
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
class FakeText {
  constructor(readonly data: string) {}
  get outer(): string {
    return esc(this.data);
  }
  get textContent(): string {
    return this.data;
  }
}
class FakeEl {
  children: (FakeEl | FakeText)[] = [];
  constructor(readonly tag: string) {}
  appendChild<T extends FakeEl | FakeText>(n: T): T {
    this.children.push(n);
    return n;
  }
  replaceChildren(): void {
    this.children = [];
  }
  get innerHTML(): string {
    return this.children.map((c) => c.outer).join('');
  }
  get outer(): string {
    return `<${this.tag}>${this.innerHTML}</${this.tag}>`;
  }
  get textContent(): string {
    return this.children.map((c) => c.textContent).join('');
  }
  tags(): string[] {
    return this.children.flatMap((c) => (c instanceof FakeEl ? [c.tag, ...c.tags()] : []));
  }
}
beforeAll(() => {
  Object.assign(globalThis, {
    document: {
      createElement: (tag: string) => new FakeEl(tag),
      createTextNode: (data: string) => new FakeText(data),
    },
  });
});

const make = (text: string): FakeEl => {
  const el = new FakeEl('p');
  renderInline(el as unknown as HTMLElement, text);
  return el;
};
const html = (text: string): string => make(text).innerHTML;

describe('renderInline', () => {
  it('leaves plain strings untouched', () => {
    expect(html('Snake eyes. The room exhaled.')).toBe('Snake eyes. The room exhaled.');
  });

  it('renders every span kind', () => {
    expect(html('**b** *i* ++u++ ~~s~~ ==m==')).toBe(
      '<strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <mark>m</mark>',
    );
  });

  it('nests spans', () => {
    expect(html('**bold *and italic* ==lit==**')).toBe(
      '<strong>bold <em>and italic</em> <mark>lit</mark></strong>',
    );
  });

  it('honours backslash escapes and unmatched delimiters', () => {
    expect(html('2 \\* 3 = 6 and \\*\\*not bold\\*\\*')).toBe('2 * 3 = 6 and **not bold**');
    expect(html('a lone * star')).toBe('a lone * star');
    expect(html('back\\\\slash')).toBe('back\\slash');
  });

  it('renders HTML inertly (XSS safe)', () => {
    const el = make('<script>alert(1)</script> **<img src=x onerror=alert(1)>**');
    expect(el.tags()).toEqual(['strong']);
    expect(el.innerHTML).toContain('&lt;script&gt;');
    expect(el.textContent).toBe('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  });
});
