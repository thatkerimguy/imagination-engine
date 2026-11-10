import type { Translator } from '@ie/i18n';
import { formatValue, type BattleAction, type StoryRuntime } from '@ie/story';
import { variableLabel } from './labels.ts';
import type { PresentKey } from './messages.ts';
import { rpgNames } from './rpg-lines.ts';

/** What the reader does in a shop or a battle; the host runs it on the runtime. */
export interface RpgHandlers {
  buy(itemId: string): void;
  sell(itemId: string): void;
  leaveShop(): void;
  battle(action: BattleAction): void;
}

interface Ctx {
  readonly runtime: StoryRuntime;
  readonly t: Translator<PresentKey>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A button styled like a choice, so it looks and keys (1–9) like every other option. */
function option(
  index: number,
  text: string,
  meta: string | undefined,
  note: string | undefined,
  enabled: boolean,
  onPick: () => void,
): HTMLButtonElement {
  const button = el('button', 'choice');
  button.type = 'button';
  button.dataset.testid = 'choice';
  const key = el('span', 'choice__key', String(index + 1));
  key.setAttribute('aria-hidden', 'true');
  const body = el('span', 'choice__body');
  body.append(el('span', 'choice__text', text));
  if (note) body.append(el('span', 'choice__note', note));
  button.append(key, body);
  if (meta) button.append(el('span', 'choice__meta', meta));
  if (!enabled) {
    button.setAttribute('aria-disabled', 'true');
    button.dataset.locked = 'true';
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (enabled) onPick();
  });
  return button;
}

function group(label: string): { root: HTMLElement; list: HTMLElement } {
  const root = el('div', 'choices rpg-prompt');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', label);
  root.addEventListener('click', (event) => event.stopPropagation());
  const list = el('div', 'choices__list');
  return { root, list };
}

export function buildShop(ctx: Ctx, handlers: RpgHandlers): HTMLElement | null {
  const menu = ctx.runtime.shopMenu();
  if (!menu) return null;
  const { t, runtime } = ctx;
  const story = runtime.story;
  const locale = t.locale;
  const currency = variableLabel(story, menu.currency, locale);
  const { root, list } = group(t('shop.label'));
  root.dataset.testid = 'shop';
  root.append(
    el(
      'p',
      'choices__prompt',
      t('shop.money', { amount: formatValue(menu.money, locale), currency }),
    ),
  );
  let index = 0;
  for (const offer of menu.stock) {
    const count = runtime.inventory[offer.item] ?? 0;
    list.append(
      option(
        index++,
        rpgNames.item(story, offer.item, locale),
        t('shop.price', { price: formatValue(offer.price, locale), currency }),
        count > 0 ? t('shop.owned', { count: formatValue(count, locale) }) : undefined,
        offer.affordable,
        () => handlers.buy(offer.item),
      ),
    );
  }
  for (const offer of menu.sell) {
    list.append(
      option(
        index++,
        t('shop.sellItem', { name: rpgNames.item(story, offer.item, locale) }),
        `+${t('shop.price', { price: formatValue(offer.price, locale), currency })}`,
        t('shop.owned', { count: formatValue(offer.count, locale) }),
        true,
        () => handlers.sell(offer.item),
      ),
    );
  }
  list.append(
    option(index, t('shop.leave'), undefined, undefined, true, () => handlers.leaveShop()),
  );
  root.append(list);
  return root;
}

type BattlePage = 'main' | 'skills' | 'items';

export function buildBattle(ctx: Ctx, handlers: RpgHandlers): HTMLElement | null {
  const first = ctx.runtime.battleMenu();
  if (!first) return null;
  const { t, runtime } = ctx;
  const story = runtime.story;
  const locale = t.locale;
  const n = (value: number) => formatValue(value, locale);
  const enemy = rpgNames.enemy(story, first.enemy.id, locale);
  const { root, list } = group(t('battle.label', { enemy }));
  root.dataset.testid = 'battle';
  const status = el('div', 'rpg-prompt__status');
  status.setAttribute('aria-live', 'polite');
  root.append(status, list);

  const meter = (label: string, value: number, max: number | null, side: string) => {
    const row = el('div', `rpg-meter rpg-meter--${side}`);
    row.append(el('span', 'rpg-meter__label', label));
    if (max) {
      const bar = el('span', 'rpg-meter__bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('span', '');
      fill.style.setProperty('--fill', String(Math.max(0, Math.min(1, value / max))));
      bar.append(fill);
      row.append(bar);
    }
    return row;
  };

  const render = (page: BattlePage) => {
    const menu = runtime.battleMenu();
    if (!menu) return;
    const hero =
      menu.heroMaxHp !== null
        ? t('battle.heroHp', { hp: n(menu.heroHp), max: n(menu.heroMaxHp) })
        : t('battle.heroHpPlain', { hp: n(menu.heroHp) });
    const mp = menu.mp !== null ? ` · ${t('battle.mp', { mp: n(menu.mp) })}` : '';
    status.replaceChildren(
      meter(
        t('battle.enemyHp', { enemy, hp: n(Math.max(0, menu.enemyHp)), max: n(menu.enemyMaxHp) }),
        menu.enemyHp,
        menu.enemyMaxHp,
        'enemy',
      ),
      meter(hero + mp, menu.heroHp, menu.heroMaxHp, 'hero'),
    );
    const buttons: HTMLButtonElement[] = [];
    const add = (text: string, meta: string | undefined, enabled: boolean, pick: () => void) =>
      buttons.push(option(buttons.length, text, meta, undefined, enabled, pick));
    if (page === 'main') {
      add(t('battle.actAttack'), undefined, true, () => handlers.battle({ act: 'attack' }));
      if (menu.skills.length)
        add(
          t('battle.actSkills'),
          undefined,
          menu.skills.some((s) => s.enabled),
          () => render('skills'),
        );
      if (menu.items.length) add(t('battle.actItems'), undefined, true, () => render('items'));
      if (menu.flee)
        add(t('battle.actFlee'), undefined, true, () => handlers.battle({ act: 'flee' }));
    } else if (page === 'skills') {
      for (const skill of menu.skills)
        add(
          rpgNames.skill(story, skill.id, locale),
          skill.cost ? t('battle.mpCost', { cost: n(skill.cost) }) : undefined,
          skill.enabled,
          () => handlers.battle({ act: 'skill', id: skill.id }),
        );
      add(t('battle.back'), undefined, true, () => render('main'));
    } else {
      for (const item of menu.items)
        add(
          rpgNames.item(story, item.id, locale),
          t('battle.count', { count: n(item.count) }),
          true,
          () => handlers.battle({ act: 'item', id: item.id }),
        );
      add(t('battle.back'), undefined, true, () => render('main'));
    }
    list.replaceChildren(...buttons);
    if (page !== 'main') buttons[0]?.focus({ preventScroll: true });
  };
  render('main');
  return root;
}
