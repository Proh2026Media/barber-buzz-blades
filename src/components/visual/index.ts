/**
 * Componentes visuais comuns (ver docs/mb-interface.md, seção 4, "Componentes visuais comuns").
 * Um só jeito de mostrar estado, resultado, escolha, número, etapa e vazio em todo o sistema.
 */
export { TONES, TONE_CLASS, TONE_ICON, TONE_URGENCY, type Tone } from "./tones";
export {
  ACTION_STATE,
  APPOINTMENT_DERIVED,
  APPOINTMENT_STATUS,
  STATE,
  type ActionState,
  type AppointmentStatus,
  type StatusMeta,
} from "./status";
export { announce } from "./announce";
export { focusFirstInvalid, personColor, personInitials, readableLink } from "./helpers";

export {
  AppointmentStatusBadge,
  CountBadge,
  StatusBadge,
  Tag,
  type StatusBadgeProps,
} from "./StatusBadge";
export { IconTile, SectionHeader, type IconTileTone } from "./SectionHeader";
export { StatTile, type StatDelta } from "./StatTile";
export { ActionResult, InlineStatus, Notice, type NoticeAction, type NoticeProps } from "./Notice";
export { Hint, IconList, MoreDetails, type IconListItem, type IconListTone } from "./Hint";
export { ChoiceChips, type ChoiceChipOption, type ChoiceChipsOther } from "./ChoiceChips";
export { ChoiceCards, type ChoiceCardOption } from "./ChoiceCards";
export { Steps, type StepItem, type StepStatus } from "./Steps";
export { Timeline, type TimelineKind, type TimelineRow } from "./Timeline";
export { PreviewPanel, TimeChips } from "./Preview";
export { SegmentBar, type Segment } from "./SegmentBar";
export { Countdown } from "./Countdown";
export { ConfirmDialog, type ConfirmTone } from "./ConfirmDialog";
export { MoreActions, type MoreAction } from "./MoreActions";
export { CopyField } from "./CopyField";
export { PersonAvatar } from "./PersonAvatar";
export { SettingRow } from "./SettingRow";
export { DetailList, type DetailItem } from "./DetailList";
export { Field, FieldMessage, type FieldControlProps } from "./Field";
export { LoadingState } from "./LoadingState";
export { AttentionList, type AttentionItem } from "./AttentionList";
export { UnsavedBar } from "./UnsavedBar";
export { EmptyState, type EmptyTone } from "@/components/ui/empty-state";
