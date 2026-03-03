export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, subscriptions, users } from "@teamkit/db";
import { eq } from "drizzle-orm";
import { getStripe, PLANS, PlanName } from "@/lib/stripe";
import { z } from "zod";

const schema = z.object({
  plan: z.enum(["indie", "pro"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const userId = (session as any)?.userId;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { plan } = parsed.data;
  const planConfig = PLANS[plan as PlanName];
  if (!planConfig?.priceId) {
    return NextResponse.json({ error: "Invalid plan configuration" }, { status: 400 });
  }

  const stripe = getStripe();

  // Get or create Stripe customer
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  });

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  let customerId = sub?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      name: user?.name ?? undefined,
      metadata: { workspaceId },
    });
    customerId = customer.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
    metadata: { workspaceId, plan },
    subscription_data: { metadata: { workspaceId, plan } },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
