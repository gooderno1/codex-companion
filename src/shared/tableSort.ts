export type TableSortDirection = "asc" | "desc";
export interface TableSortState<Key extends string> { key: Key; direction: TableSortDirection }
export function nextTableSort<Key extends string>(current: TableSortState<Key>, key: Key): TableSortState<Key> {
  return { key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" };
}

const collator = new Intl.Collator("zh-CN", { numeric: true });
/** 先对全部结果排序，再由调用方分页；缺失值始终置后，同值按稳定键排序。 */
export function sortTableRows<Row, Key extends string>(
  rows: readonly Row[], sort: TableSortState<Key>,
  value: (row: Row, key: Key) => string | number | null | undefined,
  identity: (row: Row) => string
): Row[] {
  return [...rows].sort((a, b) => {
    const left = value(a, sort.key), right = value(b, sort.key);
    const missingLeft = left === null || left === undefined || (typeof left === "number" && !Number.isFinite(left));
    const missingRight = right === null || right === undefined || (typeof right === "number" && !Number.isFinite(right));
    if (missingLeft !== missingRight) return missingLeft ? 1 : -1;
    const comparison = missingLeft ? 0 : typeof left === "number" && typeof right === "number" ? left - right : collator.compare(String(left), String(right));
    return comparison ? (sort.direction === "asc" ? comparison : -comparison) : collator.compare(identity(a), identity(b));
  });
}
