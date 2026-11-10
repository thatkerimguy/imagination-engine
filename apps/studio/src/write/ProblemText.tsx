import type { Translator } from '@ie/i18n';
import type { StoryProblem, StoryProject } from '@ie/story';
import type { MessageKey } from '../messages.ts';
import { useDoc } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from './edit.ts';

/** The name of an item, skill or quest by ID, for problems about them. */
function dataName(doc: StoryProject, id: string, locale: Translator<MessageKey>['locale']): string {
  const entry = [...(doc.items ?? []), ...(doc.skills ?? []), ...(doc.quests ?? [])].find(
    (e) => e.id === id,
  );
  return labelText(entry?.name, locale, id);
}

/** A validator problem in the Studio's language (the validator's own message is English). */
export function problemMessage(
  t: Translator<MessageKey>,
  problem: StoryProblem,
  doc: StoryProject,
): string {
  const p = problem.params;
  const id = p.id ?? '';
  const variableName = labelText(doc.variables.find((v) => v.id === id)?.name, t.locale, id);
  switch (problem.code) {
    case 'unknown-variable':
      return id ? t('problem.unknownVariable', { name: id }) : t('problem.noVariable');
    case 'unknown-character':
      return id ? t('problem.unknownCharacter', { name: id }) : t('problem.noCharacter');
    case 'unknown-passage':
      return id ? t('problem.unknownPassage', { name: id }) : t('problem.noPassage');
    case 'unknown-option':
      return t('problem.unknownOption');
    case 'missing-translation':
      return t('problem.missingTranslation', {
        language: t(p.locale === 'tr' ? 'language.tr' : 'language.en'),
      });
    case 'markup':
      return t('problem.markup');
    case 'formula':
      return t('problem.formula', { formula: p.formula ?? '' });
    case 'duplicate-id':
    case 'duplicate-line':
      return t('problem.duplicate');
    case 'timer-default':
      return t('problem.timerDefault');
    case 'odds-without-check':
      return t('problem.oddsWithoutCheck');
    case 'dice':
      return t('problem.dice', { dice: p.dice ?? '' });
    case 'variable-type':
      return t('problem.variableType', {
        name: variableName,
        type: t(`type.${p.type ?? 'number'}` as MessageKey),
      });
    case 'set-value':
      return t('problem.setValue');
    case 'start':
      return t('problem.start');
    case 'unreachable':
      return t('problem.unreachable', { name: p.name ?? '' });
    case 'dead-end':
      return t('problem.deadEnd', { name: p.name ?? '' });
    case 'action-params':
      return p.action?.startsWith('stage.')
        ? t('problem.stageIncomplete')
        : t('problem.audioIncomplete');
    case 'title-empty':
      return t('problem.titleEmpty');
    case 'title-translation':
      return t('problem.titleTranslation', {
        language: t(p.locale === 'tr' ? 'language.tr' : 'language.en'),
      });
    case 'unknown-track':
      return t('problem.unknownTrack', { name: id });
    case 'unknown-sound':
      return t('problem.unknownSound', { name: id });
    case 'unknown-enemy':
      return t('problem.unknownEnemy');
    case 'enemy-name':
      return t('problem.enemyName', {
        name: labelText(doc.enemies?.find((e) => e.id === id)?.name, t.locale, id),
        language: t(p.locale === 'tr' ? 'language.tr' : 'language.en'),
      });
    case 'unknown-item':
      return id ? t('problem.unknownItem', { name: id }) : t('problem.noItem');
    case 'unknown-quest':
      return id ? t('problem.unknownQuest', { name: id }) : t('problem.noQuest');
    case 'unknown-step':
      return t('problem.unknownStep');
    case 'shop-empty':
      return t('problem.shopEmpty');
    case 'hero-missing':
      return t('problem.heroMissing');
    case 'unknown-routine':
      return id ? t('problem.unknownRoutine', { name: id }) : t('problem.noRoutine');
    case 'unknown-input':
      return t('problem.unknownInput', { name: id });
    case 'data-name':
      return t('problem.dataName', {
        name: dataName(doc, id, t.locale),
        language: t(p.locale === 'tr' ? 'language.tr' : 'language.en'),
      });
    case 'rule-target':
      return t('problem.ruleTarget', { name: p.name || id });
    case 'input-clash':
      return t('problem.inputClash', { name: id });
    case 'enum-values':
      return t('problem.enumValues', { name: variableName });
    default:
      return problem.message;
  }
}

export function ProblemText({ problem }: { readonly problem: StoryProblem }) {
  const t = useT();
  const doc = useDoc();
  useStudio((s) => s.locale);
  return <>{problemMessage(t, problem, doc)}</>;
}
