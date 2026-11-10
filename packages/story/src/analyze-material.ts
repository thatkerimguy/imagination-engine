import { findMaterial, type MaterialDomain } from './material.ts';
import type { StoryProject } from './schema.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

const LANGUAGE = { en: 'English', tr: 'Turkish' } as const;

/**
 * A stage action's material reference (ADR 0020): the material exists and is of the right domain,
 * and a parameter it sets is one of its own. An empty reference is reported as not picked yet.
 */
export function checkMaterialRef(
  action: string,
  params: Readonly<Record<string, unknown>>,
  project: StoryProject,
  report: Report,
  where: string,
): void {
  const domain: MaterialDomain | undefined =
    action === 'stage.title' ? 'text' : action === 'stage.post.set' ? 'post' : undefined;
  const ref = typeof params.material === 'string' ? params.material : undefined;
  if (action === 'stage.title' && !ref) return; // a title's material is optional
  if (action === 'stage.post.set' && ref === '') return; // '' turns the post material off
  if (!domain && action !== 'stage.material.param') return;
  if (!ref) {
    report('error', 'material-missing', 'No material is picked.', {}, where);
    return;
  }
  const material = findMaterial(project.materials, ref);
  if (!material) {
    report('error', 'unknown-material', `"${ref}" isn't a material.`, { id: ref }, where);
    return;
  }
  if (domain && material.domain !== domain) {
    report(
      'error',
      'material-domain',
      `"${ref}" is a ${material.domain} material.`,
      { id: ref, domain: material.domain },
      where,
    );
    return;
  }
  if (action !== 'stage.material.param') return;
  const param = typeof params.param === 'string' ? params.param : '';
  if (!material.params.some((p) => p.id === param))
    report('error', 'material-param', `"${ref}" has no such parameter.`, { id: ref }, where);
}

/** Every material has a name in each language, one output, and parameters its nodes can read. */
export function checkMaterials(project: StoryProject, report: Report): void {
  for (const material of project.materials ?? []) {
    for (const locale of project.languages)
      if (!material.name[locale]?.trim())
        report(
          'warning',
          'material-name',
          `The material "${material.id}" has no ${LANGUAGE[locale]} name.`,
          { id: material.id, locale },
          material.id,
        );
    const outputs = material.nodes.filter((n) => n.type === 'output').length;
    if (outputs !== 1)
      report(
        'error',
        'material-output',
        `The material "${material.id}" needs exactly one output.`,
        { id: material.id },
        material.id,
      );
    for (const node of material.nodes)
      if (node.type === 'param' && !material.params.some((p) => p.id === node.param))
        report(
          'error',
          'material-param',
          `"${material.id}" has no such parameter.`,
          { id: material.id },
          material.id,
        );
  }
}
