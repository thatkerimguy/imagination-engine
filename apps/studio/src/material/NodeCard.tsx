import type { MaterialDef, MaterialNode } from '@ie/story';
import { useRef, type PointerEvent } from 'react';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { HEAD, NODE_W, ROW, nodeHeight, type NodePorts } from './layout.ts';
import { nodeName, portName, shortValue } from './labels.ts';
import type { ArmedPort } from './ui.ts';

export interface NodeCardProps {
  readonly node: MaterialNode;
  readonly ports: NodePorts;
  readonly material: MaterialDef;
  readonly selected: boolean;
  readonly armed: ArmedPort | null;
  readonly problem: boolean;
  readonly onSelect: () => void;
  /** Dragging the header: the new top-left corner, in canvas px. */
  readonly onMove: (x: number, y: number) => void;
  readonly onOutput: (port: string) => void;
  readonly onInput: (port: string) => void;
}

/**
 * One node on the canvas: a header to drag, outputs on the right edge and inputs on the left,
 * each a button so a tap connects (ADR 0020). Unlinked inputs show their value.
 */
export function NodeCard(props: NodeCardProps) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const { node, ports, armed } = props;
  const drag = useRef<{ x: number; y: number; nx: number; ny: number } | null>(null);
  const name = t(nodeName(node.type));
  const param =
    node.type === 'param' ? props.material.params.find((p) => p.id === node.param) : undefined;
  const subtitle = param ? labelText(param.name, locale, param.id) : undefined;

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, nx: node.x, ny: node.y };
    props.onSelect();
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    props.onMove(d.nx + e.clientX - d.x, d.ny + e.clientY - d.y);
  };
  const up = () => {
    drag.current = null;
  };

  return (
    <div
      className={[
        'mg-node',
        props.selected ? 'mg-node--selected' : '',
        props.problem ? 'mg-node--problem' : '',
      ].join(' ')}
      style={{ left: node.x, top: node.y, width: NODE_W, height: nodeHeight(ports) }}
      data-testid={`mg-node-${node.type}`}
      data-node={node.id}
    >
      <div
        className="mg-node__head"
        style={{ height: HEAD }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <button type="button" className="mg-node__name" onClick={props.onSelect}>
          {name}
          {subtitle ? <span className="mg-node__sub"> · {subtitle}</span> : null}
        </button>
      </div>
      {ports.outputs.map((o) => {
        const active = armed?.node === node.id && armed.port === o.name;
        return (
          <div key={`o:${o.name}`} className="mg-node__row mg-node__row--out" style={{ height: ROW }}>
            <span className="mg-node__label">{t(portName(o.name))}</span>
            <button
              type="button"
              className={`mg-port mg-port--out${active ? ' mg-port--armed' : ''}`}
              aria-pressed={active}
              aria-label={t('mat.portOut', { port: t(portName(o.name)), node: name })}
              data-testid={`mg-out-${node.type}-${o.name}`}
              onClick={() => props.onOutput(o.name)}
            />
          </div>
        );
      })}
      {ports.inputs.map((i) => {
        const linked = node.inputs?.[i.name] !== undefined;
        const value = node.values?.[i.name];
        return (
          <div key={`i:${i.name}`} className="mg-node__row" style={{ height: ROW }}>
            <button
              type="button"
              className={`mg-port mg-port--in${linked ? ' mg-port--linked' : ''}${armed ? ' mg-port--target' : ''}`}
              aria-label={t('mat.portIn', { port: t(portName(i.name)), node: name })}
              data-testid={`mg-in-${node.type}-${i.name}`}
              onClick={() => props.onInput(i.name)}
            />
            <span className="mg-node__label">{t(portName(i.name))}</span>
            {!linked && (
              <span className="mg-node__value">{shortValue(value ?? i.default)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
