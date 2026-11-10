import { availableIn, compileMaterial, NODES, type NodeSpec } from '@ie/material';
import { MATERIAL_NODE_TYPES, type MaterialDef, type MaterialNodeType } from '@ie/story';
import { useMemo, useRef } from 'react';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { addNode, updateMaterial } from './edit.ts';
import { Graph } from './Graph.tsx';
import { NODE_W } from './layout.ts';
import { nodeName, problemText } from './labels.ts';
import { NodeInspector } from './NodeInspector.tsx';
import { Params } from './Params.tsx';
import { Preview } from './Preview.tsx';
import { useMaterialUi } from './ui.ts';

const GROUPS: readonly NodeSpec['group'][] = ['input', 'math', 'vector', 'pattern'];

/** One material open for editing: preview, name and parameters, node graph and inspector. */
export function MaterialBench({ material }: { readonly material: MaterialDef }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const ui = useMaterialUi();
  const scrollRef = useRef<HTMLDivElement>(null);
  const compiled = useMemo(() => compileMaterial(material), [material]);
  const problemNodes = useMemo(
    () => new Set(compiled.problems.flatMap((p) => (p.node ? [p.node] : []))),
    [compiled],
  );
  const selected = material.nodes.find((n) => n.id === ui.selected);
  const armedNode = material.nodes.find((n) => n.id === ui.armed?.node);

  const onEdit = (change: (m: MaterialDef) => MaterialDef, mergeKey?: string) =>
    edit((d) => updateMaterial(d, material.id, change), mergeKey);

  const add = (type: MaterialNodeType) => {
    // New nodes land in the middle of what the canvas shows now.
    const scroller = scrollRef.current;
    const x = (scroller?.scrollLeft ?? 0) + (scroller?.clientWidth ?? 600) / 2 - 88;
    let y = (scroller?.scrollTop ?? 0) + (scroller?.clientHeight ?? 400) / 2 - 40;
    // Step down past cards already there, so a new node never hides under another.
    const near = (yy: number) =>
      material.nodes.some((n) => Math.abs(n.x - x) < NODE_W && Math.abs(n.y - yy) < 64);
    for (let i = 0; i < 40 && near(y); i++) y += 48;
    const result = addNode(material, type, x, y);
    if (!result.id) return;
    edit((d) => updateMaterial(d, material.id, () => result.material));
    ui.select(result.id);
  };

  return (
    <div className="mat-bench">
      <div className="mat-bench__top">
        <Preview material={material} />
        <div className="mat-bench__side">
          <div className="row row--wrap">
            {(['en', 'tr'] as const).map((language) => (
              <label key={language} className="labelled">
                <span>{t('mat.name', { language: t(`language.${language}`) })}</span>
                <input
                  className="field"
                  lang={language}
                  value={material.name[language] ?? ''}
                  data-testid={`mat-name-${language}`}
                  onChange={(e) =>
                    onEdit(
                      (m) => ({ ...m, name: { ...m.name, [language]: e.target.value } }),
                      `name:${material.id}:${language}`,
                    )
                  }
                />
              </label>
            ))}
          </div>
          <Params material={material} onEdit={onEdit} />
        </div>
      </div>
      <div className="row row--wrap mat-bench__tools">
        <select
          className="picker"
          aria-label={t('mat.addNode')}
          value=""
          data-testid="mat-add-node"
          onChange={(e) => {
            const type = MATERIAL_NODE_TYPES.find((n) => n === e.target.value);
            if (type) add(type);
          }}
        >
          <option value="">{t('mat.addNode')}</option>
          {GROUPS.map((group) => (
            <optgroup key={group} label={t(`matGroup.${group}`)}>
              {MATERIAL_NODE_TYPES.filter(
                (type) => NODES[type].group === group && availableIn(type, material.domain),
              ).map((type) => (
                <option key={type} value={type}>
                  {t(nodeName(type))}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {armedNode && (
          <>
            <span className="hint" role="status" data-testid="mat-armed">
              {t('mat.armed', { name: t(nodeName(armedNode.type)) })}
            </span>
            <button type="button" className="ie-button ie-button--quiet" onClick={() => ui.arm(null)}>
              {t('cancel')}
            </button>
          </>
        )}
      </div>
      <div className="mat-bench__main">
        <Graph
          material={material}
          problemNodes={problemNodes}
          scrollRef={scrollRef}
          onEdit={onEdit}
        />
        <aside className="mat-bench__aside">
          {selected ? (
            <NodeInspector
              key={selected.id}
              material={material}
              node={selected}
              onEdit={onEdit}
              onRemoved={() => ui.select(null)}
            />
          ) : (
            <p className="hint">{t('mat.nothingSelected')}</p>
          )}
          <div className="mat-problems" data-testid="mat-problems">
            <h3 className="mat-inspector__title">{t('mat.problems')}</h3>
            {compiled.problems.length === 0 ? (
              <p className="hint">{t('mat.noProblems')}</p>
            ) : (
              <ul className="mat-problems__list">
                {compiled.problems.map((p) => (
                  <li key={`${p.code}:${p.node ?? ''}:${p.port ?? ''}`}>
                    {p.node ? (
                      <button
                        type="button"
                        className="mat-problems__link"
                        onClick={() => ui.select(p.node ?? null)}
                      >
                        {problemText(t, p, material)}
                      </button>
                    ) : (
                      problemText(t, p, material)
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
