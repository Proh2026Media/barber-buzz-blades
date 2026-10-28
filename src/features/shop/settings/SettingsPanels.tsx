import { Children, cloneElement, isValidElement, useId, type ReactNode } from "react";
import { useViewportAtLeast } from "@/lib/device";
import { cn } from "@/lib/utils";

type PanelProps = {
  id: string;
  label: string;
  children: ReactNode;
  active?: boolean;
  controlId?: string;
};

/** Mantém os formulários montados; no celular todos continuam na ordem anterior. */
export function SettingsPanel({ id, children, active = true, controlId }: PanelProps) {
  const wide = useViewportAtLeast(768);
  return (
    <div
      id={controlId ?? id}
      style={{ display: wide ? (active ? "block" : "none") : "contents", gridColumn: "1 / -1" }}
    >
      {children}
    </div>
  );
}

export function SettingsPanels({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  const prefix = useId();
  const panels = Children.toArray(children).filter(isValidElement<PanelProps>);
  const active = panels.some((panel) => panel.props.id === value) ? value : panels[0]?.props.id;
  return (
    <>
      <nav
        aria-label={label}
        className="hidden flex-wrap gap-2 tablet:flex"
        style={{ gridColumn: "1 / -1" }}
      >
        {panels.map((panel) => (
          <button
            key={panel.props.id}
            type="button"
            aria-pressed={active === panel.props.id}
            aria-controls={`${prefix}-${panel.props.id}`}
            onClick={() => onChange(panel.props.id)}
            className={cn(
              "min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold",
              active === panel.props.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40",
            )}
          >
            {panel.props.label}
          </button>
        ))}
      </nav>
      {panels.map((panel) =>
        cloneElement(panel, {
          active: panel.props.id === active,
          controlId: `${prefix}-${panel.props.id}`,
        }),
      )}
    </>
  );
}
