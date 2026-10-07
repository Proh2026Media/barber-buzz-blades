import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import { cn } from "@/lib/utils";

/**
 * Campo de código de 6 números: seis caixas quadradas que sempre cabem na largura (de 320 px
 * em diante, até 56 px cada), números grandes, colar e preenchimento automático do celular
 * (`one-time-code`). Estados: normal, erro (borda vermelha nas 6 caixas) e certo (verde).
 * O aviso de erro fica logo abaixo, com `FieldMessage` ou `Notice`, ligado por `describedBy`.
 */
export function CodeInput({
  id,
  value,
  onChange,
  label,
  invalid,
  success,
  describedBy,
  autoFocus,
  disabled,
  onComplete,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Nome acessível quando não há `<label htmlFor={id}>` visível. */
  label?: string;
  invalid?: boolean;
  success?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onComplete?: (value: string) => void;
  className?: string;
}) {
  return (
    <OTPInput
      id={id}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      maxLength={6}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={REGEXP_ONLY_DIGITS}
      // Sem a folga para gerenciador de senha: ela alargava o campo e criava rolagem lateral.
      pushPasswordManagerStrategy="none"
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      containerClassName={cn("entry-code w-full has-[:disabled]:opacity-60", className)}
      render={({ slots }) => (
        <div className="flex w-full gap-1.5 min-[360px]:gap-2">
          {slots.map((slot, index) => (
            <CodeSlot key={index} slot={slot} invalid={invalid} success={success} />
          ))}
        </div>
      )}
    />
  );
}

function CodeSlot({
  slot,
  invalid,
  success,
}: {
  slot: SlotProps;
  invalid?: boolean;
  success?: boolean;
}) {
  return (
    <div
      aria-hidden
      data-active={slot.isActive || undefined}
      data-filled={slot.char ? true : undefined}
      data-state={invalid ? "error" : success ? "success" : undefined}
      className="entry-code-slot relative grid aspect-square min-w-0 max-w-14 flex-1 place-items-center text-xl font-bold tabular-nums"
    >
      {slot.char}
      {slot.hasFakeCaret && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-6 w-px bg-foreground motion-safe:animate-caret-blink" />
        </span>
      )}
    </div>
  );
}
