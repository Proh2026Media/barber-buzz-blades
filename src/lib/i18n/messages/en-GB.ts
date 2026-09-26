import type { MessageKey } from "./pt-BR.ts";
import { enUS } from "./en-US.ts";

/** Inglês britânico: parte do inglês americano e sobrescreve só o que muda. */
export const enGB: Record<MessageKey, string> = {
  ...enUS,
  "auth.field.whatsapp": "WhatsApp number with area code",
  "auth.field.whatsappSignupShop": "WhatsApp number with area code (for appointment updates)",
  "auth.field.whatsappSignupOptional": "WhatsApp number with area code (optional)",
  "auth.info.codeSentIfAccount":
    "If there's an account with this WhatsApp number, we have sent a code.",
  "auth.info.resetLinkSent":
    "If there's an account with this email, we have sent a link to reset the password.",
  "errors.integration.googleNotReady":
    "The Google connection isn't ready in this environment yet. Please contact support.",
  "errors.rateLimit": "Too many attempts in a row. Please wait a minute and try again.",
  "landing.support":
    "Open your shop, share the link and manage bookings with the people who work there.",
  "landing.footer":
    "Booking, loyalty and management for barbershops — customers book appointments; the shop organises team, services and notices.",
  "register.shopNamePlaceholder": "E.g.: High Street Barbers",
  "register.whatsapp": "WhatsApp (with dialling code)",
  "register.errorWhatsapp": "Enter your WhatsApp number with dialling code.",
  "profile.whatsappNumber": "Number with dialling code",
  "level.maxText": "You've reached the top of the loyalty programme.",
  "booking.dayAria": "{weekday}, {day} {month}",
  "sports.football": "Football",
  "sports.extraTime": "Extra time",
  "sports.final": "Full time",
};
