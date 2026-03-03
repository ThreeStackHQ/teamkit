import Stripe from "stripe";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var _stripe: Stripe | undefined;
}

export function getStripe(): Stripe {
  if (globalThis._stripe) return globalThis._stripe;
  const instance = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
    typescript: true,
  });
  if (process.env.NODE_ENV !== "production") {
    globalThis._stripe = instance;
  }
  return instance;
}
