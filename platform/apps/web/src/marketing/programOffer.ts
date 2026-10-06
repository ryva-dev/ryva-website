/**
 * Commercial product (founder decision, 15 Aug 2026):
 *
 * 1. The Ryva Program is paid industry education ($397, one-time). After
 *    purchase, sign-in opens the learning environment (curriculum modules
 *    in /app). The operating platform stays closed until the program is
 *    completed. Learning content itself is not in this file.
 * 2. Completing the program unlocks the operating platform for a 30-day
 *    complimentary period.
 * 3. After that trial, the platform continues as Ryva Pro at $20 / month.
 *
 * Stripe: one-time Program SKU at PROGRAM_PRICE_USD; recurring Pro SKU at
 * PLATFORM_MONTHLY_USD. Do not sell platform access as part of the $397
 * charge. Do not collect card data in this app.
 */
export const PROGRAM_PRICE_USD = 397;
export const PLATFORM_MONTHLY_USD = 20;
export const PLATFORM_TRIAL_DAYS = 30;

export const PROGRAM_CHECKOUT_PATH = "/checkout";

export function formatUsd(usd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(usd);
}

export function formatProgramPrice(usd = PROGRAM_PRICE_USD): string {
  return formatUsd(usd);
}

export function formatPlatformMonthlyPrice(usd = PLATFORM_MONTHLY_USD): string {
  return formatUsd(usd);
}

export const PLATFORM_ACCESS_NOTE = `After you complete The Ryva Program, the operating platform opens for ${PLATFORM_TRIAL_DAYS} days at no charge, then continues at ${formatPlatformMonthlyPrice()} per month.`;

export const PLATFORM_ACCESS_INCLUDE = "Ryva operating platform after completion";

/** Shown before purchase. All-sales-final for digital Program enrollment. */
export const PROGRAM_REFUND_STATEMENT =
  "The Ryva Program is digital education delivered immediately after purchase. All Program sales are final. By continuing to checkout you request immediate access and acknowledge that you will not receive a refund except where a refund is required by law.";

export const PROGRAM_OFFER_INCLUDES = [
  "8 learning modules",
  "Guided exercises throughout",
  "Ryva guided practice scenarios",
  "Final commercial simulation",
  "Self-paced access",
  "The Ryva learning environment",
  PLATFORM_ACCESS_INCLUDE
] as const;
