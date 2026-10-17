export const MONTHLY_USD_CENTS = 300;
export const DODO_MONTHLY_PRODUCT = "pdt_0Npwv99jSNd7IjtzSnFIJ";
export const PAYMENT_METHODS = ["visa", "mastercard", "vodafone", "apple", "google", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const providerFor = (method: PaymentMethod) => ["apple", "google", "other"].includes(method) ? "dodo" : "kashier";
export function matchesPayment(amount: number, currency: string) {
  return amount === MONTHLY_USD_CENTS && currency === "USD";
}
export function monthExpiry(from: Date) {
  const next = new Date(from);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next.toISOString();
}