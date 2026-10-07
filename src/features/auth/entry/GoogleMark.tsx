import { cn } from "@/lib/utils";

/** Marca do Google (cores oficiais), usada nos botões e telas de conexão com o Google. */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5 shrink-0", className)} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.57-5.17 3.57-8.66Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.2 7.2 0 0 1-10.72-3.78H1.35v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.35 14.31A7.2 7.2 0 0 1 4.97 12c0-.8.14-1.58.38-2.31V6.6H1.35A12 12 0 0 0 0 12c0 1.94.46 3.77 1.35 5.4l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.35 6.6l4 3.09A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
  );
}
