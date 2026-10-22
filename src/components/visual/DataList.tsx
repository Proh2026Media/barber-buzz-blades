import type { KeyboardEvent, ReactNode } from "react";
import { useViewportAtLeast } from "@/lib/device";
import { cn } from "@/lib/utils";

export type DataListColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Largura da coluna na tabela (ex.: "8rem", "1fr", "20%"). */
  width?: string;
  align?: "start" | "center" | "end";
  /** Fica de fora dos cartões do celular (a coluna só aparece na tabela). */
  hideOnPhone?: boolean;
};

/**
 * Lista de dados com as colunas definidas uma vez: abaixo de 1024 px cada linha é um cartão
 * com "rótulo: valor"; a partir de 1024 px é uma tabela de verdade, com cabeçalho fixo, linhas
 * de 44 px (40 px com mouse) e linha clicável pelo teclado. A linha da tabela continua `<tr>`
 * (sem `role`), para o leitor de tela ler a tabela como tabela; a interação fica em tabIndex,
 * clique, Enter/Espaço e `aria-label` (rowLabel). CSS em src/styles/leiaute.css.
 *
 * ```tsx
 * <DataList
 *   rows={clientes}
 *   rowKey={(c) => c.id}
 *   columns={[
 *     { key: "nome", header: t("clients.name"), cell: (c) => c.name },
 *     { key: "fone", header: t("clients.phone"), cell: (c) => c.phone, width: "10rem" },
 *   ]}
 *   onRowClick={(c) => abrir(c.id)}
 *   empty={<EmptyState … />}
 * />
 * ```
 *
 * Cada `<col>`, `<th>` e `<td>` leva `data-col` com a chave da coluna, para o CSS de uma área
 * esconder ou ajustar uma coluna numa faixa (ex.: "Criada em" em src/styles/plataforma.css).
 *
 * TODO: ordenação por coluna (clicar no cabeçalho) fica para quando uma tela precisar.
 */
export function DataList<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
  rowLabel,
}: {
  columns: DataListColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  onRowClick?: (row: Row) => void;
  /** O que mostrar sem linhas (ex.: `EmptyState`). */
  empty?: ReactNode;
  className?: string;
  /** Nome acessível de cada cartão/linha clicável (ex.: o nome do cliente). */
  rowLabel?: (row: Row) => string;
}) {
  const table = useViewportAtLeast(1024);

  if (!rows.length) return empty ? <>{empty}</> : null;

  const clickable = Boolean(onRowClick);
  const onKey = (row: Row) => (event: KeyboardEvent<HTMLElement>) => {
    if (!onRowClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };
  // Cartão do celular: botão de verdade (role) para o toque e o leitor de tela.
  const interactive = (row: Row) =>
    clickable
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-label": rowLabel?.(row),
          onClick: () => onRowClick?.(row),
          onKeyDown: onKey(row),
        }
      : {};
  // Linha da tabela: sem role, para continuar sendo linha; foco, teclado e nome acessível.
  const interactiveRow = (row: Row) =>
    clickable
      ? {
          tabIndex: 0,
          "aria-label": rowLabel?.(row),
          onClick: () => onRowClick?.(row),
          onKeyDown: onKey(row),
        }
      : {};

  if (!table) {
    const phoneColumns = columns.filter((column) => !column.hideOnPhone);
    return (
      <ul className={cn("app-data-list-cards", className)}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="app-data-list-card app-action-card"
            data-clickable={clickable || undefined}
            {...interactive(row)}
          >
            {phoneColumns.map((column) => (
              <div key={column.key} className="app-data-list-card-row">
                <span className="app-data-list-card-label">{column.header}</span>
                <span className="app-data-list-card-value">{column.cell(row)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("app-data-list", className)}>
      <table className="app-data-list-table">
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.key}
              data-col={column.key}
              style={column.width ? { width: column.width } : undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-col={column.key}
                data-align={column.align ?? "start"}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} data-clickable={clickable || undefined} {...interactiveRow(row)}>
              {columns.map((column) => (
                <td key={column.key} data-col={column.key} data-align={column.align ?? "start"}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
