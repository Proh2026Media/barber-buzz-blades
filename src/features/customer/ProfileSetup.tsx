import { useCallback, useState } from "react";
import { Steps } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { NamePrompt, type NamePromptState } from "./NamePrompt";
import { WhatsappConfirmBanner } from "./WhatsappConfirmBanner";

/**
 * "Complete seu cadastro" no Início: nome e WhatsApp como etapas de um mesmo caminho, uma por
 * vez. Com as duas pendentes, mostra "Etapa 1 de 2 · Seu nome"; salvo o nome, aparece a do
 * WhatsApp. Cada etapa continua dispensável ("Agora não").
 */
type ProfileSetupProps = {
  userId: string | null;
  disabled: boolean;
  onNameSaved: (name: string) => void;
};

export function ProfileSetup(props: ProfileSetupProps) {
  return <AccountProfileSetup key={props.userId ?? "sem-conta"} {...props} />;
}

function AccountProfileSetup({ userId, disabled, onNameSaved }: ProfileSetupProps) {
  const { t } = useI18n();
  const [nameState, setNameState] = useState<NamePromptState>("hidden");
  const [whatsPending, setWhatsPending] = useState(false);
  const onNameState = useCallback((state: NamePromptState) => setNameState(state), []);
  const onWhats = useCallback((visible: boolean) => setWhatsPending(visible), []);

  const nameInFlow = nameState !== "hidden";
  const both = nameInFlow && whatsPending;
  const steps = (current: 0 | 1) =>
    both ? (
      <Steps
        compact
        label={t("setup.title")}
        steps={[
          {
            key: "name",
            label: t("setup.stepName"),
            status: current === 0 ? "current" : "done",
          },
          {
            key: "whats",
            label: t("setup.stepWhats"),
            status: current === 1 ? "current" : "upcoming",
          },
        ]}
      />
    ) : null;

  return (
    <>
      <NamePrompt
        userId={userId}
        disabled={disabled}
        onSaved={onNameSaved}
        onStateChange={onNameState}
        header={steps(0)}
      />
      <WhatsappConfirmBanner
        userId={userId}
        disabled={disabled}
        hidden={nameState === "open"}
        onVisibleChange={onWhats}
        header={steps(1)}
      />
    </>
  );
}
