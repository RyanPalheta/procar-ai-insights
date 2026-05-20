// Utilities for classifying call direction.
//
// Calls from the team are "active" (active outbound — seller called a lead).
// Calls received by the company are "passive" (passive inbound — lead called us).
//
// The same company number appears in two formats in the data:
//   - "17816053526" (US E.164 with leading 1)
//   - "7816053526"  (local format without the country code 1)
// so we normalize to digits-only and strip a leading "1" for US (11 digits → 10).

export const COMPANY_PHONE_NUMBER = "17816053526";

export type CallDirection = "active" | "passive" | "unknown";

export function normalizePhoneDigits(num: string | null | undefined): string {
  if (!num) return "";
  const digits = String(num).replace(/\D/g, "");
  // Strip US country code (1) when the number is 11 digits starting with 1
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function getCallDirection(
  call: { from_number?: string | null; to_number?: string | null },
  companyPhone: string = COMPANY_PHONE_NUMBER
): CallDirection {
  const company = normalizePhoneDigits(companyPhone);
  if (!company) return "unknown";
  const from = normalizePhoneDigits(call.from_number);
  const to = normalizePhoneDigits(call.to_number);
  if (from && from === company) return "active";
  if (to && to === company) return "passive";
  return "unknown";
}

export function getCallDirectionLabel(d: CallDirection): string {
  if (d === "active") return "Ativa";
  if (d === "passive") return "Passiva";
  return "—";
}
