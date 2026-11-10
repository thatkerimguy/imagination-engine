import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../store.ts';

/** Delete that asks once more when the item is still used somewhere. */
export function DeleteButton({
  uses,
  onDelete,
}: {
  readonly uses: number;
  readonly onDelete: () => void;
}) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);
  return (
    <button
      type="button"
      className="ie-button ie-button--quiet"
      data-danger
      onClick={() => {
        if (uses > 0 && !asking) return setAsking(true);
        onDelete();
      }}
    >
      <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
      {asking ? t('data.deleteUsed', { count: uses }) : t('data.delete')}
    </button>
  );
}
