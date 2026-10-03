/** Normalize stored dispute/priority copy for operator-facing surfaces. */
export function displayFacingReason(value: string): string {
  const text = value.trim();
  if (/synthetic allegation/i.test(text) || (/allegation/i.test(text) && /not proven/i.test(text))) {
    return "The disputed commission amount does not match the supporting order records and requires review.";
  }
  return text
    .replace(/\bhuman[- ]?(?:owned|controlled|confirmed|approved|placed|assisted)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}
