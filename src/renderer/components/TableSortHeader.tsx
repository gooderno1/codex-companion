import { nextTableSort, type TableSortState } from "../../shared/tableSort";

export function TableSortHeader<Key extends string>({ label, sortKey, sort, onSort }: {
  label: string; sortKey: Key; sort: TableSortState<Key>; onSort: (key: Key) => void;
}) {
  const active = sort.key === sortKey;
  const nextDirection = nextTableSort(sort, sortKey).direction === "asc" ? "升序" : "降序";
  return <th scope="col" className={active ? "sort-active" : undefined} aria-sort={active ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
    <button type="button" className={`project-sort-heading${active ? " active" : ""}`} onClick={() => onSort(sortKey)} aria-label={`按${label}${nextDirection}排序`} title={`按${label}${nextDirection}排序`}>
      <span>{label}</span><span className="sort-indicator" aria-hidden="true">{active ? sort.direction === "asc" ? "↑" : "↓" : "↕"}</span>
    </button>
  </th>;
}
