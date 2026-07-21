import type { RegisterSort } from "./Register";

export function sortRecords<T>(
  items: T[],
  sort: RegisterSort,
  getValue: (item: T, field: string) => string | number | null
): T[] {
  return [...items].sort((left, right) => {
    const leftValue = getValue(left, sort.field);
    const rightValue = getValue(right, sort.field);
    if (leftValue === rightValue) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    const result = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    return sort.direction === "asc" ? result : -result;
  });
}
