import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });
  }
  return stripeInstance;
}

export const PLANS = {
  free: {
    name: "Free",
    memberLimit: 5,
    priceId: null,
    price: 0,
  },
  indie: {
    name: "Indie",
    memberLimit: 25,
    priceId: process.env.STRIPE_PRICE_INDIE ?? "",
    price: 9,
  },
  pro: {
    name: "Pro",
    memberLimit: Infinity,
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    price: 29,
  },
} as const;

export type PlanName = keyof typeof PLANS;

export function getMemberLimit(plan: string): number {
  const p = PLANS[plan as PlanName];
  return p ? (p.memberLimit === Infinity ? 999999 : p.memberLimit) : 5;
}
