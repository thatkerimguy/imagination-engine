import { NODES, type InputPort } from '@ie/material';
import type { MaterialDef, MaterialNode, MaterialValue } from '@ie/story';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Trash2, Unlink } from 'lucide-react';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { moveNode, removeNode, setNodeParam, setValue, unlink } from './edit.ts';
import { nodeName, portName } from './labels.ts';

const STEP = 24;

const toHex = (rgb: readonly number[]) =>
  `#${rgb
    .slice(0, 3)
    .map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
const fromHex = (hex: string): number[] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function Numbers({
  value,
  size,
  label,
  testId,
  onChange,
}: {
  readonly value: MaterialValue;
  readonly size: number;
  readonly label: string;
  readonly testId: string;
  readonly onChange: (value: MaterialValue) => void;
}) {
  const parts = typeof value === 'number' ? Array<number>(size).fill(value) : [...value];
  return (
    <span className="mat-numbers">
      {Array.from({ length: size }, (_, i) => (
        <input
          key={i}
          className="field field--number"
          type="number"
          step={0.05}
          aria-label={size > 1 ? `${label} ${'xyz'[i] ?? ''}` : label}
          data-testid={size > 1 ? `${testId}-${i}` : testId}
          value={parts[i] ?? 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            if (size === 1) return onChange(n);
            const next = Array.from({ length: size }, (_, k) => parts[k] ?? 0);
            next[i] = n;
            onChange(next);
          }}
        />
      ))}
    </span>
  );
}

const sizeOf = (port: InputPort, value: MaterialValue | undefined): number =>
  port.type === 'vec3' ? 3 : port.type === 'vec2' ? 2 : port.type === 'float' ? 1
    : typeof value === 'number' || value === undefined ? 1 : value.length;

/** The selected node: its values, links, parameter, place and removal (ADR 0020). */
export function NodeInspector({
  material,
  node,
  onEdit,
  onRemoved,
}: {
  readonly material: MaterialDef;
  readonly node: MaterialNode;
  readonly onEdit: (change: (m: MaterialDef) => MaterialDef, mergeKey?: string) => void;
  readonly onRemoved: () => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const spec = NODES[node.type];
  const inputs = node.type === 'output' && material.domain === 'post'
    ? spec.inputs.filter((p) => p.name !== 'offset')
    : spec.inputs;
  const nameOf = (id: string) => {
    const source = material.nodes.find((n) => n.id === id);
    return source ? t(nodeName(source.type)) : id;
  };
  const constant = node.type === 'number' || node.type === 'vector' || node.type === 'color';
  const constantValue = node.values?.value ?? (node.type === 'number' ? 1 : node.type === 'vector' ? [0.5, 0.5] : [1, 1, 1]);

  return (
    <div className="mat-inspector" data-testid="mat-inspector">
      <h3 className="mat-inspector__title">{t(nodeName(node.type))}</h3>
      {node.type === 'param' && (
        <label className="inline-field">
          <span>{t('mat.param')}</span>
          <select
            className="picker"
            value={node.param ?? ''}
            data-testid="mat-node-param"
            onChange={(e) => onEdit((m) => setNodeParam(m, node.id, e.target.value))}
          >
            {!node.param && <option value="">{t('mat.pick')}</option>}
            {material.params.map((p) => (
              <option key={p.id} value={p.id}>
                {labelText(p.name, locale, p.id)}
              </option>
            ))}
          </select>
        </label>
      )}
      {constant && (
        <label className="inline-field">
          <span>{t('mat.value')}</span>
          {node.type === 'color' ? (
            <input
              type="color"
              aria-label={t('mat.colour')}
              data-testid="mat-node-color"
              value={toHex(typeof constantValue === 'number' ? [constantValue] : constantValue)}
              onChange={(e) =>
                onEdit((m) => setValue(m, node.id, 'value', fromHex(e.target.value)), `v:${node.id}`)
              }
            />
          ) : (
            <Numbers
              value={constantValue}
              size={node.type === 'vector' ? 2 : 1}
              label={t('mat.value')}
              testId="mat-node-value"
              onChange={(v) => onEdit((m) => setValue(m, node.id, 'value', v), `v:${node.id}`)}
            />
          )}
        </label>
      )}
      {inputs.map((port) => {
        const linked = node.inputs?.[port.name];
        return (
          <div key={port.name} className="inline-field mat-inspector__input">
            <span>{t(portName(port.name))}</span>
            {linked ? (
              <>
                <span className="hint">{t('mat.linkedTo', { name: nameOf(linked.node) })}</span>
                <button
                  type="button"
                  className="ie-button ie-button--quiet"
                  onClick={() => onEdit((m) => unlink(m, node.id, port.name))}
                >
                  <Unlink size={16} strokeWidth={1.5} aria-hidden="true" />
                  {t('mat.unlink')}
                </button>
              </>
            ) : (
              <Numbers
                value={node.values?.[port.name] ?? port.default}
                size={sizeOf(port, node.values?.[port.name])}
                label={t(portName(port.name))}
                testId={`mat-input-${port.name}`}
                onChange={(v) =>
                  onEdit((m) => setValue(m, node.id, port.name, v), `v:${node.id}:${port.name}`)
                }
              />
            )}
          </div>
        );
      })}
      <div className="row row--wrap">
        {(
          [
            ['mat.moveLeft', ArrowLeft, -STEP, 0],
            ['mat.moveUp', ArrowUp, 0, -STEP],
            ['mat.moveDown', ArrowDown, 0, STEP],
            ['mat.moveRight', ArrowRight, STEP, 0],
          ] as const
        ).map(([label, Icon, dx, dy]) => (
          <button
            key={label}
            type="button"
            className="ie-button ie-button--quiet"
            aria-label={t(label)}
            title={t(label)}
            onClick={() =>
              onEdit((m) => moveNode(m, node.id, node.x + dx, node.y + dy), `move:${node.id}`)
            }
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ))}
        {node.type !== 'output' && (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            data-testid="mat-remove-node"
            onClick={() => {
              onEdit((m) => removeNode(m, node.id));
              onRemoved();
            }}
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('mat.removeNode')}
          </button>
        )}
      </div>
    </div>
  );
}
