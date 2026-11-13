import { enUS } from "./en-US.ts";
import type { MessageKey } from "./pt-BR.ts";

export const enGB: Record<MessageKey, string> = {
  ...enUS,
  "waRefine.stats": "Statistics and suggestions",
  "waRefine.future": "New · not implemented yet",
  "waRefine.futureHint":
    "Development proposal: measure sends, active days and uses by destination. “Warm-up” does not guarantee account health or prevent restrictions.",
  "waRefine.volume": "Sends per period",
  "waRefine.days": "Active days",
  "waRefine.usage": "Uses by barbershop",
  "waRefine.suggestions": "Distribution suggestions",
  "waRefine.noData": "Measurement not available yet",

  "waDistribution.title": "Number distribution",
  "waDistribution.hint":
    "Select a number, then tap Primary or Backup. On a computer, you can also drag it.",
  "waDistribution.numbers": "Your numbers",
  "waDistribution.numberSearch": "Search number or name",
  "waDistribution.destinations": "Barbershops and team",
  "waDistribution.destinationSearch": "Search barbershop or professional",
  "waDistribution.primary": "Primary",
  "waDistribution.backup": "Backup",
  "waDistribution.primaryCount": "Primary for {count}",
  "waDistribution.backupCount": "Backup for {count}",
  "waDistribution.unused": "No assignments",
  "waDistribution.selected": "Selected",
  "waDistribution.selectNumber": "Select {number}",
  "waDistribution.selectionReady":
    "{number} selected. Choose Primary or Backup for the destination.",
  "waDistribution.clearSelection": "Cancel selection",
  "waDistribution.emptyNumbers": "No phone numbers registered.",
  "waDistribution.emptySearch": "No results for this search.",
  "waDistribution.emptyShops": "No barbershops registered.",
  "waDistribution.allShops": "All",
  "waDistribution.missingPrimary": "No primary",
  "waDistribution.missingBackup": "No backup",
  "waDistribution.wholeShop": "Whole barbershop",
  "waDistribution.usesGeneral": "Uses shop number",
  "waDistribution.personalized": "Own number",
  "waDistribution.choose": "Choose number",
  "waDistribution.change": "Change",
  "waDistribution.remove": "Remove",
  "waDistribution.slotLabel": "Choose {role} for {name}",
  "waDistribution.applySelected": "Use {number} as {role} for {name}",
  "waDistribution.noPrimary": "No primary",
  "waDistribution.noBackup": "No backup",
  "waDistribution.sameNumber": "Choose different primary and backup numbers for this destination.",
  "waDistribution.invalidNumber": "This number is unavailable. Refresh the list.",
  "waDistribution.unsaved": "Unsaved changes",
  "waDistribution.save": "Save distribution",
  "waDistribution.saving": "Saving…",
  "waDistribution.saved": "Distribution saved",
  "waDistribution.cancel": "Cancel changes",
  "waDistribution.saveError": "Could not save. Your choices have been kept.",
  "waDistribution.notices": "Notifications",
  "waDistribution.noticesOn": "Notifications on",
  "waDistribution.noticesOff": "Notifications paused",
  "waDistribution.sendUsing": "Send using",
  "waDistribution.backupActive": "Backup in use",
  "waDistribution.returns": "Return reminders",
  "waDistribution.technical": "I confirm a technical failure with the primary number.",
  "waDistribution.technicalHint":
    "The backup is activated manually. Do not use it to bypass WhatsApp restrictions.",
  "waDistribution.connectionOpen": "Connected",
  "waDistribution.connectionClosed": "Disconnected",
  "waDistribution.connectionPending": "Connecting",
  "waDistribution.connectionUnknown": "Unconfirmed",
  "waDistribution.readOnly": "Distribution is being prepared in this environment.",
  "waDistribution.inspect": "View number",
  "waDistribution.customize": "Customise",
  "waDistribution.draftApplied": "{number} chosen as {role} for {name}. Save to apply.",
  "waDistribution.numbersHint": "The same number can serve multiple destinations.",
  "waDistribution.dragHint": "Drag number",
  "waDistribution.technicalRequired": "Confirm the technical failure before using the backup.",
  "waDistribution.primaryRequired": "Choose a primary number before saving.",
  "waDistribution.confirmRemove": "Remove the configuration for this destination.",
  "waDistribution.removeGeneralHint": "The barbershop will have no general number.",
  "waDistribution.removeOwnHint":
    "This professional will use the barbershop’s general number again.",
  "waDistribution.editDistribution": "Edit distribution",
  "waDistribution.invalidPair": "Choose different primary and backup numbers.",
  "waDistribution.byDestination": "Set primary and backup numbers in the barbershop distribution.",
  "waDistribution.personalNumber":
    "This is a personal phone number and cannot send system notifications.",
  "waDistribution.numberUnavailable":
    "Choose a registered operational number. Personal phone numbers cannot send notifications.",
  "waDistribution.sendingPaused":
    "Sending is paused. Review the pause before enabling this destination.",
  "waPreview.title": "WhatsApp centre",
  "waPreview.notice": "Local preview • fictional data",
  "waPreview.reset": "Reset preview",
  "waPreview.noRemote": "No real connections or messages",
  "waPreview.saved": "Distribution saved in this preview.",
  "waPreview.number": "Fictional number. This preview does not connect accounts or send messages.",
  "waOrg.shops": "Distribution",
  "waOrg.shopsHint": "Primary and backup numbers by barbershop or professional.",
  "waOrg.numbersHint": "Connections and uses of each phone number.",

  "legal.club.heroBodyGeneric":
    "The loyalty club is an optional programme run by each barbershop that uses Barba & Cabelo. The exact rules — points, levels, perks and rewards — depend on each barbershop.",
  "legal.club.earnNote":
    "Points are added when the barbershop marks the appointment as completed. Cancelled or missed appointments don't earn points.",
  "auth.field.whatsapp": "WhatsApp number with area code",
  "auth.field.whatsappSignupShop": "WhatsApp number with area code",
  "auth.info.codeSentIfAccount":
    "If there's an account with this WhatsApp number, we have sent a code.",
  "auth.info.resetLinkSent":
    "If there's an account with this email, we have sent a link to reset the password.",
  "errors.integration.googleNotReady":
    "The Google connection isn't ready in this environment yet. Please contact support.",
  "errors.rateLimit": "Too many attempts in a row. Please wait a minute and try again.",
  "register.shopNamePlaceholder": "E.g.: High Street Barbers",
  "register.whatsapp": "WhatsApp (with dialling code)",
  "register.errorWhatsapp": "Enter your WhatsApp number with dialling code.",
  "profile.whatsappNumber": "Number with dialling code",
  "booking.favorite": "Favourite",
  "booking.favoriteSaved": "{name} is now your favourite",
  "sports.football": "Football",
  "sports.extraTime": "Extra time",
  "sports.final": "Full time",
  "legal.terms.s2Body2":
    "Optional integrations (for example, the shop's WhatsApp or Google Calendar/Contacts) depend on a connection and authorisation made by the person in charge of the barbershop.",
  "legal.terms.s3Item3":
    "Information provided must be true and up to date. Abusive use, fraud or attempted unauthorised access may result in suspension or closure of the account.",
  "legal.privacy.s3Item4":
    "**Legal or regulatory obligation** (art. 7, II) and **regular exercise of rights** (art. 7, VI): keeping records required by law and defence in legal proceedings.",
  "legal.privacy.s4CalendarItem2":
    "**Events from the chosen calendar:** when you tap Sync calendar, we read events from 7 days before to 60 days after the current date and store only each event's title, start, end, whether it is all-day, the source calendar and the event link. We do not store the description, attendees, organiser, location or the full event. These events are shown only to you, under Settings → Notifications and integrations → Google Calendar and Contacts, in the “Upcoming Google Calendar events” list, so you can see busy times whilst managing bookings; no other barbershop member and no member of the public has access to them. The copy is refreshed on each sync and deleted when you disconnect or delete your account.",
  "legal.privacy.s4Commit2":
    "**We do not sell** Google user data and **we do not use it for advertising**, including personalised, retargeted or interest-based ads.",
  "legal.privacy.s4Commit3":
    "**We do not use Google user data to develop, improve or train generalised artificial intelligence or machine learning models.**",
  "legal.privacy.s4Commit5":
    "**No one on our team reads your Google user data**, unless you give express consent for a specific case (for example, a support request you make), when necessary for security purposes (investigating abuse or an incident), to comply with the law, or in aggregated and anonymised form for internal operations.",
  "legal.privacy.s5Item7":
    "**Protected Google connection:** the authorisation request is signed (HMAC), tied to your account and expires in 10 minutes. Google returns the authorisation only to the redirect address registered in our project, and the code is exchanged for tokens on the server, using the app's secret key — tokens never pass through the browser. This way, someone else cannot link their Google account to your account in the app or reuse an intercepted authorisation.",
  "legal.privacy.s5Item8":
    "**Data minimisation:** we ask only for data tied to the features you use; optional data stays off until you allow it, and when you withdraw permission the optional usage records are deleted.",
  "legal.privacy.s5Item10":
    "**Technical logs:** the server logs incoming requests (such as date, time, origin and result), which allows us to investigate unauthorised access and errors.",
  "legal.privacy.s6Item1":
    "**The barbershop where you book:** the owner, partners and authorised staff see the data needed to serve you (name, contact details and appointments), according to the shop's permissions;",
  "legal.privacy.s10Item3":
    "anonymisation, blocking or deletion of unnecessary or excessive data, or data processed in breach of the law;",
  "legal.privacy.s11Item4":
    "**Revoke at Google:** you can also remove Barba & Cabelo's access directly at Google, at any time, at {link}.",
  "plat.shell.brandOpenError": "Couldn't open the customisation. Please try again.",
  "plat.shops.customize": "Customise",
  "plat.newShop.customizeNow": "Customise now",
  "plat.brand.title": "Customise {name}",
  "shop.agenda.listAria": "Day's appointments",
  "ins.q.service_interest.coloring": "Hair colouring",
  "brand.icon.barbaEBigode": "Beard and moustache",
  "brand.icon.bigode": "Moustache",
  "brand.icon.cores": "Colours",
  "brand.icon.pincelDeCor": "Colour brush",
  "brand.icon.tenis": "Trainer",
  "brand.icon.refrigerante": "Soft drink",
  "brand.icon.doce": "Sweets",
  "brand.icon.biscoito": "Biscuit",
  "brand.icon.check": "Tick",
  "brand.validate.colors": "Check the colours. Use the hex format #RRGGBB.",
  "brand.layout.cardHint": "Highlights the form in a centred card over the image.",
  "app.google.denied":
    "Connection cancelled on Google. If you saw “app not verified”, use Advanced → continue.",
  "team.partner.rhythmTitle": "Your clients' rhythm",
  "brand.colors.contrast":
    "Automatic contrast is on: the system picks light or dark text and icons and strengthens the colour when it would blend in, without changing the brand's background colour.",
  "brand.colors.primary": "Main colour",
  "brand.colors.accent": "Accent colour",
  "brand.color.triggerAria": "{label}: {value}. Open colour picker",
  "brand.color.hexLabel": "Colour code",
  "brand.color.other": "Other colour",
  "brand.loginPreview.mobile": "Mobile",
  "brand.crop.zoomValue": "{value} per cent",
  "brand.crop.recenter": "Re-centre",
  "landingEditor.description":
    "This is what customers see when they open your barbershop's address. Logo, colours and photo come from your brand identity.",
  "fix.ajustes-marca.domainNothingPending": "No domain is awaiting verification.",
  "fix2.edge.otpTooManyAttempts": "Too many incorrect codes. Request a new code to continue.",
  "fix2.edge.whatsappUnavailable":
    "We couldn't send the WhatsApp message just now. Please try again in a few minutes.",
  "legal.privacy.s11Item3":
    "**Disconnect Calendar/Contacts:** in the shop dashboard, under Settings → Notifications and integrations → Google Calendar and Contacts, use the disconnect option. We immediately revoke the authorisation with Google and delete the tokens, the connected Google account's email and the imported events from our database. If the revocation with Google fails (for example, because of a network error or an already expired token), the app still disconnects and we tell you to remove access at myaccount.google.com/permissions. Events already copied to your Google Calendar stay there and you can delete them.",
  "fix3.google.disconnectedRevoked":
    "Google disconnected. The app's access to your Google Account has been revoked and imported data has been deleted.",
  "fix3.auth.phoneUnavailable":
    "We can't send the WhatsApp code at the moment. Your account is ready: tap Continue and confirm your number later in My profile.",
  "fix3.auth.phoneError":
    "We couldn't confirm your WhatsApp at the moment. Try again or confirm it later in My profile.",
  "fix3.errors.accountWithoutEmail":
    "This account doesn't have an email yet. Contact the barbershop to complete your registration.",
  "legal.privacy.s11Item5":
    "When you **delete your account**, we ask Google to revoke the authorisation (if a connection exists) and delete the connection, the tokens and the imported events. To check, visit {link}. Questions or deletion requests: {email}.",
  "legal.terms.s3Item4":
    "You must be 18 or over to use the app. Customers under 18 may use it only with permission from a parent or guardian. Anyone who registers a barbershop must be 18 or over and able to represent it.",
  "legal.dpa.s6Item4":
    "Google, only if the barbershop switches on the Google Calendar/Contacts connection.",
  "cad.cliente.whatsappHint":
    "We use it to confirm and remind you of your appointments. You can turn it off at any time.",
  "cad.cliente.phoneDddError": "Check the area code: it has 2 digits, such as 11 or 21.",
  "cad.cliente.phoneLengthError":
    "Check the number: area code and number, such as (11) 99999-0000.",
  "cad.cliente.confirmEmailWhatsapp":
    "We've sent a link to your email. Open it and sign in, then we'll confirm your WhatsApp with a code.",
  "cad.cliente.terms.age":
    "and confirm you are 18 or over (or use it with a parent or guardian's permission).",
  "cad.cliente.ownerLink": "Register your barbershop",
  "cad.dono.termsText":
    "I have read and accept the {terms}, the {privacy} and the {dpa} for barbershops. I am 18 or over and authorised to represent this barbershop.",
  "cad.dono.errTerms": "To create the account, tick the acceptance box.",
  "cad.guia.hoursHint": "We've set Monday to Saturday, 9:00 to 19:00.",
  "cad.guia.hoursOk": "That's right",
  "cad.guia.serviceHint": "E.g. haircut, beard. With price and duration.",
  "cad.guia.brandTitle": "Choose your logo and colours",
  "dec.termos.error": "We couldn't save that just now. Please try again.",
  "dec.whats.title": "Confirm your WhatsApp to receive reminders",
  "dec.whats.titleOwner": "Your WhatsApp hasn't been confirmed yet",
  "landingEditor.cep.label": "CEP (postcode)",
  "landingEditor.cep.district": "Neighbourhood",
  "landingEditor.cep.complement": "Flat, unit (optional)",
  "landingEditor.cep.complementPlaceholder": "Unit 2, rear",
  "legal.privacy.s6ItemPostalCode":
    "**CEP lookup:** when you fill in the barbershop address by CEP (Brazilian postcode), your browser sends only the CEP you type to ViaCEP, a free address lookup service. We don't send your name, email, phone or any other account data; as with any internet request, the service sees your device's IP address;",
};
