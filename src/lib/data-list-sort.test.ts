import assert from "node:assert/strict";
import test from "node:test";
import { nextDataListSort, sortDataRows } from "./data-list-sort.ts";

const columns = [
  { key: "value", sortValue: (row: { value: string | number | null }) => row.value },
];
const asc = { key: "value", direction: "ascending" } as const;
const desc = { key: "value", direction: "descending" } as const;

test("cabeçalho começa crescente, inverte e reinicia ao escolher outra coluna", () => {
  assert.deepEqual(nextDataListSort(null, "value"), asc);
  assert.deepEqual(nextDataListSort(asc, "value"), desc);
  assert.deepEqual(nextDataListSort(desc, "value"), asc);
  assert.deepEqual(nextDataListSort(desc, "other"), { key: "other", direction: "ascending" });
});

test("valores numéricos são comparados como números e a entrada não é alterada", () => {
  const rows = [{ value: 1000 }, { value: 20 }, { value: 3 }, { value: 0 }];
  assert.deepEqual(
    sortDataRows(rows, columns, asc, "pt-BR").map((r) => r.value),
    [0, 3, 20, 1000],
  );
  assert.deepEqual(
    sortDataRows(rows, columns, desc, "pt-BR").map((r) => r.value),
    [1000, 20, 3, 0],
  );
  assert.deepEqual(
    rows.map((r) => r.value),
    [1000, 20, 3, 0],
  );
});

test("nomes respeitam acentos, números naturais e estabilidade dos empates", () => {
  const rows = [
    { value: "Zeca" },
    { value: "Álvaro" },
    { value: "Alvaro" },
    { value: "Loja 10" },
    { value: "Loja 2" },
  ];
  assert.deepEqual(sortDataRows(rows, columns, asc, "pt-BR"), [
    rows[1],
    rows[2],
    rows[4],
    rows[3],
    rows[0],
  ]);
});

test("ausências ficam no fim nas duas direções sem tratar zero como ausência", () => {
  const rows = [{ value: null }, { value: 0 }, { value: 9 }, { value: NaN }];
  for (const sort of [asc, desc]) {
    const sorted = sortDataRows(rows, columns, sort, "pt-BR");
    assert.deepEqual(sorted.slice(2), [rows[0], rows[3]]);
  }
});

test("a primeira página contém os maiores de toda a lista ao ordenar antes do recorte", () => {
  const rows = Array.from({ length: 60 }, (_, value) => ({ value }));
  assert.deepEqual(
    sortDataRows(rows, columns, desc, "pt-BR")
      .slice(0, 25)
      .map((r) => r.value),
    Array.from({ length: 25 }, (_, i) => 59 - i),
  );
});

test("coluna removida ou sem ordenação conserva a ordem recebida", () => {
  const rows = [{ value: 2 }, { value: 1 }];
  assert.equal(sortDataRows(rows, columns, null, "pt-BR"), rows);
  assert.equal(sortDataRows(rows, [], asc, "pt-BR"), rows);
});
