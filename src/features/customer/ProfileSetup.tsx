import { NamePrompt } from "./NamePrompt";
type ProfileSetupProps = {
  userId: string | null;
  disabled: boolean;
  onNameSaved: (name: string) => void;
};

export function ProfileSetup(props: ProfileSetupProps) {
  return (
    <NamePrompt
      key={props.userId}
      userId={props.userId}
      disabled={props.disabled}
      onSaved={props.onNameSaved}
    />
  );
}
