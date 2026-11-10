import { NODES } from '@ie/material';
import type { MaterialDef } from '@ie/story';
import type { RefObject } from 'react';
import { useT } from '../store.ts';
import { link, moveNode, unlink } from './edit.ts';
import { canvasSize, nodePorts, portPoint, wirePath } from './layout.ts';
import { NodeCard } from './NodeCard.tsx';
import { useMaterialUi } from './ui.ts';

export interface GraphProps {
  readonly material: MaterialDef;
  /** Nodes the compiler reported a problem on. */
  readonly problemNodes: ReadonlySet<string>;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  /** One edit of the graph; drags pass a merge key so a whole drag is one undo step. */
  readonly onEdit: (change: (m: MaterialDef) => MaterialDef, mergeKey?: string) => void;
}

/**
 * The node canvas (ADR 0020): it scrolls both ways, wires are drawn from the data, and connecting
 * is tap to connect: tap an output, then an input. Tapping a linked input with nothing armed
 * unlinks it.
 */
export function Graph({ material, problemNodes, scrollRef, onEdit }: GraphProps) {
  const t = useT();
  const ui = useMaterialUi();
  const size = canvasSize(material);
  const byId = new Map(material.nodes.map((n) => [n.id, n]));

  const wires = material.nodes.flatMap((node) =>
    Object.entries(node.inputs ?? {}).flatMap(([port, l]) => {
      const source = byId.get(l.node);
      if (!source) return [];
      const outName = l.port ?? NODES[source.type].outputs[0]?.name ?? 'out';
      const a = portPoint(source, nodePorts(source, material.domain), 'out', outName);
      const b = portPoint(node, nodePorts(node, material.domain), 'in', port);
      const active = ui.selected === node.id || ui.selected === source.id;
      return [{ key: `${node.id}:${port}`, d: wirePath(a, b), active }];
    }),
  );

  return (
    <div
      className="mg"
      ref={scrollRef}
      role="group"
      aria-label={t('mat.graph')}
      data-testid="mg-canvas"
    >
      <div
        className="mg__canvas"
        style={{ width: size.w, height: size.h }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            ui.select(null);
            ui.arm(null);
          }
        }}
      >
        <svg className="mg__wires" width={size.w} height={size.h} aria-hidden="true">
          {wires.map((w) => (
            <path
              key={w.key}
              d={w.d}
              className={`mg__wire${w.active ? ' mg__wire--active' : ''}`}
            />
          ))}
        </svg>
        {material.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            ports={nodePorts(node, material.domain)}
            material={material}
            selected={ui.selected === node.id}
            armed={ui.armed}
            problem={problemNodes.has(node.id)}
            onSelect={() => ui.select(node.id)}
            onMove={(x, y) => onEdit((m) => moveNode(m, node.id, x, y), `move:${node.id}`)}
            onOutput={(port) =>
              ui.arm(
                ui.armed?.node === node.id && ui.armed.port === port
                  ? null
                  : { node: node.id, port },
              )
            }
            onInput={(port) => {
              const armed = ui.armed;
              if (armed) {
                onEdit((m) => link(m, armed, { node: node.id, port }));
                ui.arm(null);
              } else if (node.inputs?.[port]) {
                onEdit((m) => unlink(m, node.id, port));
              } else {
                ui.select(node.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
