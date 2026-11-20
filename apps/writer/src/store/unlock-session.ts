// In-memory unlock state for this app session (never persisted): whether the Master Lock has been
// passed, and which individually locked items were unlocked. LockGate writes it; Search and the
// list screens read it so locked bodies stay hidden until unlocked.
type Listener = () => void;

let masterUnlocked = false;
const unlockedItems = new Set<string>();
const listeners = new Set<Listener>();

const emit = (): void => {
  for (const l of listeners) l();
};

export const unlockSession = {
  isMasterUnlocked: (): boolean => masterUnlocked,
  setMasterUnlocked(next: boolean): void {
    if (masterUnlocked === next) return;
    masterUnlocked = next;
    emit();
  },
  isItemUnlocked: (id: string): boolean => unlockedItems.has(id),
  unlockItem(id: string): void {
    if (unlockedItems.has(id)) return;
    unlockedItems.add(id);
    emit();
  },
  /** Re-locks everything (app backgrounded with Master Lock on, or "Lock now"). */
  lockAll(): void {
    masterUnlocked = false;
    unlockedItems.clear();
    emit();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Whether an item's body must stay hidden: it is locked and not unlocked this session. */
export function isRedacted(id: string, meta: { locked?: boolean } | undefined): boolean {
  return meta?.locked === true && !unlockedItems.has(id);
}
