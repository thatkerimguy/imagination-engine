// Which editor sheets are mounted. Only open sheets get a <Modal> tree, so none stay mounted
// (and re-render) while the Author types.
export type EditorSheet = 'analysis' | 'outline' | 'layout' | 'metrics' | 'versions' | null;

export interface OpenSheetState {
  sheet: EditorSheet;
  commentOpen: boolean;
  pickerOpen: boolean;
  gimmickSheetOpen: boolean;
}

export type MountedSheet = NonNullable<EditorSheet> | 'comment' | 'picker' | 'gimmick';

/** The sheets that must be mounted for this state (empty when everything is closed). */
export function sheetsToMount(s: OpenSheetState): MountedSheet[] {
  const out: MountedSheet[] = [];
  if (s.sheet) out.push(s.sheet);
  if (s.commentOpen) out.push('comment');
  if (s.pickerOpen) out.push('picker');
  if (s.gimmickSheetOpen) out.push('gimmick');
  return out;
}
