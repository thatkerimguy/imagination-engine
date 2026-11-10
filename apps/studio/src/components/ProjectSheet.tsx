import { createId } from '@ie/core';
import { samples } from '@ie/samples';
import { storyProjectSchema, type StoryProject } from '@ie/story';
import { BookOpen, Download, FilePlus2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DeleteButton } from '../data/DeleteButton.tsx';
import {
  projectStore,
  listProjects,
  parseStoryFile,
  type ProjectSummary,
} from '../project/storage.ts';
import {
  adoptProject,
  flushSave,
  openProject,
  removeProject,
  useDoc,
  useProject,
} from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { KitsSection } from './KitsSection.tsx';
import { NewProjectWizard } from './NewProjectWizard.tsx';

async function loadProjects(): Promise<ProjectSummary[]> {
  await flushSave();
  return listProjects(await projectStore());
}

function download(doc: StoryProject): void {
  const name = (doc.title.en || doc.title.tr || 'story')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .toLowerCase();
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.story.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The novel itself: its title, and opening, making, importing and exporting novels. */
export function ProjectSheet({ onClose }: { readonly onClose: () => void }) {
  const t = useT();
  const doc = useDoc();
  const locale = useStudio((s) => s.locale);
  const edit = useProject((s) => s.edit);
  const ref = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState('');
  const [wizard, setWizard] = useState(false);

  const reload = () => void loadProjects().then(setProjects);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    let live = true;
    void loadProjects().then((list) => live && setProjects(list));
    return () => {
      live = false;
    };
  }, []);

  const importFile = async (picked: File) => {
    try {
      const imported = parseStoryFile(await picked.text());
      // An import never overwrites a project silently; it becomes a new one.
      await adoptProject({ ...imported, id: createId('n') });
      ref.current?.close();
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'not-json'
          ? t('project.notJson')
          : t('project.invalid'),
      );
    }
  };

  const date = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const setTitle = (key: 'en' | 'tr', value: string) =>
    edit((d) => ({ ...d, title: { ...d.title, [key]: value } }), `title:${key}`);

  return (
    <dialog
      ref={ref}
      className="ie-dialog project-sheet"
      aria-labelledby="project-title"
      data-testid="project-sheet"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && ref.current?.close()}
    >
      <header className="ie-dialog__header">
        <h2 className="ie-dialog__title" id="project-title">
          {wizard ? t('wizard.title') : t('project.title')}
        </h2>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          onClick={() => ref.current?.close()}
        >
          {t('close')}
        </button>
      </header>
      {wizard ? (
        <div className="ie-dialog__body">
          <NewProjectWizard
            onCreated={() => ref.current?.close()}
            onCancel={() => setWizard(false)}
          />
        </div>
      ) : (
        <div className="ie-dialog__body">
          <div className="card__grid">
            <label className="labelled">
              <span className="ie-label">{t('project.nameEn')}</span>
              <input
                className="field"
                value={doc.title.en ?? ''}
                data-testid="project-name-en"
                onChange={(e) => setTitle('en', e.target.value)}
              />
            </label>
            <label className="labelled">
              <span className="ie-label">{t('project.nameTr')}</span>
              <input
                className="field"
                lang="tr"
                value={doc.title.tr ?? ''}
                onChange={(e) => setTitle('tr', e.target.value)}
              />
            </label>
          </div>
          <div className="page__actions">
            <button
              type="button"
              className="ie-button"
              data-testid="project-new"
              onClick={() => setWizard(true)}
            >
              <FilePlus2 size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('project.new')}
            </button>
            <button
              type="button"
              className="ie-button"
              data-testid="project-sample"
              onClick={() => {
                const sample = storyProjectSchema.parse(samples.rainAlley) as StoryProject;
                void adoptProject({ ...sample, id: createId('n') }).then(() =>
                  ref.current?.close(),
                );
              }}
            >
              <BookOpen size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('project.sample')}
            </button>
            <button type="button" className="ie-button" onClick={() => file.current?.click()}>
              <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('project.import')}
            </button>
            <button
              type="button"
              className="ie-button"
              data-testid="project-export"
              onClick={() => download(doc)}
            >
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('project.export')}
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const picked = event.target.files?.[0];
                event.target.value = '';
                if (picked) void importFile(picked);
              }}
            />
          </div>
          {error && (
            <p className="formula__error" role="alert">
              {error}
            </p>
          )}
          <KitsSection doc={doc} />
          <h3 className="ie-label project-sheet__list-title">{t('project.all')}</h3>
          <ul className="project-list" data-testid="project-list">
            {projects.map((p) => (
              <li
                key={p.id}
                className="project-list__item"
                aria-current={p.id === doc.id ? 'true' : undefined}
              >
                <button
                  type="button"
                  className="project-list__open"
                  disabled={p.id === doc.id}
                  onClick={() => void openProject(p.id).then(() => ref.current?.close())}
                >
                  <span className="project-list__name">
                    {labelText(p.title, locale, t('app.untitled'))}
                  </span>
                  <span className="hint">
                    {p.id === doc.id ? t('project.open') : date.format(p.updatedAt)}
                  </span>
                </button>
                {p.id !== doc.id && (
                  <DeleteButton uses={1} onDelete={() => void removeProject(p.id).then(reload)} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </dialog>
  );
}
