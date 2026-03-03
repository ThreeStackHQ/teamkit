export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, subscriptions } from "@teamkit/db";
import { eq } from "drizzle-orm";
import { getStripe, PLANS, PlanName, getMemberLimit } from "@/lib/stripe";
import { createAuditLog } from "@/lib/audit";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.arrayBuffer();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(body),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook error: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const workspaceId = cs.metadata?.workspaceId;
      const plan = cs.metadata?.plan as PlanName | undefined;

      if (!workspaceId || !plan) break;

      const memberLimit = getMemberLimit(plan);

      await db
        .insert(subscriptions)
        .values({
          workspaceId,
          stripeCustomerId: cs.customer as string,
          stripeSubscriptionId: cs.subscription as string,
          plan,
          status: "active",
          seatCount: memberLimit,
        })
        .onConflictDoUpdate({
          target: subscriptions.workspaceId,
          set: {
            stripeCustomerId: cs.customer as string,
            stripeSubscriptionId: cs.subscription as string,
            plan,
            status: "active",
            seatCount: memberLimit,
            updatedAt: new Date(),
          },
        });

      await createAuditLog({
        workspaceId,
        action: "plan_changed",
        targetType: "workspace",
        targetId: workspaceId,
        metadata: { plan, memberLimit },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;

      if (!workspaceId) break;

      await db
        .update(subscriptions)
        .set({
          plan: "free",
          status: "canceled",
          seatCount: 5,
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));

      await createAuditLog({
        workspaceId,
        action: "plan_changed",
        targetType: "workspace",
        targetId: workspaceId,
        metadata: { plan: "free", reason: "subscription_cancelled" },
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;
      if (!workspaceId) break;

      const priceId = sub.items.data[0]?.price.id;
      let plan: PlanName = "free";
      if (priceId === process.env.STRIPE_PRICE_INDIE) plan = "indie";
      else if (priceId === process.env.STRIPE_PRICE_PRO) plan = "pro";

      await db
        .update(subscriptions)
        .set({
          plan,
          status: sub.status === "active" ? "active" : "past_due",
          seatCount: getMemberLimit(plan),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
