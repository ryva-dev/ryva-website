export function validateConfiguredPrice(price, { expectedAmountCents, expectedCurrency = "usd" }) {
  const reasons = [];
  if (!price || price.active !== true) reasons.push("Configured Stripe price is inactive or missing.");
  if (Number(price?.unit_amount) !== Number(expectedAmountCents)) reasons.push(`Configured Stripe price must be ${expectedAmountCents} cents.`);
  if (String(price?.currency || "").toLowerCase() !== expectedCurrency) reasons.push(`Configured Stripe price must use ${expectedCurrency.toUpperCase()}.`);
  if (price?.type !== "recurring" || price?.recurring?.interval !== "month") reasons.push("Configured Stripe price must recur monthly.");
  return { valid: reasons.length === 0, reasons };
}
