// Billing boundary. Payments are disabled in this build: there's no checkout,
// and nothing in the app takes or simulates payment. A Stripe test-mode
// adapter would live behind getBillingStatus() and only switch on when
// BILLING_ENABLED=true and the Stripe variables are set (see .env.example).

export interface BillingStatus {
  enabled: boolean;
  plan: "local-demo";
  message: string;
}

export function getBillingStatus(env: Record<string, string | undefined> = process.env): BillingStatus {
  const configured = env.BILLING_ENABLED === "true" && Boolean(env.STRIPE_SECRET_KEY) && Boolean(env.STRIPE_PRICE_ID);
  return {
    enabled: false,
    plan: "local-demo",
    message: configured
      ? "Stripe variables are set, but this build has no checkout implemented. Payments remain disabled."
      : "Payments aren't enabled in this build. Local demo mode is free and has no checkout.",
  };
}
