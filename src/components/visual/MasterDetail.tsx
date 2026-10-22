import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Mestre-detalhe: lista à esquerda e o item aberto à direita a partir de 1024 px (lista de
 * 20rem; 22rem a partir de 1280 px), com a lista acompanhando a rolagem e rolando por dentro.
 * Abaixo de 1024 px mostra só a lista (`open={false}`) ou só o detalhe (`open={true}`); quem
 * decide é o chamador, pela URL (`?secao=` / `?item=`), como hoje. Os dois ficam montados, só
 * escondidos por CSS (src/styles/leiaute.css), para não piscar na hidratação.
 *
 * ```tsx
 * <MasterDetail open={Boolean(secao)} list={<SettingsList />} detail={secao && <Section />} />
 * ```
 */
export function MasterDetail({
  list,
  detail,
  open,
  listWidth = "20rem",
  listWidthWide = "22rem",
  gap = "1.5rem",
  className,
  listClassName,
  detailClassName,
}: {
  list: ReactNode;
  detail: ReactNode;
  /** Há um item aberto (no celular, mostra o detalhe no lugar da lista). */
  open: boolean;
  /** Largura da lista a partir de 1024 px. */
  listWidth?: string;
  /** Largura da lista a partir de 1280 px. */
  listWidthWide?: string;
  gap?: string;
  className?: string;
  listClassName?: string;
  detailClassName?: string;
}) {
  return (
    <div
      className={cn("app-master-detail", className)}
      data-open={open ? "true" : "false"}
      style={
        {
          "--md-list": listWidth,
          "--md-list-wide": listWidthWide,
          "--md-gap": gap,
        } as CSSProperties
      }
    >
      <div className={cn("app-master-detail-list", listClassName)}>{list}</div>
      <div className={cn("app-master-detail-detail", detailClassName)}>{detail}</div>
    </div>
  );
}
