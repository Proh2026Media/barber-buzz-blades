import { Hourglass } from "lucide-react";
import { useApprovalNote } from "./approval-note";
import { Hint } from "./Hint";

/** Linha com ampulheta, junto do botão Salvar. Some quando a mudança vale na hora. */
export function ApprovalNote({ className }: { className?: string }) {
  const note = useApprovalNote();
  if (!note) return null;
  return (
    <Hint icon={Hourglass} tone="pending" className={className}>
      <span className="font-semibold text-foreground">{note}</span>
    </Hint>
  );
}
