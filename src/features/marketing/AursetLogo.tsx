import { AursetLogo as Logo } from "@/components/visual/AursetLogo";

/** Logo aurset da página inicial: embrulha o desenho único de src/components/visual. */
export function AursetLogo({ className, title }: { className?: string; title?: string }) {
  return <Logo variant="completa" className={className} title={title} />;
}
