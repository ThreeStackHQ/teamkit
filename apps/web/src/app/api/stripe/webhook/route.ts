import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, workspaces, subscriptions } from "@teamkit/db";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// POST /api/stripe/webhook
export async function POST(req: NextRequest) {
  const rawBodyBuffer = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBodyBuffer,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[TeamKit] Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      const plan = session.metadata?.plan as "indie" | "pro" | undefined;

      if (!workspaceId || !plan) break;

      // Update workspace plan
      await db
        .update(workspaces)
        .set({ plan, stripeCustomerId: session.customer as string })
        .where(eq(workspaces.id, workspaceId));

      // Upsert subscription record
      await db
        .insert(subscriptions)
        .values({
          workspaceId,
          stripeSubscriptionId: session.subscription as string,
          stripeCustomerId: session.customer as string,
          stripePriceId: null,
          status: "active",
        })
        .onConflictDoUpdate({
          target: subscriptions.workspaceId,
          set: {
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            status: "active",
            updatedAt: new Date(),
          },
        });

      console.info(`[TeamKit] Workspace ${workspaceId} upgraded to ${plan}`);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;

      if (!workspaceId) break;

      await db
        .update(subscriptions)
        .set({
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Find workspace by Stripe customer ID
      const customerId = sub.customer as string;

      await db
        .update(workspaces)
        .set({ plan: "free" })
        .where(eq(workspaces.stripeCustomerId, customerId));

      await db
        .update(subscriptions)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(eq(subscriptions.stripeCustomerId, customerId));

      console.info(`[TeamKit] Subscription canceled for customer ${customerId}, downgraded to free`);
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  return NextResponse.json({ received: true });
}
