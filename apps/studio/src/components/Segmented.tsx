export interface SegmentedOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

interface SegmentedProps<V extends string> {
  readonly label: string;
  readonly options: readonly SegmentedOption<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  readonly className?: string;
}

export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<V>) {
  return (
    <div
      className={className ? `ie-segmented ${className}` : 'ie-segmented'}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
