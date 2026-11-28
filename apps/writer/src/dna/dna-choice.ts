// Pure selection model for the Visual DNA option chips: exactly one chip per group is active.
export interface ChipState<T extends string> {
  value: T;
  active: boolean;
}

export function chipStates<T extends string>(values: readonly T[], current: T): ChipState<T>[] {
  return values.map((value) => ({ value, active: value === current }));
}
