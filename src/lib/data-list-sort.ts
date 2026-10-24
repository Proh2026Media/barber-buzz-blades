/** Ordenação compartilhada das tabelas, sem alterar os dados recebidos. */
export type DataListSort = { key: string; direction: "ascending" | "descending" };
export type SortValue = string | number | boolean | null | undefined;
export type SortColumn<Row> = { key: string; sortValue?: (row: Row) => SortValue };

export function nextDataListSort(current: DataListSort | null, key: string): DataListSort {
  return {
    key,
    direction:
      current?.key === key && current.direction === "ascending" ? "descending" : "ascending",
  };
}

export function sortDataRows<Row>(
  rows: Row[],
  columns: SortColumn<Row>[],
  sort: DataListSort | null,
  locale: string,
): Row[] {
  const valueOf = columns.find((column) => column.key === sort?.key)?.sortValue;
  if (!sort || !valueOf) return rows;
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const missing = (value: SortValue) =>
    value == null || value === "" || (typeof value === "number" && !Number.isFinite(value));
  const direction = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    // Sem informação fica no fim nas duas direções; zero continua sendo um valor.
    if (missing(left)) return missing(right) ? 0 : 1;
    if (missing(right)) return -1;
    const comparison =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : typeof left === "boolean" && typeof right === "boolean"
          ? Number(left) - Number(right)
          : collator.compare(String(left), String(right));
    return comparison * direction;
  });
}
