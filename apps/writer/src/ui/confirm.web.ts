/** Expo Web: the browser's own confirm dialog (OK performs `actionLabel`). */
export function confirmAction(
  title: string,
  message: string,
  actionLabel: string,
): Promise<boolean> {
  return Promise.resolve(globalThis.confirm(`${title}\n\n${message}\n\nOK = ${actionLabel}`));
}
