import { Flag, Minus, PenLine, Play, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { runAction } from '../kernel.ts';
import { buildFlow, type FlowEdge } from '../project/graph.ts';
import { problemsByPassage } from '../project/problems.ts';
import { useDoc, useProject } from '../project/store.ts';
import { allPassages, walkBlocks } from '../project/tree.ts';
import { useStudio, useT } from '../store.ts';
import { labelText, nextName, useEditor, useWriteLocale } from '../write/edit.ts';
import { previewText } from '../write/tokens.ts';
import { useProblems } from './WriteView.tsx';

const NODE_W = 208;
const NODE_H = 88;
const GAP_X = 72;
const GAP_Y = 24;
const PAD = 24;
const ZOOMS = [0.5, 0.75, 1, 1.25] as const;

const x = (column: number) => PAD + column * (NODE_W + GAP_X);
const y = (row: number) => PAD + row * (NODE_H + GAP_Y);

function edgePath(
  from: { column: number; row: number },
  to: { column: number; row: number },
): string {
  const x1 = x(from.column) + NODE_W;
  const y1 = y(from.row) + NODE_H / 2;
  const x2 = x(to.column);
  const y2 = y(to.row) + NODE_H / 2;
  if (to.column === from.column && to.row === from.row) {
    // A passage that leads back to itself: a small loop off its right edge.
    return `M ${x1} ${y1 - 14} C ${x1 + 44} ${y1 - 44}, ${x1 + 44} ${y1 + 44}, ${x1} ${y1 + 14}`;
  }
  if (to.column > from.column) {
    const bend = (x2 - x1) / 2;
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
  }
  // Going back (a loop, or a jump to an earlier passage): swing below the nodes.
  const low = Math.max(y(from.row), y(to.row)) + NODE_H + GAP_Y / 2;
  return `M ${x1} ${y1} C ${x1 + 48} ${y1}, ${x1 + 48} ${low}, ${(x1 + x2) / 2} ${low} S ${x2 - 48} ${y2}, ${x2} ${y2}`;
}

/** Flow: every passage as a card, every jump as a line. Tap a card to open or play it. */
export function FlowView() {
  const t = useT();
  const doc = useDoc();
  const editor = useEditor();
  const locale = useWriteLocale();
  const uiLocale = useStudio((s) => s.locale);
  const openPassage = useProject((s) => s.openPassage);
  const setPlayFrom = useProject((s) => s.setPlayFrom);
  const problems = useProblems();
  const counts = useMemo(() => problemsByPassage(problems), [problems]);
  const flow = useMemo(() => buildFlow(doc), [doc]);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const scale = ZOOMS[zoom] ?? 1;

  const passages = new Map(allPassages(doc).map((p) => [p.id, p]));
  const excerpts = useMemo(() => {
    const out = new Map<string, string>();
    const name = (id: string, kind: string) =>
      kind === 'char'
        ? labelText(doc.characters.find((c) => c.id === id)?.name, uiLocale, id)
        : labelText(doc.variables.find((v) => v.id === id)?.name, uiLocale, id);
    walkBlocks(doc, ({ block, passageId }) => {
      if (out.has(passageId) || (block.type !== 'narration' && block.type !== 'dialogue')) return;
      const source = block.text[locale] || block.text.en || block.text.tr || '';
      const text = previewText(source, (token) =>
        'id' in token ? name(token.id, token.kind) : '',
      );
      if (text) out.set(passageId, text);
    });
    return out;
  }, [doc, locale, uiLocale]);
  const place = new Map(flow.nodes.map((n) => [n.id, n]));
  const width = x(flow.columns) + PAD;
  const height = y(flow.rows) + PAD + GAP_Y;
  const edgeKey = (e: FlowEdge, i: number) => `${e.from}-${e.to}-${i}`;
  const chosen = selected ? passages.get(selected) : undefined;

  return (
    <section className="flow" data-testid="view-flow">
      <div className="flow__bar">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="flow-add"
          onClick={() => {
            const id = editor.addPassage(
              nextName(
                t('passage.base'),
                [...passages.values()].map((p) => p.name ?? ''),
              ),
            );
            setSelected(id);
          }}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('passages.add')}
        </button>
        <span className="flow__zoom">
          <button
            type="button"
            className="ie-button ie-button--quiet icon-button"
            aria-label={t('flow.zoomOut')}
            disabled={zoom === 0}
            onClick={() => setZoom(zoom - 1)}
          >
            <Minus size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <span className="flow__scale">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="ie-button ie-button--quiet icon-button"
            aria-label={t('flow.zoomIn')}
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => setZoom(zoom + 1)}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </span>
      </div>
      <div
        className="flow__canvas"
        onClick={(e) => e.target === e.currentTarget && setSelected(null)}
      >
        <div className="flow__world" style={{ width: width * scale, height: height * scale }}>
          <div className="flow__layer" style={{ width, height, transform: `scale(${scale})` }}>
            <svg className="flow__edges" width={width} height={height} aria-hidden="true">
              <defs>
                <marker
                  id="flow-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" className="flow__arrow" />
                </marker>
              </defs>
              {flow.edges.map((edge, i) => {
                const from = place.get(edge.from);
                const to = place.get(edge.to);
                if (!from || !to) return null;
                const active = selected === edge.from || selected === edge.to;
                return (
                  <path
                    key={edgeKey(edge, i)}
                    d={edgePath(from, to)}
                    className="flow__edge"
                    data-kind={edge.kind}
                    data-active={active || undefined}
                    markerEnd="url(#flow-arrow)"
                  />
                );
              })}
            </svg>
            {flow.nodes.map((node) => {
              const passage = passages.get(node.id);
              if (!passage) return null;
              const count = counts.get(node.id) ?? 0;
              return (
                <button
                  key={node.id}
                  type="button"
                  className="flow__node"
                  style={{ left: x(node.column), top: y(node.row), width: NODE_W, height: NODE_H }}
                  aria-pressed={selected === node.id}
                  data-unreached={node.unreached || undefined}
                  data-testid="flow-node"
                  onClick={() => setSelected(node.id)}
                  onDoubleClick={() => {
                    openPassage(node.id);
                    runAction('studio.view.open', { view: 'write' });
                  }}
                >
                  <span className="flow__name">
                    {node.id === doc.start && (
                      <Flag size={12} strokeWidth={1.75} aria-label={t('passage.start')} />
                    )}
                    {passage.name || passage.id}
                    {count > 0 && <span className="badge">{count}</span>}
                  </span>
                  <span className="flow__excerpt">{excerpts.get(node.id) ?? t('flow.empty')}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {chosen && (
        <div className="flow__panel" data-testid="flow-panel">
          <strong className="flow__panel-name">{chosen.name || chosen.id}</strong>
          <button
            type="button"
            className="ie-button"
            data-testid="flow-open"
            onClick={() => {
              openPassage(chosen.id);
              runAction('studio.view.open', { view: 'write' });
            }}
          >
            <PenLine size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('flow.open')}
          </button>
          <button
            type="button"
            className="ie-button"
            data-testid="flow-play"
            onClick={() => {
              setPlayFrom(chosen.id);
              runAction('studio.view.open', { view: 'play' });
            }}
          >
            <Play size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('passage.playFromHere')}
          </button>
        </div>
      )}
    </section>
  );
}
